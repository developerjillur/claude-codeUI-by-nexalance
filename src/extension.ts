import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import * as path from 'path';
import getHtml from './ui';
import { CheckpointManager, CheckpointMetadata, RestoreOptions } from './checkpointManager';
import { ContextWindowManager, ContextWindowStats, createContextWindowManager } from './contextWindowManager';
import { ProjectContextManager, ProjectContextSnapshot, createProjectContextManager } from './projectContextManager';
import { ProjectMemoryManager, createProjectMemoryManager } from './projectMemoryManager';
import { SmartMemoryManager, createSmartMemoryManager, TaskDetails, SmartContextResult, SessionContext } from './smartMemoryManager';
import { AdvancedContextEngine, createAdvancedContextEngine, ContextGenerationResult, PrioritizedContextItem } from './advancedContextEngine';
import { SelfVerificationEngine, createSelfVerificationEngine, VerificationResult } from './selfVerificationEngine';
import { DocsManager } from './docsManager';
import { WebviewMessage, ExtensionSettings, MCPServerConfig, CustomSnippet } from './types';
import { debounce, throttle, LRUCache, getErrorMessage, retryWithBackoff, EventEmitter } from './utils';

const exec = util.promisify(cp.exec);

// ==================== Error Handling Utilities ====================

/**
 * Error severity levels for user feedback
 */
type ErrorSeverity = 'info' | 'warning' | 'error';

/**
 * Safely execute an async operation with user feedback
 */
async function safeExecute<T>(
    operation: () => Promise<T>,
    options: {
        errorMessage?: string;
        showUserError?: boolean;
        severity?: ErrorSeverity;
        silent?: boolean;
    } = {}
): Promise<T | null> {
    const {
        errorMessage = 'An error occurred',
        showUserError = true,
        severity = 'error',
        silent = false
    } = options;

    try {
        return await operation();
    } catch (error: unknown) {
        const message = getErrorMessage(error);

        if (!silent) {
            console.error(`${errorMessage}: ${message}`);
        }

        if (showUserError) {
            const fullMessage = `${errorMessage}: ${message}`;
            switch (severity) {
                case 'info':
                    vscode.window.showInformationMessage(fullMessage);
                    break;
                case 'warning':
                    vscode.window.showWarningMessage(fullMessage);
                    break;
                case 'error':
                    vscode.window.showErrorMessage(fullMessage);
                    break;
            }
        }

        return null;
    }
}

/**
 * Wrap a function with error handling that won't crash the extension
 */
function withErrorBoundary<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context: string
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            console.error(`[${context}] Unhandled error: ${message}`);
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
            vscode.window.showErrorMessage(`Claude Code Chat error in ${context}. Check Output panel for details.`);
            return undefined;
        }
    }) as T;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Claude Code Chat extension is being activated!');
	const provider = new ClaudeChatProvider(context.extensionUri, context);

	const disposable = vscode.commands.registerCommand('claude-code-chat.openChat', (column?: vscode.ViewColumn) => {
		console.log('Claude Code Chat command executed!');
		provider.show(column);
	});

	const loadConversationDisposable = vscode.commands.registerCommand('claude-code-chat.loadConversation', (filename: string) => {
		provider.loadConversation(filename);
	});

	// Register webview view provider for sidebar chat (using shared provider instance)
	const webviewProvider = new ClaudeChatWebviewProvider(context.extensionUri, context, provider);
	vscode.window.registerWebviewViewProvider('claude-code-chat.chat', webviewProvider);

	// Listen for configuration changes
	const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('claudeCodeChat.wsl')) {
			console.log('WSL configuration changed, starting new session');
			provider.newSessionOnConfigChange();
		}
	});

	// Create status bar item with model info
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	const config = vscode.workspace.getConfiguration('claudeCodeChat');
	const defaultModel = config.get<string>('model.default', 'sonnet');
	const modelDisplayNames: Record<string, string> = {
		'opus': 'Opus 4.5',
		'sonnet': 'Sonnet 4.5',
		'haiku': 'Haiku 4.5',
		'default': 'Default'
	};
	const modelName = modelDisplayNames[defaultModel] || 'Claude';
	statusBarItem.text = `$(hubot) ${modelName}`;
	statusBarItem.tooltip = `Claude Code Chat - ${modelName}\nClick to open (Ctrl+Shift+C)`;
	statusBarItem.command = 'claude-code-chat.openChat';
	statusBarItem.show();

	context.subscriptions.push(disposable, loadConversationDisposable, configChangeDisposable, statusBarItem, provider);
	console.log('Claude Code Chat extension activation completed successfully!');
}

export function deactivate() { }

interface ConversationData {
	sessionId: string;
	startTime: string | undefined;
	endTime: string;
	messageCount: number;
	totalCost: number;
	totalTokens: {
		input: number;
		output: number;
	};
	messages: Array<{ timestamp: string, messageType: string, data: any }>;
	filename: string;
}

class ClaudeChatWebviewProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
		private readonly _chatProvider: ClaudeChatProvider
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		// Use the shared chat provider instance for the sidebar
		this._chatProvider.showInWebview(webviewView.webview, webviewView);

		// Handle visibility changes to reinitialize when sidebar reopens
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				// Close main panel when sidebar becomes visible
				if (this._chatProvider._panel) {
					console.log('Closing main panel because sidebar became visible');
					this._chatProvider._panel.dispose();
					this._chatProvider._panel = undefined;
				}
				this._chatProvider.reinitializeWebview();
			}
		});
	}
}


class ClaudeChatProvider implements vscode.Disposable {
	public _panel: vscode.WebviewPanel | undefined;
	private _webview: vscode.Webview | undefined;
	private _webviewView: vscode.WebviewView | undefined;
	private _disposables: vscode.Disposable[] = [];
	private _messageHandlerDisposable: vscode.Disposable | undefined;
	private _totalCost: number = 0;
	private _totalTokensInput: number = 0;
	private _totalTokensOutput: number = 0;
	private _requestCount: number = 0;
	private _currentSessionId: string | undefined;
	private _backupRepoPath: string | undefined;
	private _commits: Array<{ id: string, sha: string, message: string, timestamp: string }> = [];
	private _conversationsPath: string | undefined;
	private _permissionRequestsPath: string | undefined;
	private _permissionWatcher: vscode.FileSystemWatcher | undefined;
	private _pendingPermissionResolvers: Map<string, (approved: boolean) => void> | undefined;
	private _currentConversation: Array<{ timestamp: string, messageType: string, data: any }> = [];
	private _conversationStartTime: string | undefined;
	private _lastResponseHadThinking: boolean = false;
	private _conversationContext: Array<{role: 'user' | 'assistant', content: string}> = [];
	private _conversationIndex: Array<{
		filename: string,
		sessionId: string,
		startTime: string,
		endTime: string,
		messageCount: number,
		totalCost: number,
		firstUserMessage: string,
		lastUserMessage: string
	}> = [];
	private _currentClaudeProcess: cp.ChildProcess | undefined;
	private _selectedModel: string = 'sonnet'; // Default to Sonnet 4.5
	private _isProcessing: boolean | undefined;
	private _draftMessage: string = '';

	// Enhanced Checkpoint Manager
	private _checkpointManager: CheckpointManager;
	private _useEnhancedCheckpoints: boolean = true;

	// Context Window Manager
	private _contextWindowManager: ContextWindowManager;

	// Project Context Manager for persistent context storage
	private _projectContextManager: ProjectContextManager | null = null;
	private _hasPromptedContextRestore: boolean = false;

	// Documentation Manager
	private _docsManager: DocsManager | null = null;

	// Project Memory Manager for Knowledge Graph
	private _projectMemoryManager: ProjectMemoryManager | null = null;

	// Smart Memory Manager for intelligent context injection
	private _smartMemoryManager: SmartMemoryManager | null = null;

	// Advanced Context Engine for Priompt-like priority-based context management
	private _advancedContextEngine: AdvancedContextEngine | null = null;

	// Self-Verification Engine for response validation
	private _selfVerificationEngine: SelfVerificationEngine | null = null;

	// Use advanced context engine (can be toggled)
	private _useAdvancedContextEngine: boolean = true;

	// Memory initialization state tracking
	private _memoryInitialized: boolean = false;
	private _memoryInitializationPromise: Promise<void> | null = null;

	// Session token tracking to prevent "Prompt too long" errors
	private _sessionEstimatedTokens: number = 0;
	private _sessionMessageCount: number = 0;
	private _lastSessionCompaction: string | null = null;

	// Performance: Caching and debouncing
	private _workspaceFilesCache: LRUCache<string, { path: string; name: string }[]>;
	private _debouncedWorkspaceSearch: ReturnType<typeof debounce>;
	private _debouncedMemorySearch: ReturnType<typeof debounce>;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext
	) {
		// Initialize performance utilities (cache and debounce)
		this._workspaceFilesCache = new LRUCache<string, { path: string; name: string }[]>({
			maxSize: 50,
			ttlMs: 30000 // Cache workspace files for 30 seconds
		});
		this._debouncedWorkspaceSearch = debounce(
			(searchTerm: string) => this._performWorkspaceSearch(searchTerm),
			150 // 150ms debounce for search
		);
		this._debouncedMemorySearch = debounce(
			(query: string) => this._performMemorySearch(query),
			200 // 200ms debounce for memory search
		);

		// Initialize Enhanced Checkpoint Manager
		this._checkpointManager = new CheckpointManager(this._context);
		this._initializeEnhancedCheckpoints();

		// Initialize Context Window Manager
		this._contextWindowManager = createContextWindowManager();
		this._initializeContextWindowManager();

		// Initialize Project Context Manager for persistent context storage
		this._initializeProjectContextManager();

		// Initialize backup repository and conversations (legacy fallback)
		this._initializeBackupRepo();
		this._initializeConversations();
		this._initializeMCPConfig();

		// Initialize Documentation Manager
		this._initializeDocsManager();

		// Initialize Memory Systems (async chain)
		// This starts the initialization and stores the promise for later awaiting
		this._memoryInitializationPromise = this._initializeAllMemorySystems();

		// Load conversation index from workspace state
		this._conversationIndex = this._context.workspaceState.get('claude.conversationIndex', []);

		// Load saved model preference
		this._selectedModel = this._context.workspaceState.get('claude.selectedModel', 'default');

		// Resume session from latest conversation
		const latestConversation = this._getLatestConversation();
		this._currentSessionId = latestConversation?.sessionId;
	}

	private async _initializeEnhancedCheckpoints(): Promise<void> {
		try {
			const initialized = await this._checkpointManager.initialize();
			if (initialized) {
				this._useEnhancedCheckpoints = true;
				console.log('Enhanced Checkpoint Manager initialized successfully');
				const stats = this._checkpointManager.getStats();
				console.log(`Checkpoint stats: ${stats.totalCheckpoints} checkpoints, ${stats.trackedFiles} tracked files`);
			} else {
				this._useEnhancedCheckpoints = false;
				console.log('Falling back to legacy checkpoint system');
			}
		} catch (error: any) {
			console.error('Failed to initialize enhanced checkpoints:', error.message);
			this._useEnhancedCheckpoints = false;
		}
	}

	private _initializeContextWindowManager(): void {
		// Set up callback for context updates
		this._contextWindowManager.setContextUpdateCallback((stats: ContextWindowStats) => {
			// Send stats to webview
			this._postMessage({
				type: 'contextStats',
				data: stats
			});

			// Check for auto-compression
			if (stats.needsCompression && !this._contextWindowManager.isCompressing()) {
				this._handleAutoCompression();
			}
		});

		// Set model if already selected - map to context window appropriate model IDs
		if (this._selectedModel) {
			const modelMap: Record<string, string> = {
				'opus': 'opus',
				'sonnet': 'sonnet',
				'haiku': 'haiku',
				'default': 'sonnet'
			};
			this._contextWindowManager.setModel(modelMap[this._selectedModel] || 'sonnet');
		}

		console.log('Context Window Manager initialized');
	}

	private async _handleAutoCompression(): Promise<void> {
		console.log('Auto-compression triggered');

		// Notify UI that auto-compaction is starting
		this._postMessage({
			type: 'contextAutoCompacting',
			data: {}
		});

		try {
			const result = await this._contextWindowManager.compressContext();

			if (result.success) {
				console.log(`Context compressed: ${result.messagesCompressed} messages, ratio: ${result.compressionRatio.toFixed(2)}`);

				this._postMessage({
					type: 'contextCompacted',
					data: {
						messagesCompressed: result.messagesCompressed,
						compressionRatio: result.compressionRatio,
						stats: this._contextWindowManager.getStats()
					}
				});
			} else {
				console.log('Auto-compression not needed or failed');
			}
		} catch (error: any) {
			console.error('Auto-compression failed:', error.message);
			this._postMessage({
				type: 'contextCompactError',
				data: error.message
			});
		}
	}

	// ===== Project Context Manager =====

	private async _initializeProjectContextManager(): Promise<void> {
		try {
			this._projectContextManager = await createProjectContextManager();
			if (this._projectContextManager) {
				console.log('Project Context Manager initialized successfully');

				// Set up auto-save callback
				this._projectContextManager.setAutoSaveCallback(async () => {
					// Auto-save the current conversation context
					await this._autoSaveProjectContext();
				});

				// Enable auto-save
				this._projectContextManager.enableAutoSave();
			}
		} catch (error: any) {
			console.error('Failed to initialize Project Context Manager:', error.message);
			this._projectContextManager = null;
		}
	}

	private async _autoSaveProjectContext(): Promise<void> {
		if (!this._projectContextManager) return;

		try {
			// Get current conversation messages
			const messages = this._contextWindowManager.getConversation();

			// Add messages to project context
			for (const msg of messages) {
				await this._projectContextManager.addMessage(msg.role, msg.content);
			}

			// Create auto-save snapshot
			await this._projectContextManager.createSnapshot('auto');
		} catch (error: any) {
			console.error('Auto-save project context failed:', error.message);
		}
	}

	private async _backupProjectContext(manual: boolean = false): Promise<void> {
		if (!this._projectContextManager) {
			this._postMessage({
				type: 'projectContextBackupError',
				data: 'Project Context Manager not initialized'
			});
			return;
		}

		try {
			// Get current conversation messages from context window manager
			const messages = this._contextWindowManager.getConversation();

			// Add messages to ensure we have the latest
			for (const msg of messages) {
				await this._projectContextManager.addMessage(msg.role, msg.content);
			}

			// Create snapshot
			const snapshot = await this._projectContextManager.createSnapshot(manual ? 'manual' : 'auto');

			if (snapshot) {
				// Get message count from the conversation
				const messageCount = messages.length || snapshot.recentConversationIds.length * 10;

				this._postMessage({
					type: 'projectContextBackupSuccess',
					data: {
						id: snapshot.id,
						timestamp: new Date(snapshot.timestamp).getTime(),
						messageCount: messageCount,
						type: snapshot.type
					}
				});
				console.log(`Project context backup created: ${snapshot.id}`);
			} else {
				this._postMessage({
					type: 'projectContextBackupError',
					data: 'Failed to create snapshot'
				});
			}
		} catch (error: any) {
			console.error('Backup project context failed:', error.message);
			this._postMessage({
				type: 'projectContextBackupError',
				data: error.message
			});
		}
	}

	private async _checkAndPromptContextRestore(): Promise<void> {
		if (this._hasPromptedContextRestore || !this._projectContextManager) {
			return;
		}

		try {
			const latestSnapshot = await this._projectContextManager.getLatestSnapshot();

			if (latestSnapshot) {
				// Get message count from recent conversation IDs
				const messageCount = latestSnapshot.recentConversationIds.length * 10; // Approximate

				if (messageCount > 0) {
					// Check if the snapshot is recent (within last 24 hours)
					const snapshotTime = new Date(latestSnapshot.timestamp).getTime();
					const hoursSinceSnapshot = (Date.now() - snapshotTime) / (1000 * 60 * 60);

					if (hoursSinceSnapshot < 24) {
						this._hasPromptedContextRestore = true;

						// Send prompt to UI
						this._postMessage({
							type: 'projectContextRestorePrompt',
							data: {
								id: latestSnapshot.id,
								timestamp: snapshotTime,
								messageCount: messageCount,
								type: latestSnapshot.type
							}
						});
					}
				}
			}
		} catch (error: any) {
			console.error('Failed to check for context restore:', error.message);
		}
	}

	private async _restoreProjectContext(snapshotId: string): Promise<void> {
		if (!this._projectContextManager) {
			return;
		}

		try {
			// Get the context prompt from the snapshot
			const contextPrompt = await this._projectContextManager.getContextPrompt(snapshotId);

			if (contextPrompt) {
				// Get the snapshot for message count info
				const snapshots = await this._projectContextManager.listSnapshots();
				const snapshot = snapshots.find(s => s.id === snapshotId);

				// Send the context to the AI as a system message to restore context
				// This will be handled by the chat flow
				this._postMessage({
					type: 'projectContextRestored',
					data: {
						success: true,
						messageCount: snapshot?.messageCount || 0,
						contextPrompt: contextPrompt
					}
				});

				console.log(`Project context restored from snapshot: ${snapshotId}`);
			} else {
				this._postMessage({
					type: 'projectContextRestored',
					data: {
						success: false,
						error: 'Could not load context prompt'
					}
				});
			}
		} catch (error: any) {
			console.error('Failed to restore project context:', error.message);
			this._postMessage({
				type: 'projectContextRestored',
				data: {
					success: false,
					error: error.message
				}
			});
		}
	}

	private async _viewProjectSnapshots(): Promise<void> {
		if (!this._projectContextManager) {
			this._postMessage({
				type: 'projectSnapshotsList',
				data: []
			});
			return;
		}

		try {
			const snapshots = await this._projectContextManager.listSnapshots();

			this._postMessage({
				type: 'projectSnapshotsList',
				data: snapshots.slice(0, 10).map(s => ({
					id: s.id,
					timestamp: s.timestamp,
					messageCount: s.messageCount,
					type: s.type
				}))
			});
		} catch (error: any) {
			console.error('Failed to list project snapshots:', error.message);
			this._postMessage({
				type: 'projectSnapshotsList',
				data: []
			});
		}
	}

	// ===== Edit and Restore Prompt =====

	private async _handleEditAndRestorePrompt(
		messageIndex: number,
		editedContent: string,
		originalContent: string
	): Promise<void> {
		console.log(`Edit and restore prompt: UI messageIndex=${messageIndex}`);

		try {
			// Get all checkpoints
			const checkpoints = this._checkpointManager.getCheckpoints();
			let filesRestored = 0;
			let targetCheckpoint: CheckpointMetadata | null = null;

			// Log all checkpoints for debugging
			console.log(`Total checkpoints available: ${checkpoints.length}`);
			checkpoints.forEach((cp, idx) => {
				console.log(`  Checkpoint ${idx}: id=${cp.id.substring(0, 12)}, messageIndex=${cp.messageIndex}, message=${cp.message.substring(0, 30)}...`);
			});

			if (checkpoints.length > 0) {
				// The UI messageIndex corresponds to the user message number (1, 2, 3, etc.)
				// When we create a checkpoint, we now store the user message count at that time
				// The checkpoint represents the state BEFORE the message was processed
				// So for editing message N, we want the checkpoint with messageIndex === N
				// (which was created just before processing message N)

				// First try exact match
				targetCheckpoint = checkpoints.find(cp => cp.messageIndex === messageIndex) || null;
				console.log(`Exact match for messageIndex ${messageIndex}: ${targetCheckpoint ? 'FOUND' : 'NOT FOUND'}`);

				// If no exact match, find the checkpoint with the highest messageIndex that is <= our target
				// This handles the case where a checkpoint might be missing
				if (!targetCheckpoint) {
					const sortedCheckpoints = [...checkpoints].sort((a, b) =>
						(a.messageIndex || 0) - (b.messageIndex || 0)
					);

					console.log('Looking for closest previous checkpoint...');
					for (let i = sortedCheckpoints.length - 1; i >= 0; i--) {
						const cpIndex = sortedCheckpoints[i].messageIndex || 0;
						if (cpIndex <= messageIndex) {
							targetCheckpoint = sortedCheckpoints[i];
							console.log(`  Selected checkpoint with messageIndex ${cpIndex}`);
							break;
						}
					}

					// If still not found (all checkpoints have higher index), use the first one
					if (!targetCheckpoint && sortedCheckpoints.length > 0) {
						targetCheckpoint = sortedCheckpoints[0];
						console.log(`  Fallback: using first checkpoint with messageIndex ${targetCheckpoint.messageIndex}`);
					}
				}

				if (targetCheckpoint) {
					console.log(`Restoring to checkpoint: ${targetCheckpoint.id} (messageIndex: ${targetCheckpoint.messageIndex})`);
					console.log(`This will restore files to state before message ${targetCheckpoint.messageIndex} was processed`);

					// Perform the restore - this restores files to the state at that checkpoint
					const restoreResult = await this._checkpointManager.restoreToCheckpoint(
						targetCheckpoint.id,
						{ createBackupBeforeRestore: true }
					);

					if (restoreResult.success) {
						filesRestored = restoreResult.restoredFiles?.length || 0;
						console.log(`Files restored successfully: ${filesRestored} files`);
					} else {
						console.warn(`Restore warning: ${restoreResult.message}`);
					}
				} else {
					console.log('No suitable checkpoint found for this message index');
				}
			} else {
				console.log('No checkpoints available - cannot restore files');
			}

			// Also trim the conversation history to remove messages after this point
			// This keeps the backend in sync with the UI
			const userMessageCount = this._currentConversation.filter(m => m.messageType === 'userInput').length;
			console.log(`Current user message count in conversation: ${userMessageCount}, editing message: ${messageIndex}`);

			// Remove messages from conversation that came after this user message
			// We need to find the index where user message N starts and remove everything after
			let conversationCutIndex = -1;
			let currentUserMsgCount = 0;
			for (let i = 0; i < this._currentConversation.length; i++) {
				if (this._currentConversation[i].messageType === 'userInput') {
					currentUserMsgCount++;
					if (currentUserMsgCount === messageIndex) {
						conversationCutIndex = i;
						break;
					}
				}
			}

			if (conversationCutIndex >= 0) {
				const removedCount = this._currentConversation.length - conversationCutIndex;
				this._currentConversation.splice(conversationCutIndex);
				console.log(`Trimmed conversation: removed ${removedCount} messages, now ${this._currentConversation.length} messages`);
			}

			// Send success response to UI - UI will handle message removal and auto-submit
			this._postMessage({
				type: 'editRestoreComplete',
				data: {
					success: true,
					messageIndex,
					editedContent,
					filesRestored,
					message: filesRestored > 0 ? `Restored ${filesRestored} files to state before message ${messageIndex}` : 'Ready to submit edited prompt'
				}
			});

			console.log(`Edit restore complete: ${filesRestored} files restored, conversation trimmed, ready to submit edited prompt`);

		} catch (error: any) {
			console.error('Edit and restore failed:', error.message);

			this._postMessage({
				type: 'editRestoreComplete',
				data: {
					success: false,
					messageIndex,
					editedContent,
					error: error.message
				}
			});
		}
	}

	public show(column: vscode.ViewColumn | vscode.Uri = vscode.ViewColumn.Two) {
		// Handle case where a URI is passed instead of ViewColumn
		const actualColumn = column instanceof vscode.Uri ? vscode.ViewColumn.Two : column;

		// Close sidebar if it's open
		this._closeSidebar();

		if (this._panel) {
			this._panel.reveal(actualColumn);
			return;
		}

		this._panel = vscode.window.createWebviewPanel(
			'claudeChat',
			'Claude Code Chat',
			actualColumn,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this._extensionUri]
			}
		);

		// Set icon for the webview tab using URI path
		const iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon-bubble.png');
		this._panel.iconPath = iconPath;

		this._panel.webview.html = this._getHtmlForWebview();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._setupWebviewMessageHandler(this._panel.webview);
		this._initializePermissions();

		// Resume session from latest conversation
		const latestConversation = this._getLatestConversation();
		this._currentSessionId = latestConversation?.sessionId;

		// Load latest conversation history if available
		if (latestConversation) {
			this._loadConversationHistory(latestConversation.filename);
		}

		// Send ready message immediately
		setTimeout(() => {
			// If no conversation to load, send ready immediately
			if (!latestConversation) {
				this._sendReadyMessage();
			}
		}, 100);
	}

	private _postMessage(message: any) {
		if (this._panel && this._panel.webview) {
			this._panel.webview.postMessage(message);
		} else if (this._webview) {
			this._webview.postMessage(message);
		}
	}

	private _sendReadyMessage() {
		// Send current session info if available
		/*if (this._currentSessionId) {
			this._postMessage({
				type: 'sessionResumed',
				data: {
					sessionId: this._currentSessionId
				}
			});
		}*/

		this._postMessage({
			type: 'ready',
			data: this._isProcessing ? 'Claude is working...' : 'Ready to chat with Claude Code! Type your message below.'
		});

		// Send current model to webview
		this._postMessage({
			type: 'modelSelected',
			model: this._selectedModel
		});

		// Send platform information to webview
		this._sendPlatformInfo();

		// Send current settings to webview
		this._sendCurrentSettings();

		// Send saved draft message if any
		if (this._draftMessage) {
			this._postMessage({
				type: 'restoreInputText',
				data: this._draftMessage
			});
		}
	}

	private _handleWebviewMessage(message: WebviewMessage) {
		try {
			this._handleWebviewMessageInternal(message);
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			console.error(`Error handling webview message ${message.type}:`, errorMsg);
			this._postMessage({
				type: 'error',
				data: { message: `Failed to process ${message.type}: ${errorMsg}` }
			});
		}
	}

	private _handleWebviewMessageInternal(message: WebviewMessage) {
		switch (message.type) {
			case 'sendMessage':
				this._sendMessageToClaude(message.text, message.planMode, message.planModeType, message.thinkingMode).catch((err: unknown) => {
					const errorMsg = getErrorMessage(err);
					console.error('Error sending message to Claude:', errorMsg);
					this._postMessage({
						type: 'error',
						data: { message: `Failed to send message: ${errorMsg}` }
					});
				});
				return;
			case 'newSession':
				this._newSession();
				return;
			case 'restoreCommit':
				this._restoreToCommit(message.commitSha);
				return;
			case 'getConversationList':
				this._sendConversationList();
				return;
			case 'getWorkspaceFiles':
				this._sendWorkspaceFiles(message.searchTerm);
				return;
			case 'selectImageFile':
				this._selectImageFile();
				return;
			case 'loadConversation':
				this.loadConversation(message.filename);
				return;
			case 'stopRequest':
				this._stopClaudeProcess();
				return;
			case 'getSettings':
				this._sendCurrentSettings();
				return;
			case 'updateSettings':
				this._updateSettings(message.settings);
				return;
			case 'getClipboardText':
				this._getClipboardText();
				return;
			case 'selectModel':
				this._setSelectedModel(message.model);
				return;
			case 'openModelTerminal':
				this._openModelTerminal();
				return;
			case 'executeSlashCommand':
				this._executeSlashCommand(message.command);
				return;
			case 'dismissWSLAlert':
				this._dismissWSLAlert();
				return;
			case 'openFile':
				this._openFileInEditor(message.filePath);
				return;
			case 'createImageFile':
				this._createImageFile(message.imageData, message.imageType);
				return;
			case 'permissionResponse':
				this._handlePermissionResponse(message.id, message.approved, message.alwaysAllow);
				return;
			case 'getPermissions':
				this._sendPermissions();
				return;
			case 'removePermission':
				this._removePermission(message.toolName, message.command);
				return;
			case 'addPermission':
				this._addPermission(message.toolName, message.command);
				return;
			case 'loadMCPServers':
				this._loadMCPServers();
				return;
			case 'saveMCPServer':
				this._saveMCPServer(message.name, message.config);
				return;
			case 'deleteMCPServer':
				this._deleteMCPServer(message.name);
				return;
			case 'getCustomSnippets':
				this._sendCustomSnippets();
				return;
			case 'saveCustomSnippet':
				this._saveCustomSnippet(message.snippet);
				return;
			case 'deleteCustomSnippet':
				this._deleteCustomSnippet(message.snippetId);
				return;
			case 'enableYoloMode':
				this._enableYoloMode();
				return;
			case 'saveInputText':
				this._saveInputText(message.text);
				return;
			case 'getCheckpoints':
				this._sendCheckpointsList();
				return;
			case 'previewRestore':
				this._previewCheckpointRestore(message.checkpointId);
				return;
			case 'confirmRestore':
				this._confirmRestoreCheckpoint(message.checkpointId, message.options);
				return;
			case 'getCheckpointStats':
				this._sendCheckpointStats();
				return;
			case 'clearAllCheckpoints':
				this._clearAllCheckpoints();
				return;
			case 'restoreFromBackup':
				this._restoreFromBackup();
				return;
			case 'checkRestoreBackupAvailable':
				this._checkRestoreBackupAvailable();
				return;
			// Context Window Management
			case 'getContextStats':
				this._sendContextStats();
				return;
			case 'compactContext':
				this._manualCompactContext();
				return;

			// Project Context Management
			case 'backupProjectContext':
				this._backupProjectContext(message.manual === true);
				return;
			case 'viewProjectSnapshots':
				this._viewProjectSnapshots();
				return;
			case 'restoreProjectContext':
				this._restoreProjectContext(message.snapshotId);
				return;
			case 'skipContextRestore':
				this._hasPromptedContextRestore = true;
				console.log('User skipped context restore');
				return;

			// Edit and Restore Prompt
			case 'editAndRestorePrompt':
				this._handleEditAndRestorePrompt(message.messageIndex, message.editedContent, message.originalContent);
				return;

			// Docs Management
			case 'loadDocs':
				this._loadDocs();
				return;
			case 'addDoc':
				this._addDoc({
					name: message.name,
					entryUrl: message.entryUrl || message.url,
					prefixUrl: message.prefixUrl,
					maxPages: message.maxPages,
					maxDepth: message.maxDepth
				});
				return;
			case 'reindexDoc':
				this._reindexDoc(message.docId);
				return;
			case 'deleteDoc':
				this._deleteDoc(message.docId);
				return;

			// Project Memory Management
			case 'getMemoryStats':
				this._sendMemoryStats();
				return;
			case 'getMemoryContext':
				this._sendMemoryContext();
				return;
			case 'searchMemory':
				this._searchMemory(message.query);
				return;
			case 'clearMemory':
				this._clearProjectMemory();
				return;
			case 'exportMemory':
				this._exportMemory();
				return;
			case 'getMemorySettings':
				this._sendMemorySettings();
				return;
			case 'updateMemorySettings':
				this._updateMemorySettings(message.settings);
				return;

			// Task Manager
			case 'getAllTasks':
				this._getAllTasks();
				return;
			case 'getTaskDetails':
				this._getTaskDetails(message.taskId);
				return;
			case 'updateTaskStatus':
				this._updateTaskStatus(message.taskId, message.status);
				return;
			case 'createTask':
				this._createTask(message.name, message.description, message.importance, message.relatedFiles);
				return;
			case 'addTaskObservation':
				this._addTaskObservation(message.taskId, message.observation);
				return;

			// Session Health
			case 'getSessionHealth':
				this._sendSessionHealth();
				return;
			case 'forceNewSession':
				this._newSession();
				this._postMessage({ type: 'sessionForceCleared', data: { reason: 'User requested new session' } });
				return;

			// Scratchpad Management (CRITICAL FIX for persistence)
			case 'saveScratchpadItems':
				this._saveScratchpadItems(message.items);
				return;
			case 'getScratchpadItems':
				this._sendScratchpadItems();
				return;
		}
	}

	private _setupWebviewMessageHandler(webview: vscode.Webview) {
		// Dispose of any existing message handler
		if (this._messageHandlerDisposable) {
			this._messageHandlerDisposable.dispose();
		}

		// Set up new message handler
		this._messageHandlerDisposable = webview.onDidReceiveMessage(
			message => this._handleWebviewMessage(message),
			null,
			this._disposables
		);
	}

	private _closeSidebar() {
		if (this._webviewView) {
			// Switch VS Code to show Explorer view instead of chat sidebar
			vscode.commands.executeCommand('workbench.view.explorer');
		}
	}

	public showInWebview(webview: vscode.Webview, webviewView?: vscode.WebviewView) {
		// Close main panel if it's open
		if (this._panel) {
			console.log('Closing main panel because sidebar is opening');
			this._panel.dispose();
			this._panel = undefined;
		}

		this._webview = webview;
		this._webviewView = webviewView;
		this._webview.html = this._getHtmlForWebview();

		this._setupWebviewMessageHandler(this._webview);
		this._initializePermissions();

		// Initialize the webview
		this._initializeWebview();
	}

	private _initializeWebview() {
		// Resume session from latest conversation
		const latestConversation = this._getLatestConversation();
		this._currentSessionId = latestConversation?.sessionId;

		// Load latest conversation history if available
		if (latestConversation) {
			this._loadConversationHistory(latestConversation.filename);
		} else {
			// If no conversation to load, send ready immediately
			setTimeout(() => {
				this._sendReadyMessage();
			}, 100);
		}

		// Check if we should prompt to restore previous context
		// Delay slightly to ensure webview is ready
		setTimeout(() => {
			this._checkAndPromptContextRestore();
		}, 500);
	}

	public reinitializeWebview() {
		// Only reinitialize if we have a webview (sidebar)
		if (this._webview) {
			this._initializePermissions();
			this._initializeWebview();
			// Set up message handler for the webview
			this._setupWebviewMessageHandler(this._webview);
		}
	}

	private async _sendMessageToClaude(message: string, planMode?: boolean, planModeType?: string, thinkingMode?: boolean) {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd();

		// Process @docs mentions and inject relevant documentation context
		let processedMessage = message;
		let docsUsed: string[] = [];
		if (this._docsManager) {
			try {
				const result = await this._docsManager.processMessageWithDocs(message);
				processedMessage = result.processedMessage;
				docsUsed = result.docsUsed;
				if (docsUsed.length > 0) {
					console.log(`Injected documentation context from: ${docsUsed.join(', ')}`);
				}
			} catch (error: any) {
				console.error('Error processing docs mentions:', error.message);
			}
		}

		// Smart Memory Injection - only inject RELEVANT context based on user prompt
		// This prevents "Prompt is too long" errors by being intelligent about what to inject
		let memoryContext = '';
		let memoryInjected = false;
		const memoryConfig = vscode.workspace.getConfiguration('claudeCodeChat');
		const autoInjectMemory = memoryConfig.get<boolean>('memory.autoInject', true);
		const maxMemoryContextSize = memoryConfig.get<number>('memory.maxContextSize', 4000);

		// Try Advanced Context Engine first (Priompt-like priority system)
		if (autoInjectMemory && this._useAdvancedContextEngine && this._advancedContextEngine && this._advancedContextEngine.isInitialized()) {
			try {
				// Use advanced context engine for optimized, priority-based injection
				const contextResult = await this._advancedContextEngine.generateOptimizedContext(
					message,
					{
						maxTokens: maxMemoryContextSize,
						includeRules: true,
						includeScratchpad: true
					}
				);

				if (contextResult.context && contextResult.tokenEstimate > 0) {
					memoryContext = contextResult.context;
					processedMessage = memoryContext + '\n\n---\n\nUser Request:\n' + processedMessage;
					memoryInjected = true;

					console.log(`Advanced context injection: ${contextResult.includedItems.length} items, ${contextResult.tokenEstimate} tokens, confidence: ${(contextResult.confidence * 100).toFixed(0)}%`);

					// Notify UI with advanced context info
					this._postMessage({
						type: 'memoryInjected',
						data: {
							entities: contextResult.includedItems.length,
							observations: 0,
							contextSize: contextResult.context.length,
							tokenEstimate: contextResult.tokenEstimate,
							confidence: contextResult.confidence,
							relevantEntities: contextResult.includedItems.map(i => i.id),
							reason: contextResult.recommendations.join('; ') || 'Advanced context injection',
							isSmartInjection: true,
							isAdvancedEngine: true,
							compressionApplied: contextResult.compressionApplied,
							priorityBreakdown: contextResult.debug.priorityBreakdown
						}
					});

					// Show recommendations if any
					if (contextResult.recommendations.length > 0) {
						console.log('Context recommendations:', contextResult.recommendations.join(', '));
					}
				} else {
					console.log('Advanced context skipped: No relevant context found');
				}

				// Update session tracking
				this._sessionMessageCount++;
				this._sessionEstimatedTokens += this._estimateTokens(processedMessage);

				// Check session health from advanced engine
				const sessionHealth = this._advancedContextEngine.getSessionHealth();
				if (sessionHealth.status === 'warning' || sessionHealth.status === 'critical') {
					this._postMessage({
						type: 'sessionHealthWarning',
						data: sessionHealth
					});
				}

			} catch (error: any) {
				console.error('Error in advanced context injection:', error.message);
				// Fall through to smart memory manager
			}
		}

		// Fall back to Smart Memory Manager if advanced engine didn't inject
		if (!memoryInjected && autoInjectMemory && this._smartMemoryManager && this._smartMemoryManager.isInitialized()) {
			try {
				// Build session context for smart injection
				const sessionContext: SessionContext = {
					sessionId: this._currentSessionId || 'new',
					messageCount: this._sessionMessageCount,
					estimatedTokens: this._sessionEstimatedTokens,
					lastCompactionTime: this._lastSessionCompaction,
					isOverBudget: this._sessionEstimatedTokens > 120000 // 80% of 150k
				};

				// Check session health first
				const sessionHealth = this._smartMemoryManager.getSessionHealth(sessionContext);

				// If session is critical, warn user and skip injection
				if (sessionHealth.status === 'critical') {
					console.warn(`Session health critical (${sessionHealth.usagePercent.toFixed(1)}% used): ${sessionHealth.recommendation}`);
					this._postMessage({
						type: 'sessionHealthWarning',
						data: {
							status: sessionHealth.status,
							usagePercent: sessionHealth.usagePercent,
							recommendation: sessionHealth.recommendation
						}
					});
					// Don't inject memory when session is critical
				} else {
					// Use smart memory manager to get ONLY relevant context
					const smartResult = await this._smartMemoryManager.generateSmartContext(
						message, // Original message for analysis
						sessionContext,
						maxMemoryContextSize
					);

					if (smartResult.wasInjected && smartResult.context) {
						memoryContext = smartResult.context;
						processedMessage = memoryContext + '\n\n---\n\nUser Request:\n' + processedMessage;
						memoryInjected = true;

						console.log(`Smart memory injection: ${smartResult.relevantEntities.length} entities, ${smartResult.tokenEstimate} tokens, confidence: ${(smartResult.confidence * 100).toFixed(0)}%`);

						// Notify UI with enhanced smart memory info
						this._postMessage({
							type: 'memoryInjected',
							data: {
								entities: smartResult.relevantEntities.length,
								observations: 0, // Not applicable for smart injection
								contextSize: smartResult.context.length,
								tokenEstimate: smartResult.tokenEstimate,
								confidence: smartResult.confidence,
								relevantEntities: smartResult.relevantEntities,
								reason: smartResult.reason,
								isSmartInjection: true
							}
						});
					} else {
						console.log(`Smart memory skipped: ${smartResult.reason}`);
					}
				}

				// Update session token estimate
				this._sessionMessageCount++;
				this._sessionEstimatedTokens += this._estimateTokens(processedMessage);

			} catch (error: any) {
				console.error('Error in smart memory injection:', error.message);
			}
		} else if (!memoryInjected && autoInjectMemory) {
			// Fallback to basic memory manager if smart manager not available
			console.log('Smart memory manager not available, using basic injection');
			if (this._projectMemoryManager && this._projectMemoryManager.isInitialized()) {
				try {
					const stats = this._projectMemoryManager.getMemoryStats();
					if (stats.totalEntities > 1 || stats.totalObservations > 3) {
						memoryContext = this._projectMemoryManager.generateMemoryContextPrompt();
						if (memoryContext && memoryContext.length > 100) {
							if (memoryContext.length > maxMemoryContextSize) {
								memoryContext = memoryContext.substring(0, maxMemoryContextSize) + '\n\n[Memory context truncated...]\n';
							}
							processedMessage = memoryContext + '\n\n---\n\nUser Request:\n' + processedMessage;
							memoryInjected = true;
							console.log(`Basic memory injection: ${stats.totalEntities} entities, ${memoryContext.length} chars`);
							this._postMessage({
								type: 'memoryInjected',
								data: {
									entities: stats.totalEntities,
									observations: stats.totalObservations,
									contextSize: memoryContext.length,
									isSmartInjection: false
								}
							});
						}
					}
				} catch (error: any) {
					console.error('Error in basic memory injection:', error.message);
				}
			}
		}

		// Get thinking intensity setting
		const configThink = vscode.workspace.getConfiguration('claudeCodeChat');
		const thinkingIntensity = configThink.get<string>('thinking.intensity', 'think');

		// Prepend mode instructions if enabled
		let actualMessage = processedMessage;

		// Track user message for context preservation (used when resuming after thinking blocks fails)
		this._conversationContext.push({
			role: 'user',
			content: processedMessage
		});

		if (planMode) {
			// Get the specific plan mode type (planfast, ask, or agent)
			const planType = planModeType || 'ask';
			let planPrompt = '';

			switch (planType) {
				case 'planfast':
					planPrompt = 'QUICK PLAN MODE: Provide a brief, concise plan overview of what you will do, then proceed with implementation immediately. Keep the plan summary short (3-5 bullet points max) and focus on key changes. This is a fast-track planning approach.\n\n';
					break;
				case 'ask':
					planPrompt = 'PLAN FIRST FOR THIS MESSAGE ONLY: Plan first before making any changes. Show me in detail what you will change and wait for my explicit approval in a separate message before proceeding. Do not implement anything until I confirm. This planning requirement applies ONLY to this current message.\n\n';
					break;
				case 'agent':
					planPrompt = 'AGENT MODE: You are operating in autonomous agent mode. Analyze the request thoroughly, create a comprehensive implementation plan, and execute it independently. Break down complex tasks into subtasks, handle edge cases proactively, and complete the entire task with minimal user intervention. Report progress and results clearly.\n\n';
					break;
				case 'auto':
					// AutoMode Phase 1: Use enhanced Ask prompt for comprehensive planning
					planPrompt = `AUTOMODE PHASE 1 - COMPREHENSIVE PLANNING:

You are in AutoMode. First, create a detailed implementation plan that will be automatically executed in the next phase.

📋 CREATE YOUR IMPLEMENTATION PLAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Overview]: Brief summary of what you'll accomplish
[Analysis]: Key observations about the codebase/requirements
[Strategy]: Your chosen approach and why
[Implementation Steps]:
  1. [Specific step with files/functions to modify]
  2. [Next step with details...]
  3. [Continue numbering all steps...]
[Considerations]: Edge cases, dependencies, potential issues
[Files to Modify]: List all files that will be changed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Present ONLY the plan. Do NOT implement yet. The execution will happen automatically in the next phase.

`;
					break;
				case 'trueplan':
					// Native plan mode - no prompt injection needed
					// The --permission-mode plan CLI flag enforces read-only behavior
					planPrompt = '';
					break;
				default:
					planPrompt = 'PLAN FIRST FOR THIS MESSAGE ONLY: Plan first before making any changes. Show me in detail what you will change and wait for my explicit approval in a separate message before proceeding. Do not implement anything until I confirm. This planning requirement applies ONLY to this current message.\n\n';
			}

			actualMessage = planPrompt + processedMessage;
		}
		if (thinkingMode) {
			let thinkingPrompt = '';
			const thinkingMesssage = ' THROUGH THIS STEP BY STEP: \n'
			switch (thinkingIntensity) {
				case 'think':
					thinkingPrompt = 'THINK';
					break;
				case 'think-hard':
					thinkingPrompt = 'THINK HARD';
					break;
				case 'think-harder':
					thinkingPrompt = 'THINK HARDER';
					break;
				case 'ultrathink':
					thinkingPrompt = 'ULTRATHINK';
					break;
				default:
					thinkingPrompt = 'THINK';
			}
			actualMessage = thinkingPrompt + thinkingMesssage + actualMessage;
		}

		this._isProcessing = true;

		// Clear draft message since we're sending it
		this._draftMessage = '';

		// Show original user input in chat and save to conversation (without mode prefixes)
		this._sendAndSaveMessage({
			type: 'userInput',
			data: message
		});

		// Track user message in context window manager
		this._trackContextMessage('user', message);

		// Set processing state to true
		this._postMessage({
			type: 'setProcessing',
			data: { isProcessing: true }
		});

		// Create backup commit before Claude makes changes
		try {
			await this._createBackupCommit(message);
		}
		catch (e) {
			console.log("error", e);
		}

		// Show loading indicator
		this._postMessage({
			type: 'loading',
			data: 'Claude is working...'
		});

		// Build command arguments with session management
		const args = [
			'-p',
			'--output-format', 'stream-json', '--verbose'
		];

		// Get configuration
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const yoloMode = config.get<boolean>('permissions.yoloMode', false);
		const permissionMode = config.get<string>('permissions.mode', 'default');
		const maxTokens = config.get<number>('model.maxTokens', 16384);

		// Handle permission modes
		// Yolo mode ALWAYS takes priority - user explicitly wants to skip ALL permissions
		if (yoloMode || permissionMode === 'bypassPermissions') {
			args.push('--dangerously-skip-permissions');
		} else if (planMode && planModeType === 'trueplan') {
			// True Plan mode: read-only analysis (only if Yolo not enabled)
			args.push('--permission-mode', 'plan');
		} else if (permissionMode === 'acceptEdits') {
			// Accept edits mode: auto-approve file modifications
			args.push('--permission-mode', 'acceptEdits');
		} else if (permissionMode === 'plan') {
			// Plan mode: read-only analysis
			args.push('--permission-mode', 'plan');
		} else {
			// Default mode: use MCP configuration for permissions
			const mcpConfigPath = this.getMCPConfigPath();
			if (mcpConfigPath) {
				args.push('--mcp-config', this.convertToWSLPath(mcpConfigPath));
				args.push('--allowedTools', 'mcp__claude-code-chat-permissions__approval_prompt');
				args.push('--permission-prompt-tool', 'mcp__claude-code-chat-permissions__approval_prompt');
			}
		}

		// Add max tokens configuration
		if (maxTokens && maxTokens !== 16384) {
			args.push('--max-tokens', maxTokens.toString());
		}

		// Add model selection if not using default
		if (this._selectedModel && this._selectedModel !== 'default') {
			args.push('--model', this._selectedModel);
		}

		// If last response had thinking blocks, start fresh session with context injection
		// This avoids the API error: "thinking or redacted_thinking blocks cannot be modified"
		if (this._lastResponseHadThinking && this._conversationContext.length > 0) {
			console.log('Previous response had thinking blocks - starting new session with context injection');

			// Build context summary from last few exchanges (max 5 exchanges = 10 messages)
			const recentContext = this._conversationContext.slice(-10);
			let contextSummary = '[CONVERSATION CONTEXT - Previous messages from this session]\n';

			for (const msg of recentContext) {
				const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
				// Truncate long messages for context
				const truncatedContent = msg.content.length > 500
					? msg.content.substring(0, 500) + '...'
					: msg.content;
				contextSummary += `${roleLabel}: ${truncatedContent}\n\n`;
			}

			contextSummary += '[END CONTEXT]\n\nNow responding to the following new message:\n';

			// Prepend context to the actual message
			actualMessage = contextSummary + actualMessage;

			// Clear session to force new session
			this._currentSessionId = undefined;
			this._lastResponseHadThinking = false;
		}

		// Add session resume if we have a current session
		if (this._currentSessionId) {
			args.push('--resume', this._currentSessionId);
			console.log('Resuming session:', this._currentSessionId);
		} else {
			console.log('Starting new session');
		}

		console.log('Claude command args:', args);
		const wslEnabled = config.get<boolean>('wsl.enabled', false);
		const wslDistro = config.get<string>('wsl.distro', 'Ubuntu');
		const nodePath = config.get<string>('wsl.nodePath', '/usr/bin/node');
		const claudePath = config.get<string>('wsl.claudePath', '/usr/local/bin/claude');

		let claudeProcess: cp.ChildProcess;

		if (wslEnabled) {
			// Use WSL with bash -ic for proper environment loading
			console.log('Using WSL configuration:', { wslDistro, nodePath, claudePath });
			const wslCommand = `"${nodePath}" --no-warnings --enable-source-maps "${claudePath}" ${args.join(' ')}`;

			claudeProcess = cp.spawn('wsl', ['-d', wslDistro, 'bash', '-ic', wslCommand], {
				cwd: cwd,
				stdio: ['pipe', 'pipe', 'pipe'],
				// Note: Do NOT use detached:true for WSL - it causes process handling issues
				env: {
					...process.env,
					FORCE_COLOR: '0',
					NO_COLOR: '1'
				}
			});
		} else {
			// Use native claude command
			console.log('Using native Claude command');
			claudeProcess = cp.spawn('claude', args, {
				shell: process.platform === 'win32',
				cwd: cwd,
				stdio: ['pipe', 'pipe', 'pipe'],
				detached: process.platform !== 'win32', // Allow process group killing on Unix
				env: {
					...process.env,
					FORCE_COLOR: '0',
					NO_COLOR: '1'
				}
			});
		}

		// Store process reference for potential termination
		this._currentClaudeProcess = claudeProcess;

		// Send the message to Claude's stdin (with mode prefixes if enabled)
		if (claudeProcess.stdin) {
			claudeProcess.stdin.write(actualMessage + '\n');
			claudeProcess.stdin.end();
		}

		let rawOutput = '';
		let errorOutput = '';

		if (claudeProcess.stdout) {
			claudeProcess.stdout.on('data', (data) => {
				rawOutput += data.toString();

				// Process JSON stream line by line
				const lines = rawOutput.split('\n');
				rawOutput = lines.pop() || ''; // Keep incomplete line for next chunk

				for (const line of lines) {
					if (line.trim()) {
						try {
							const jsonData = JSON.parse(line.trim());
							this._processJsonStreamData(jsonData);
						} catch (error) {
							console.log('Failed to parse JSON line:', line, error);
						}
					}
				}
			});
		}

		if (claudeProcess.stderr) {
			claudeProcess.stderr.on('data', (data) => {
				errorOutput += data.toString();
			});
		}

		claudeProcess.on('close', (code) => {
			console.log('Claude process closed with code:', code);
			console.log('Claude stderr output:', errorOutput);

			if (!this._currentClaudeProcess) {
				return;
			}

			// Clear process reference
			this._currentClaudeProcess = undefined;

			// Clear loading indicator and set processing to false
			this._postMessage({
				type: 'clearLoading'
			});

			// Reset processing state
			this._isProcessing = false;

			// Clear processing state
			this._postMessage({
				type: 'setProcessing',
				data: { isProcessing: false }
			});

			if (code !== 0 && errorOutput.trim()) {
				// Error with output
				this._sendAndSaveMessage({
					type: 'error',
					data: errorOutput.trim()
				});
			}
		});

		claudeProcess.on('error', (error) => {
			console.log('Claude process error:', error.message);

			if (!this._currentClaudeProcess) {
				return;
			}

			// Clear process reference
			this._currentClaudeProcess = undefined;

			this._postMessage({
				type: 'clearLoading'
			});

			this._isProcessing = false;

			// Clear processing state
			this._postMessage({
				type: 'setProcessing',
				data: { isProcessing: false }
			});

			// Check if claude command is not installed
			if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
				this._sendAndSaveMessage({
					type: 'error',
					data: 'Install claude code first: https://www.anthropic.com/claude-code'
				});
			} else {
				this._sendAndSaveMessage({
					type: 'error',
					data: `Error running Claude: ${error.message}`
				});
			}
		});
	}

	private _processJsonStreamData(jsonData: any) {
		switch (jsonData.type) {
			case 'system':
				if (jsonData.subtype === 'init') {
					// System initialization message - session ID will be captured from final result
					console.log('System initialized');
					this._currentSessionId = jsonData.session_id;
					//this._sendAndSaveMessage({ type: 'init', data: { sessionId: jsonData.session_id; } })

					// Show session info in UI
					this._sendAndSaveMessage({
						type: 'sessionInfo',
						data: {
							sessionId: jsonData.session_id,
							tools: jsonData.tools || [],
							mcpServers: jsonData.mcp_servers || []
						}
					});
				}
				break;

			case 'assistant':
				if (jsonData.message && jsonData.message.content) {
					// Track token usage in real-time if available
					if (jsonData.message.usage) {
						this._totalTokensInput += jsonData.message.usage.input_tokens || 0;
						this._totalTokensOutput += jsonData.message.usage.output_tokens || 0;

						// Send real-time token update to webview
						this._sendAndSaveMessage({
							type: 'updateTokens',
							data: {
								totalTokensInput: this._totalTokensInput,
								totalTokensOutput: this._totalTokensOutput,
								currentInputTokens: jsonData.message.usage.input_tokens || 0,
								currentOutputTokens: jsonData.message.usage.output_tokens || 0,
								cacheCreationTokens: jsonData.message.usage.cache_creation_input_tokens || 0,
								cacheReadTokens: jsonData.message.usage.cache_read_input_tokens || 0
							}
						});
					}

					// Process each content item in the assistant message
					for (const content of jsonData.message.content) {
						if (content.type === 'text' && content.text.trim()) {
							// Show text content and save to conversation
							this._sendAndSaveMessage({
								type: 'output',
								data: content.text.trim()
							});

							// Track assistant message in context window manager
							this._trackContextMessage('assistant', content.text.trim());

							// Track assistant response for context preservation (used when resuming after thinking blocks fails)
							const summaryText = content.text.length > 2000
								? content.text.substring(0, 2000) + '...[truncated]'
								: content.text;
							this._conversationContext.push({
								role: 'assistant',
								content: summaryText
							});
						} else if (content.type === 'thinking' && content.thinking) {
							// Track that this response had thinking content - used to avoid resume issues
							this._lastResponseHadThinking = true;

							// Show thinking content and save to conversation
							// NOTE: Do NOT use .trim() - thinking blocks must be preserved exactly for API
							this._sendAndSaveMessage({
								type: 'thinking',
								data: content.thinking
							});
						} else if (content.type === 'tool_use') {
							// Show tool execution with better formatting
							const toolInfo = `🔧 Executing: ${content.name}`;
							let toolInput = '';

							if (content.input) {
								// Special formatting for TodoWrite to make it more readable
								if (content.name === 'TodoWrite' && content.input.todos) {
									toolInput = '\nTodo List Update:';
									for (const todo of content.input.todos) {
										const status = todo.status === 'completed' ? '✅' :
											todo.status === 'in_progress' ? '🔄' : '⏳';
										toolInput += `\n${status} ${todo.content} (priority: ${todo.priority})`;
									}
								} else {
									// Send raw input to UI for formatting
									toolInput = '';
								}
							}

							// Show tool use and save to conversation
							this._sendAndSaveMessage({
								type: 'toolUse',
								data: {
									toolInfo: toolInfo,
									toolInput: toolInput,
									rawInput: content.input,
									toolName: content.name
								}
							});
						}
					}
				}
				break;

			case 'user':
				if (jsonData.message && jsonData.message.content) {
					// Process tool results from user messages
					for (const content of jsonData.message.content) {
						if (content.type === 'tool_result') {
							let resultContent = content.content || 'Tool executed successfully';

							// Stringify if content is an object or array
							if (typeof resultContent === 'object' && resultContent !== null) {
								resultContent = JSON.stringify(resultContent, null, 2);
							}

							const isError = content.is_error || false;

							// Find the last tool use to get the tool name
							const lastToolUse = this._currentConversation[this._currentConversation.length - 1]

							const toolName = lastToolUse?.data?.toolName;

							// Don't send tool result for Read and Edit tools unless there's an error
							if ((toolName === 'Read' || toolName === 'Edit' || toolName === 'TodoWrite' || toolName === 'MultiEdit') && !isError) {
								// Still send to UI to hide loading state, but mark it as hidden
								this._sendAndSaveMessage({
									type: 'toolResult',
									data: {
										content: resultContent,
										isError: isError,
										toolUseId: content.tool_use_id,
										toolName: toolName,
										hidden: true
									}
								});
							} else {
								// Show tool result and save to conversation
								this._sendAndSaveMessage({
									type: 'toolResult',
									data: {
										content: resultContent,
										isError: isError,
										toolUseId: content.tool_use_id,
										toolName: toolName
									}
								});
							}
						}
					}
				}
				break;

			case 'result':
				if (jsonData.subtype === 'success') {
					// Check for login errors
					if (jsonData.is_error && jsonData.result && jsonData.result.includes('Invalid API key')) {
						this._handleLoginRequired();
						return;
					}

					this._isProcessing = false;

					// Capture session ID from final result
					if (jsonData.session_id) {
						const isNewSession = !this._currentSessionId;
						const sessionChanged = this._currentSessionId && this._currentSessionId !== jsonData.session_id;

						console.log('Session ID found in result:', {
							sessionId: jsonData.session_id,
							isNewSession,
							sessionChanged,
							currentSessionId: this._currentSessionId
						});

						this._currentSessionId = jsonData.session_id;

						// Show session info in UI
						this._sendAndSaveMessage({
							type: 'sessionInfo',
							data: {
								sessionId: jsonData.session_id,
								tools: jsonData.tools || [],
								mcpServers: jsonData.mcp_servers || []
							}
						});
					}

					// Clear processing state
					this._postMessage({
						type: 'setProcessing',
						data: { isProcessing: false }
					});

					// Update cumulative tracking
					this._requestCount++;
					if (jsonData.total_cost_usd) {
						this._totalCost += jsonData.total_cost_usd;
					}

					console.log('Result received:', {
						cost: jsonData.total_cost_usd,
						duration: jsonData.duration_ms,
						turns: jsonData.num_turns
					});

					// Send updated totals to webview
					this._postMessage({
						type: 'updateTotals',
						data: {
							totalCost: this._totalCost,
							totalTokensInput: this._totalTokensInput,
							totalTokensOutput: this._totalTokensOutput,
							requestCount: this._requestCount,
							currentCost: jsonData.total_cost_usd,
							currentDuration: jsonData.duration_ms,
							currentTurns: jsonData.num_turns
						}
					});
				}
				break;
		}
	}


	private _newSession() {

		this._isProcessing = false

		// Update UI state
		this._postMessage({
			type: 'setProcessing',
			data: { isProcessing: false }
		});

		// Try graceful termination first
		if (this._currentClaudeProcess) {
			const processToKill = this._currentClaudeProcess;
			this._currentClaudeProcess = undefined;
			processToKill.kill('SIGTERM');
		}

		// Clear current session
		this._currentSessionId = undefined;

		// Clear commits and conversation
		this._commits = [];
		this._currentConversation = [];
		this._conversationContext = [];
		this._lastResponseHadThinking = false;

		// Clear context window manager
		this._clearContextOnNewSession();
		this._conversationStartTime = undefined;

		// Reset counters
		this._totalCost = 0;
		this._totalTokensInput = 0;
		this._totalTokensOutput = 0;
		this._requestCount = 0;

		// Reset session token tracking for smart memory
		this._sessionEstimatedTokens = 0;
		this._sessionMessageCount = 0;
		this._lastSessionCompaction = null;

		// Notify webview to clear all messages and reset session
		this._postMessage({
			type: 'sessionCleared'
		});

		console.log('New session started - session token tracking reset');
	}

	public newSessionOnConfigChange() {
		// Reinitialize MCP config with new WSL paths
		this._initializeMCPConfig();

		// Start a new session due to configuration change
		this._newSession();

		// Show notification to user
		vscode.window.showInformationMessage(
			'WSL configuration changed. Started a new Claude session.',
			'OK'
		);

		// Send message to webview about the config change
		this._sendAndSaveMessage({
			type: 'configChanged',
			data: '⚙️ WSL configuration changed. Started a new session.'
		});
	}

	private _handleLoginRequired() {

		this._isProcessing = false;

		// Clear processing state
		this._postMessage({
			type: 'setProcessing',
			data: { isProcessing: false }
		});

		// Show login required message
		this._postMessage({
			type: 'loginRequired'
		});

		// Get configuration to check if WSL is enabled
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const wslEnabled = config.get<boolean>('wsl.enabled', false);
		const wslDistro = config.get<string>('wsl.distro', 'Ubuntu');
		const nodePath = config.get<string>('wsl.nodePath', '/usr/bin/node');
		const claudePath = config.get<string>('wsl.claudePath', '/usr/local/bin/claude');

		// Open terminal and run claude login
		const terminal = vscode.window.createTerminal('Claude Login');
		if (wslEnabled) {
			terminal.sendText(`wsl -d ${wslDistro} ${nodePath} --no-warnings --enable-source-maps ${claudePath}`);
		} else {
			terminal.sendText('claude');
		}
		terminal.show();

		// Show info message
		vscode.window.showInformationMessage(
			'Please login to Claude in the terminal, then come back to this chat to continue.',
			'OK'
		);

		// Send message to UI about terminal
		this._postMessage({
			type: 'terminalOpened',
			data: `Please login to Claude in the terminal, then come back to this chat to continue.`,
		});
	}

	private async _initializeBackupRepo(): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) { return; }

			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) {
				console.error('No workspace storage available');
				return;
			}
			console.log('Workspace storage path:', storagePath);
			this._backupRepoPath = path.join(storagePath, 'backups', '.git');

			// Create backup git directory if it doesn't exist
			try {
				await vscode.workspace.fs.stat(vscode.Uri.file(this._backupRepoPath));
			} catch {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(this._backupRepoPath));

				const workspacePath = workspaceFolder.uri.fsPath;

				// Initialize git repo with workspace as work-tree
				await exec(`git --git-dir="${this._backupRepoPath}" --work-tree="${workspacePath}" init`);
				await exec(`git --git-dir="${this._backupRepoPath}" config user.name "Claude Code Chat"`);
				await exec(`git --git-dir="${this._backupRepoPath}" config user.email "claude@anthropic.com"`);

				console.log(`Initialized backup repository at: ${this._backupRepoPath}`);
			}
		} catch (error: any) {
			console.error('Failed to initialize backup repository:', error.message);
		}
	}

	private async _createBackupCommit(userMessage: string): Promise<void> {
		// Use Enhanced Checkpoint Manager if available
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			try {
				// Count only user messages to match the UI messageIndex (which only tracks user messages)
				// This ensures the checkpoint messageIndex matches the UI data-message-index attribute
				const userMessageCount = this._currentConversation.filter(m => m.messageType === 'userInput').length;

				const checkpoint = await this._checkpointManager.createCheckpoint(
					userMessage,
					this._currentSessionId,
					userMessageCount  // Use user message count instead of total conversation length
				);

				if (checkpoint) {
					// Store commit info for compatibility (use id as sha for backwards compatibility)
					const commitInfo = {
						id: checkpoint.id,
						sha: checkpoint.id,  // Use checkpoint id as sha for compatibility
						message: checkpoint.message,
						timestamp: checkpoint.timestamp,
						fileCount: checkpoint.files.length,
						changedFiles: checkpoint.files.map(f => f.relativePath)
					};

					this._commits.push(commitInfo);

					// Show restore option in UI with enhanced data
					this._sendAndSaveMessage({
						type: 'showRestoreOption',
						data: {
							...commitInfo,
							enhanced: true,
							previewAvailable: true
						}
					});

					console.log(`Enhanced checkpoint created: ${checkpoint.id.substring(0, 12)} - ${checkpoint.message}`);
					console.log(`Files tracked: ${checkpoint.files.length}`);
					return;
				}
			} catch (error: any) {
				console.error('Enhanced checkpoint failed, falling back to legacy:', error.message);
			}
		}

		// Legacy checkpoint system (fallback)
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder || !this._backupRepoPath) { return; }

			const workspacePath = workspaceFolder.uri.fsPath;
			const now = new Date();
			const timestamp = now.toISOString().replace(/[:.]/g, '-');
			const displayTimestamp = now.toISOString();
			const commitMessage = `Before: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`;

			// Add all files using git-dir and work-tree (excludes .git automatically)
			await exec(`git --git-dir="${this._backupRepoPath}" --work-tree="${workspacePath}" add -A`);

			// Check if this is the first commit (no HEAD exists yet)
			let isFirstCommit = false;
			try {
				await exec(`git --git-dir="${this._backupRepoPath}" rev-parse HEAD`);
			} catch {
				isFirstCommit = true;
			}

			// Check if there are changes to commit
			const { stdout: status } = await exec(`git --git-dir="${this._backupRepoPath}" --work-tree="${workspacePath}" status --porcelain`);

			// Always create a checkpoint, even if no files changed
			let actualMessage;
			if (isFirstCommit) {
				actualMessage = `Initial backup: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`;
			} else if (status.trim()) {
				actualMessage = commitMessage;
			} else {
				actualMessage = `Checkpoint (no changes): ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`;
			}

			// Create commit with --allow-empty to ensure checkpoint is always created
			await exec(`git --git-dir="${this._backupRepoPath}" --work-tree="${workspacePath}" commit --allow-empty -m "${actualMessage}"`);
			const { stdout: sha } = await exec(`git --git-dir="${this._backupRepoPath}" rev-parse HEAD`);

			// Store commit info
			const commitInfo = {
				id: `commit-${timestamp}`,
				sha: sha.trim(),
				message: actualMessage,
				timestamp: displayTimestamp
			};

			this._commits.push(commitInfo);

			// Show restore option in UI and save to conversation
			this._sendAndSaveMessage({
				type: 'showRestoreOption',
				data: commitInfo
			});

			console.log(`Created backup commit: ${commitInfo.sha.substring(0, 8)} - ${actualMessage}`);
		} catch (error: any) {
			console.error('Failed to create backup commit:', error.message);
		}
	}


	private async _restoreToCommit(commitSha: string): Promise<void> {
		// Use Enhanced Checkpoint Manager if available
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			try {
				this._postMessage({
					type: 'restoreProgress',
					data: 'Restoring files from checkpoint...'
				});

				const result = await this._checkpointManager.restoreToCheckpoint(commitSha, {
					confirmBeforeRestore: false,
					createBackupBeforeRestore: true,
					preserveUntracked: true
				});

				if (result.success) {
					vscode.window.showInformationMessage(result.message);

					this._sendAndSaveMessage({
						type: 'restoreSuccess',
						data: {
							message: result.message,
							commitSha: commitSha,
							restoredFiles: result.restoredFiles
						}
					});

					// Update commits list to remove checkpoints after restored one
					const checkpoint = this._checkpointManager.getCheckpoint(commitSha);
					if (checkpoint) {
						const commitIndex = this._commits.findIndex(c => c.sha === commitSha || c.id === commitSha);
						if (commitIndex !== -1) {
							this._commits = this._commits.slice(0, commitIndex + 1);
						}
					}

					console.log(`Enhanced restore successful: ${result.restoredFiles?.length || 0} files restored`);
					return;
				} else {
					throw new Error(result.message);
				}
			} catch (error: any) {
				console.error('Enhanced restore failed, falling back to legacy:', error.message);
			}
		}

		// Legacy restore system (fallback)
		try {
			const commit = this._commits.find(c => c.sha === commitSha);
			if (!commit) {
				this._postMessage({
					type: 'restoreError',
					data: 'Commit not found'
				});
				return;
			}

			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder || !this._backupRepoPath) {
				vscode.window.showErrorMessage('No workspace folder or backup repository available.');
				return;
			}

			const workspacePath = workspaceFolder.uri.fsPath;

			this._postMessage({
				type: 'restoreProgress',
				data: 'Restoring files from backup...'
			});

			// Restore files directly to workspace using git checkout
			await exec(`git --git-dir="${this._backupRepoPath}" --work-tree="${workspacePath}" checkout ${commitSha} -- .`);

			vscode.window.showInformationMessage(`Restored to commit: ${commit.message}`);

			this._sendAndSaveMessage({
				type: 'restoreSuccess',
				data: {
					message: `Successfully restored to: ${commit.message}`,
					commitSha: commitSha
				}
			});

		} catch (error: any) {
			console.error('Failed to restore commit:', error.message);
			vscode.window.showErrorMessage(`Failed to restore commit: ${error.message}`);
			this._postMessage({
				type: 'restoreError',
				data: `Failed to restore: ${error.message}`
			});
		}
	}

	// Enhanced checkpoint management methods

	private _sendCheckpointsList(): void {
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			const checkpoints = this._checkpointManager.getCheckpoints();
			this._postMessage({
				type: 'checkpointsList',
				data: checkpoints
			});
		} else {
			this._postMessage({
				type: 'checkpointsList',
				data: this._commits
			});
		}
	}

	private async _previewCheckpointRestore(checkpointId: string): Promise<void> {
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			try {
				const preview = await this._checkpointManager.previewRestore(checkpointId);
				const checkpoint = this._checkpointManager.getCheckpoint(checkpointId);

				if (!preview) {
					console.error('Preview returned null for checkpoint:', checkpointId);
					this._postMessage({
						type: 'restorePreviewError',
						data: 'Failed to generate preview - checkpoint may not exist'
					});
					return;
				}

				console.log(`Preview restore: ${preview.filesToRestore.length} to restore, ${preview.filesToDelete.length} to delete, ${preview.totalChanges} total changes`);

				this._postMessage({
					type: 'restorePreview',
					data: {
						checkpoint: checkpoint,
						filesToRestore: preview.filesToRestore || [],
						filesToDelete: preview.filesToDelete || [],
						currentChanges: preview.currentChanges || [],
						totalChanges: preview.totalChanges || 0
					}
				});
			} catch (error: any) {
				console.error('Failed to preview restore:', error.message);
				this._postMessage({
					type: 'restorePreviewError',
					data: `Failed to preview: ${error.message}`
				});
			}
		} else {
			// Legacy: no preview available
			this._postMessage({
				type: 'restorePreview',
				data: {
					checkpoint: this._commits.find(c => c.sha === checkpointId || c.id === checkpointId),
					filesToRestore: [],
					filesToDelete: [],
					currentChanges: [],
					totalChanges: 0,
					legacyMode: true
				}
			});
		}
	}

	private async _confirmRestoreCheckpoint(checkpointId: string, options?: RestoreOptions): Promise<void> {
		// User has already confirmed via webview modal - execute restore directly
		const checkpoint = this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()
			? this._checkpointManager.getCheckpoint(checkpointId)
			: this._commits.find(c => c.sha === checkpointId || c.id === checkpointId);

		if (!checkpoint) {
			this._postMessage({
				type: 'restoreError',
				data: 'Checkpoint not found'
			});
			return;
		}

		console.log(`Confirm restore: checkpointId=${checkpointId}, createBackup=${options?.createBackupBeforeRestore}`);

		// Use Enhanced Checkpoint Manager if available
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			try {
				this._postMessage({
					type: 'restoreProgress',
					data: options?.createBackupBeforeRestore
						? 'Creating backup of current state before restore...'
						: 'Restoring files from checkpoint...'
				});

				const result = await this._checkpointManager.restoreToCheckpoint(checkpointId, {
					confirmBeforeRestore: false,
					createBackupBeforeRestore: options?.createBackupBeforeRestore || false,
					preserveUntracked: false  // Delete files added after checkpoint
				});

				if (result.success) {
					const backupInfo = result.backupCheckpointId
						? ` (Backup created: ${result.backupCheckpointId.substring(0, 12)}...)`
						: '';

					vscode.window.showInformationMessage(`${result.message}${backupInfo}`);

					this._sendAndSaveMessage({
						type: 'restoreSuccess',
						data: {
							message: `${result.message}${backupInfo}`,
							commitSha: checkpointId,
							restoredFiles: result.restoredFiles,
							backupCheckpointId: result.backupCheckpointId
						}
					});

					// If a backup was created, notify the UI that "Restore From Backup" is available
					if (result.backupCheckpointId) {
						this._checkRestoreBackupAvailable();
					}

					console.log(`Enhanced restore successful: ${result.restoredFiles?.length || 0} files restored`);
					return;
				} else {
					throw new Error(result.message);
				}
			} catch (error: any) {
				console.error('Enhanced restore failed:', error.message);
				vscode.window.showErrorMessage(`Restore failed: ${error.message}`);
				this._postMessage({
					type: 'restoreError',
					data: `Restore failed: ${error.message}`
				});
				return;
			}
		}

		// Legacy restore - fall back to git-based restore
		await this._restoreToCommit(checkpointId);
	}

	private _sendCheckpointStats(): void {
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			const stats = this._checkpointManager.getStats();
			this._postMessage({
				type: 'checkpointStats',
				data: {
					...stats,
					enhanced: true
				}
			});
		} else {
			this._postMessage({
				type: 'checkpointStats',
				data: {
					totalCheckpoints: this._commits.length,
					trackedFiles: 0,
					enhanced: false
				}
			});
		}
	}

	private async _clearAllCheckpoints(): Promise<void> {
		const selection = await vscode.window.showWarningMessage(
			'Are you sure you want to clear all checkpoints? This cannot be undone.',
			{ modal: true },
			'Clear All'
		);

		if (selection !== 'Clear All') {
			return;
		}

		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			const success = await this._checkpointManager.clearAllCheckpoints();
			if (success) {
				this._commits = [];
				vscode.window.showInformationMessage('All checkpoints cleared.');
				this._postMessage({
					type: 'checkpointsCleared',
					data: { success: true }
				});
			} else {
				vscode.window.showErrorMessage('Failed to clear checkpoints.');
			}
		} else {
			this._commits = [];
			vscode.window.showInformationMessage('All checkpoints cleared.');
			this._postMessage({
				type: 'checkpointsCleared',
				data: { success: true }
			});
		}
	}

	/**
	 * Restore from the last backup (undo restore operation)
	 */
	private async _restoreFromBackup(): Promise<void> {
		if (!this._useEnhancedCheckpoints || !this._checkpointManager.isInitialized()) {
			this._postMessage({
				type: 'restoreFromBackupResult',
				data: {
					success: false,
					message: 'Enhanced checkpoint system not available'
				}
			});
			return;
		}

		const backup = this._checkpointManager.getLastRestoreBackup();
		if (!backup) {
			this._postMessage({
				type: 'restoreFromBackupResult',
				data: {
					success: false,
					message: 'No restore backup available. Use "Restore (Keep Backup)" first.'
				}
			});
			vscode.window.showWarningMessage('No restore backup available. Use "Restore (Keep Backup)" first to create a backup.');
			return;
		}

		this._postMessage({
			type: 'restoreProgress',
			data: 'Restoring from backup...'
		});

		const result = await this._checkpointManager.restoreFromBackup();

		if (result.success) {
			vscode.window.showInformationMessage(result.message);
			this._postMessage({
				type: 'restoreFromBackupResult',
				data: {
					success: true,
					message: result.message,
					restoredFiles: result.restoredFiles
				}
			});

			// Notify that backup is no longer available
			this._checkRestoreBackupAvailable();
		} else {
			vscode.window.showErrorMessage(result.message);
			this._postMessage({
				type: 'restoreFromBackupResult',
				data: {
					success: false,
					message: result.message
				}
			});
		}
	}

	/**
	 * Check if a restore backup is available
	 */
	private _checkRestoreBackupAvailable(): void {
		if (this._useEnhancedCheckpoints && this._checkpointManager.isInitialized()) {
			const hasBackup = this._checkpointManager.hasRestoreBackup();
			const backup = this._checkpointManager.getLastRestoreBackup();

			this._postMessage({
				type: 'restoreBackupStatus',
				data: {
					available: hasBackup,
					backup: backup ? {
						id: backup.id,
						timestamp: backup.timestamp,
						message: backup.message
					} : null
				}
			});
		} else {
			this._postMessage({
				type: 'restoreBackupStatus',
				data: {
					available: false,
					backup: null
				}
			});
		}
	}

	/**
	 * Send current context window statistics to the webview
	 */
	private _sendContextStats(): void {
		const stats = this._contextWindowManager.getStats();
		this._postMessage({
			type: 'contextStats',
			data: stats
		});
	}

	/**
	 * Handle manual context compaction request
	 */
	private async _manualCompactContext(): Promise<void> {
		console.log('Manual context compaction requested');

		try {
			const result = await this._contextWindowManager.compressContext();

			if (result.success) {
				console.log(`Manual compression: ${result.messagesCompressed} messages compressed, ratio: ${result.compressionRatio.toFixed(2)}`);

				this._postMessage({
					type: 'contextCompacted',
					data: {
						messagesCompressed: result.messagesCompressed,
						compressionRatio: result.compressionRatio,
						originalTokens: result.originalTokens,
						compressedTokens: result.compressedTokens,
						stats: this._contextWindowManager.getStats()
					}
				});

				vscode.window.showInformationMessage(
					`Context compacted: ${result.messagesCompressed} messages summarized (${result.compressionRatio.toFixed(1)}x compression)`
				);
			} else {
				this._postMessage({
					type: 'contextCompactError',
					data: 'Unable to compact - not enough messages to compress'
				});

				vscode.window.showWarningMessage('Context compaction not needed - conversation is short enough');
			}
		} catch (error: any) {
			console.error('Manual compaction failed:', error.message);
			this._postMessage({
				type: 'contextCompactError',
				data: error.message
			});
			vscode.window.showErrorMessage(`Context compaction failed: ${error.message}`);
		}
	}

	/**
	 * Estimate token count for a text string
	 * Uses rough approximation: ~4 characters per token for English text
	 */
	private _estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	/**
	 * Track a message in the context window manager, project context manager, and project memory
	 */
	private _trackContextMessage(role: 'user' | 'assistant' | 'system', content: string): void {
		this._contextWindowManager.addMessage(role, content);

		// Update session token tracking
		this._sessionEstimatedTokens += this._estimateTokens(content);

		// Also track in project context manager for persistent storage
		if (this._projectContextManager) {
			this._projectContextManager.addMessage(role, content).catch(err => {
				console.error('Failed to add message to project context:', err.message);
			});
		}

		// Record in project memory for knowledge graph (fire and forget with error handling)
		if (this._projectMemoryManager && (role === 'user' || role === 'assistant')) {
			this._recordConversationInMemory(role, content).catch(err => {
				console.error('ChatProvider: Failed to record conversation in memory:', err.message);
			});
		}
	}

	/**
	 * Update the last assistant message (for streaming responses)
	 */
	private _updateContextLastAssistantMessage(content: string): void {
		this._contextWindowManager.updateLastAssistantMessage(content);
	}

	/**
	 * Clear context when starting a new session
	 */
	private _clearContextOnNewSession(): void {
		this._contextWindowManager.clearConversation();
		this._sendContextStats();
	}

	private async _initializeConversations(): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) { return; }

			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) { return; }

			this._conversationsPath = path.join(storagePath, 'conversations');

			// Create conversations directory if it doesn't exist
			try {
				await vscode.workspace.fs.stat(vscode.Uri.file(this._conversationsPath));
			} catch {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(this._conversationsPath));
				console.log(`Created conversations directory at: ${this._conversationsPath}`);
			}
		} catch (error: any) {
			console.error('Failed to initialize conversations directory:', error.message);
		}
	}

	private async _initializeMCPConfig(): Promise<void> {
		try {
			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) { return; }

			// Create MCP config directory
			const mcpConfigDir = path.join(storagePath, 'mcp');
			try {
				await vscode.workspace.fs.stat(vscode.Uri.file(mcpConfigDir));
			} catch {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(mcpConfigDir));
				console.log(`Created MCP config directory at: ${mcpConfigDir}`);
			}

			// Create or update mcp-servers.json with permissions server, preserving existing servers
			const mcpConfigPath = path.join(mcpConfigDir, 'mcp-servers.json');
			const mcpPermissionsPath = this.convertToWSLPath(path.join(this._extensionUri.fsPath, 'mcp-permissions.js'));
			const permissionRequestsPath = this.convertToWSLPath(path.join(storagePath, 'permission-requests'));

			// Load existing config or create new one
			let mcpConfig: any = { mcpServers: {} };
			const mcpConfigUri = vscode.Uri.file(mcpConfigPath);

			try {
				const existingContent = await vscode.workspace.fs.readFile(mcpConfigUri);
				mcpConfig = JSON.parse(new TextDecoder().decode(existingContent));
				console.log('Loaded existing MCP config, preserving user servers');
			} catch {
				console.log('No existing MCP config found, creating new one');
			}

			// Ensure mcpServers exists
			if (!mcpConfig.mcpServers) {
				mcpConfig.mcpServers = {};
			}

			// Add or update the permissions server entry
			mcpConfig.mcpServers['claude-code-chat-permissions'] = {
				command: 'node',
				args: [mcpPermissionsPath],
				env: {
					CLAUDE_PERMISSIONS_PATH: permissionRequestsPath
				}
			};

			const configContent = new TextEncoder().encode(JSON.stringify(mcpConfig, null, 2));
			await vscode.workspace.fs.writeFile(mcpConfigUri, configContent);

			console.log(`Updated MCP config at: ${mcpConfigPath}`);
		} catch (error: any) {
			console.error('Failed to initialize MCP config:', error.message);
		}
	}

	private async _initializePermissions(): Promise<void> {
		try {

			if (this._permissionWatcher) {
				this._permissionWatcher.dispose();
				this._permissionWatcher = undefined;
			}

			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) { return; }

			// Create permission requests directory
			this._permissionRequestsPath = path.join(path.join(storagePath, 'permission-requests'));
			try {
				await vscode.workspace.fs.stat(vscode.Uri.file(this._permissionRequestsPath));
			} catch {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(this._permissionRequestsPath));
				console.log(`Created permission requests directory at: ${this._permissionRequestsPath}`);
			}

			console.log("DIRECTORY-----", this._permissionRequestsPath)

			// Set up file watcher for *.request files
			this._permissionWatcher = vscode.workspace.createFileSystemWatcher(
				new vscode.RelativePattern(this._permissionRequestsPath, '*.request')
			);

			this._permissionWatcher.onDidCreate(async (uri) => {
				// Only handle file scheme URIs, ignore vscode-userdata scheme
				if (uri.scheme === 'file') {
					await this._handlePermissionRequest(uri);
				}
			});

			this._disposables.push(this._permissionWatcher);

		} catch (error: any) {
			console.error('Failed to initialize permissions:', error.message);
		}
	}

	private async _handlePermissionRequest(requestUri: vscode.Uri): Promise<void> {
		try {
			// Read the request file
			const content = await vscode.workspace.fs.readFile(requestUri);
			const request = JSON.parse(new TextDecoder().decode(content));

			// Show permission dialog
			const approved = await this._showPermissionDialog(request);

			// Write response file
			const responseFile = requestUri.fsPath.replace('.request', '.response');
			const response = {
				id: request.id,
				approved: approved,
				timestamp: new Date().toISOString()
			};

			const responseContent = new TextEncoder().encode(JSON.stringify(response));
			await vscode.workspace.fs.writeFile(vscode.Uri.file(responseFile), responseContent);

			// Clean up request file
			await vscode.workspace.fs.delete(requestUri);

		} catch (error: any) {
			console.error('Failed to handle permission request:', error.message);
		}
	}

	private async _showPermissionDialog(request: any): Promise<boolean> {
		const toolName = request.tool || 'Unknown Tool';

		// Generate pattern for Bash commands
		let pattern = undefined;
		if (toolName === 'Bash' && request.input?.command) {
			pattern = this.getCommandPattern(request.input.command);
		}

		// Send permission request to the UI
		this._sendAndSaveMessage({
			type: 'permissionRequest',
			data: {
				id: request.id,
				tool: toolName,
				input: request.input,
				pattern: pattern
			}
		});

		// Wait for response from UI
		return new Promise((resolve) => {
			// Store the resolver so we can call it when we get the response
			this._pendingPermissionResolvers = this._pendingPermissionResolvers || new Map();
			this._pendingPermissionResolvers.set(request.id, resolve);
		});
	}

	private _handlePermissionResponse(id: string, approved: boolean, alwaysAllow?: boolean): void {
		if (this._pendingPermissionResolvers && this._pendingPermissionResolvers.has(id)) {
			const resolver = this._pendingPermissionResolvers.get(id);
			if (resolver) {
				resolver(approved);
				this._pendingPermissionResolvers.delete(id);

				// Handle always allow setting
				if (alwaysAllow && approved) {
					void this._saveAlwaysAllowPermission(id);
				}
			}
		}
	}

	private async _saveAlwaysAllowPermission(requestId: string): Promise<void> {
		try {
			// Read the original request to get tool name and input
			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) return;

			const requestFileUri = vscode.Uri.file(path.join(storagePath, 'permission-requests', `${requestId}.request`));

			let requestContent: Uint8Array;
			try {
				requestContent = await vscode.workspace.fs.readFile(requestFileUri);
			} catch {
				return; // Request file doesn't exist
			}

			const request = JSON.parse(new TextDecoder().decode(requestContent));

			// Load existing workspace permissions
			const permissionsUri = vscode.Uri.file(path.join(storagePath, 'permission-requests', 'permissions.json'));
			let permissions: any = { alwaysAllow: {} };

			try {
				const content = await vscode.workspace.fs.readFile(permissionsUri);
				permissions = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist yet, use default permissions
			}

			// Add the new permission
			const toolName = request.tool;
			if (toolName === 'Bash' && request.input?.command) {
				// For Bash, store the command pattern
				if (!permissions.alwaysAllow[toolName]) {
					permissions.alwaysAllow[toolName] = [];
				}
				if (Array.isArray(permissions.alwaysAllow[toolName])) {
					const command = request.input.command.trim();
					const pattern = this.getCommandPattern(command);
					if (!permissions.alwaysAllow[toolName].includes(pattern)) {
						permissions.alwaysAllow[toolName].push(pattern);
					}
				}
			} else {
				// For other tools, allow all instances
				permissions.alwaysAllow[toolName] = true;
			}

			// Ensure permissions directory exists
			const permissionsDir = vscode.Uri.file(path.dirname(permissionsUri.fsPath));
			try {
				await vscode.workspace.fs.stat(permissionsDir);
			} catch {
				await vscode.workspace.fs.createDirectory(permissionsDir);
			}

			// Save the permissions
			const permissionsContent = new TextEncoder().encode(JSON.stringify(permissions, null, 2));
			await vscode.workspace.fs.writeFile(permissionsUri, permissionsContent);

			console.log(`Saved always-allow permission for ${toolName}`);
		} catch (error) {
			console.error('Error saving always-allow permission:', error);
		}
	}

	private getCommandPattern(command: string): string {
		const parts = command.trim().split(/\s+/);
		if (parts.length === 0) return command;

		const baseCmd = parts[0];
		const subCmd = parts.length > 1 ? parts[1] : '';

		// Common patterns that should use wildcards
		const patterns = [
			// Package managers
			['npm', 'install', 'npm install *'],
			['npm', 'i', 'npm i *'],
			['npm', 'add', 'npm add *'],
			['npm', 'remove', 'npm remove *'],
			['npm', 'uninstall', 'npm uninstall *'],
			['npm', 'update', 'npm update *'],
			['npm', 'run', 'npm run *'],
			['yarn', 'add', 'yarn add *'],
			['yarn', 'remove', 'yarn remove *'],
			['yarn', 'install', 'yarn install *'],
			['pnpm', 'install', 'pnpm install *'],
			['pnpm', 'add', 'pnpm add *'],
			['pnpm', 'remove', 'pnpm remove *'],

			// Git commands
			['git', 'add', 'git add *'],
			['git', 'commit', 'git commit *'],
			['git', 'push', 'git push *'],
			['git', 'pull', 'git pull *'],
			['git', 'checkout', 'git checkout *'],
			['git', 'branch', 'git branch *'],
			['git', 'merge', 'git merge *'],
			['git', 'clone', 'git clone *'],
			['git', 'reset', 'git reset *'],
			['git', 'rebase', 'git rebase *'],
			['git', 'tag', 'git tag *'],

			// Docker commands
			['docker', 'run', 'docker run *'],
			['docker', 'build', 'docker build *'],
			['docker', 'exec', 'docker exec *'],
			['docker', 'logs', 'docker logs *'],
			['docker', 'stop', 'docker stop *'],
			['docker', 'start', 'docker start *'],
			['docker', 'rm', 'docker rm *'],
			['docker', 'rmi', 'docker rmi *'],
			['docker', 'pull', 'docker pull *'],
			['docker', 'push', 'docker push *'],

			// Build tools
			['make', '', 'make *'],
			['cargo', 'build', 'cargo build *'],
			['cargo', 'run', 'cargo run *'],
			['cargo', 'test', 'cargo test *'],
			['cargo', 'install', 'cargo install *'],
			['mvn', 'compile', 'mvn compile *'],
			['mvn', 'test', 'mvn test *'],
			['mvn', 'package', 'mvn package *'],
			['gradle', 'build', 'gradle build *'],
			['gradle', 'test', 'gradle test *'],

			// System commands
			['curl', '', 'curl *'],
			['wget', '', 'wget *'],
			['ssh', '', 'ssh *'],
			['scp', '', 'scp *'],
			['rsync', '', 'rsync *'],
			['tar', '', 'tar *'],
			['zip', '', 'zip *'],
			['unzip', '', 'unzip *'],

			// Development tools
			['node', '', 'node *'],
			['python', '', 'python *'],
			['python3', '', 'python3 *'],
			['pip', 'install', 'pip install *'],
			['pip3', 'install', 'pip3 install *'],
			['composer', 'install', 'composer install *'],
			['composer', 'require', 'composer require *'],
			['bundle', 'install', 'bundle install *'],
			['gem', 'install', 'gem install *'],
		];

		// Find matching pattern
		for (const [cmd, sub, pattern] of patterns) {
			if (baseCmd === cmd && (sub === '' || subCmd === sub)) {
				return pattern;
			}
		}

		// Default: return exact command
		return command;
	}

	private async _sendPermissions(): Promise<void> {
		try {
			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) {
				this._postMessage({
					type: 'permissionsData',
					data: { alwaysAllow: {} }
				});
				return;
			}

			const permissionsUri = vscode.Uri.file(path.join(storagePath, 'permission-requests', 'permissions.json'));
			let permissions: any = { alwaysAllow: {} };

			try {
				const content = await vscode.workspace.fs.readFile(permissionsUri);
				permissions = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist or can't be read, use default permissions
			}

			this._postMessage({
				type: 'permissionsData',
				data: permissions
			});
		} catch (error) {
			console.error('Error sending permissions:', error);
			this._postMessage({
				type: 'permissionsData',
				data: { alwaysAllow: {} }
			});
		}
	}

	private async _removePermission(toolName: string, command: string | null): Promise<void> {
		try {
			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) return;

			const permissionsUri = vscode.Uri.file(path.join(storagePath, 'permission-requests', 'permissions.json'));
			let permissions: any = { alwaysAllow: {} };

			try {
				const content = await vscode.workspace.fs.readFile(permissionsUri);
				permissions = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist or can't be read, nothing to remove
				return;
			}

			// Remove the permission
			if (command === null) {
				// Remove entire tool permission
				delete permissions.alwaysAllow[toolName];
			} else {
				// Remove specific command from tool permissions
				if (Array.isArray(permissions.alwaysAllow[toolName])) {
					permissions.alwaysAllow[toolName] = permissions.alwaysAllow[toolName].filter(
						(cmd: string) => cmd !== command
					);
					// If no commands left, remove the tool entirely
					if (permissions.alwaysAllow[toolName].length === 0) {
						delete permissions.alwaysAllow[toolName];
					}
				}
			}

			// Save updated permissions
			const permissionsContent = new TextEncoder().encode(JSON.stringify(permissions, null, 2));
			await vscode.workspace.fs.writeFile(permissionsUri, permissionsContent);

			// Send updated permissions to UI
			this._sendPermissions();

			console.log(`Removed permission for ${toolName}${command ? ` command: ${command}` : ''}`);
		} catch (error) {
			console.error('Error removing permission:', error);
		}
	}

	private async _addPermission(toolName: string, command: string | null): Promise<void> {
		try {
			const storagePath = this._context.storageUri?.fsPath;
			if (!storagePath) return;

			const permissionsUri = vscode.Uri.file(path.join(storagePath, 'permission-requests', 'permissions.json'));
			let permissions: any = { alwaysAllow: {} };

			try {
				const content = await vscode.workspace.fs.readFile(permissionsUri);
				permissions = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist, use default permissions
			}

			// Add the new permission
			if (command === null || command === '') {
				// Allow all commands for this tool
				permissions.alwaysAllow[toolName] = true;
			} else {
				// Add specific command pattern
				if (!permissions.alwaysAllow[toolName]) {
					permissions.alwaysAllow[toolName] = [];
				}

				// Convert to array if it's currently set to true
				if (permissions.alwaysAllow[toolName] === true) {
					permissions.alwaysAllow[toolName] = [];
				}

				if (Array.isArray(permissions.alwaysAllow[toolName])) {
					// For Bash commands, convert to pattern using existing logic
					let commandToAdd = command;
					if (toolName === 'Bash') {
						commandToAdd = this.getCommandPattern(command);
					}

					// Add if not already present
					if (!permissions.alwaysAllow[toolName].includes(commandToAdd)) {
						permissions.alwaysAllow[toolName].push(commandToAdd);
					}
				}
			}

			// Ensure permissions directory exists
			const permissionsDir = vscode.Uri.file(path.dirname(permissionsUri.fsPath));
			try {
				await vscode.workspace.fs.stat(permissionsDir);
			} catch {
				await vscode.workspace.fs.createDirectory(permissionsDir);
			}

			// Save updated permissions
			const permissionsContent = new TextEncoder().encode(JSON.stringify(permissions, null, 2));
			await vscode.workspace.fs.writeFile(permissionsUri, permissionsContent);

			// Send updated permissions to UI
			this._sendPermissions();

			console.log(`Added permission for ${toolName}${command ? ` command: ${command}` : ' (all commands)'}`);
		} catch (error) {
			console.error('Error adding permission:', error);
		}
	}

	private async _loadMCPServers(): Promise<void> {
		try {
			const mcpConfigPath = this.getMCPConfigPath();
			if (!mcpConfigPath) {
				this._postMessage({ type: 'mcpServers', data: {} });
				return;
			}

			const mcpConfigUri = vscode.Uri.file(mcpConfigPath);
			let mcpConfig: any = { mcpServers: {} };

			try {
				const content = await vscode.workspace.fs.readFile(mcpConfigUri);
				mcpConfig = JSON.parse(new TextDecoder().decode(content));
			} catch (error) {
				console.log('MCP config file not found or error reading:', error);
				// File doesn't exist, return empty servers
			}

			// Filter out internal servers before sending to UI
			const filteredServers = Object.fromEntries(
				Object.entries(mcpConfig.mcpServers || {}).filter(([name]) => name !== 'claude-code-chat-permissions')
			);
			this._postMessage({ type: 'mcpServers', data: filteredServers });
		} catch (error) {
			console.error('Error loading MCP servers:', error);
			this._postMessage({ type: 'mcpServerError', data: { error: 'Failed to load MCP servers' } });
		}
	}

	private async _saveMCPServer(name: string, config: any): Promise<void> {
		try {
			const mcpConfigPath = this.getMCPConfigPath();
			if (!mcpConfigPath) {
				this._postMessage({ type: 'mcpServerError', data: { error: 'Storage path not available' } });
				return;
			}

			const mcpConfigUri = vscode.Uri.file(mcpConfigPath);
			let mcpConfig: any = { mcpServers: {} };

			// Load existing config
			try {
				const content = await vscode.workspace.fs.readFile(mcpConfigUri);
				mcpConfig = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist, use default structure
			}

			// Ensure mcpServers exists
			if (!mcpConfig.mcpServers) {
				mcpConfig.mcpServers = {};
			}

			// Add/update the server
			mcpConfig.mcpServers[name] = config;

			// Ensure directory exists
			const mcpDir = vscode.Uri.file(path.dirname(mcpConfigPath));
			try {
				await vscode.workspace.fs.stat(mcpDir);
			} catch {
				await vscode.workspace.fs.createDirectory(mcpDir);
			}

			// Save the config
			const configContent = new TextEncoder().encode(JSON.stringify(mcpConfig, null, 2));
			await vscode.workspace.fs.writeFile(mcpConfigUri, configContent);

			this._postMessage({ type: 'mcpServerSaved', data: { name } });
			console.log(`Saved MCP server: ${name}`);
		} catch (error) {
			console.error('Error saving MCP server:', error);
			this._postMessage({ type: 'mcpServerError', data: { error: 'Failed to save MCP server' } });
		}
	}

	private async _deleteMCPServer(name: string): Promise<void> {
		try {
			const mcpConfigPath = this.getMCPConfigPath();
			if (!mcpConfigPath) {
				this._postMessage({ type: 'mcpServerError', data: { error: 'Storage path not available' } });
				return;
			}

			const mcpConfigUri = vscode.Uri.file(mcpConfigPath);
			let mcpConfig: any = { mcpServers: {} };

			// Load existing config
			try {
				const content = await vscode.workspace.fs.readFile(mcpConfigUri);
				mcpConfig = JSON.parse(new TextDecoder().decode(content));
			} catch {
				// File doesn't exist, nothing to delete
				this._postMessage({ type: 'mcpServerError', data: { error: 'MCP config file not found' } });
				return;
			}

			// Delete the server
			if (mcpConfig.mcpServers && mcpConfig.mcpServers[name]) {
				delete mcpConfig.mcpServers[name];

				// Save the updated config
				const configContent = new TextEncoder().encode(JSON.stringify(mcpConfig, null, 2));
				await vscode.workspace.fs.writeFile(mcpConfigUri, configContent);

				this._postMessage({ type: 'mcpServerDeleted', data: { name } });
				console.log(`Deleted MCP server: ${name}`);
			} else {
				this._postMessage({ type: 'mcpServerError', data: { error: `Server '${name}' not found` } });
			}
		} catch (error) {
			console.error('Error deleting MCP server:', error);
			this._postMessage({ type: 'mcpServerError', data: { error: 'Failed to delete MCP server' } });
		}
	}

	private async _sendCustomSnippets(): Promise<void> {
		try {
			const customSnippets = this._context.globalState.get<{ [key: string]: any }>('customPromptSnippets', {});
			this._postMessage({
				type: 'customSnippetsData',
				data: customSnippets
			});
		} catch (error) {
			console.error('Error loading custom snippets:', error);
			this._postMessage({
				type: 'customSnippetsData',
				data: {}
			});
		}
	}

	private async _saveCustomSnippet(snippet: any): Promise<void> {
		try {
			const customSnippets = this._context.globalState.get<{ [key: string]: any }>('customPromptSnippets', {});
			customSnippets[snippet.id] = snippet;

			await this._context.globalState.update('customPromptSnippets', customSnippets);

			this._postMessage({
				type: 'customSnippetSaved',
				data: { snippet }
			});

			console.log('Saved custom snippet:', snippet.name);
		} catch (error) {
			console.error('Error saving custom snippet:', error);
			this._postMessage({
				type: 'error',
				data: 'Failed to save custom snippet'
			});
		}
	}

	private async _deleteCustomSnippet(snippetId: string): Promise<void> {
		try {
			const customSnippets = this._context.globalState.get<{ [key: string]: any }>('customPromptSnippets', {});

			if (customSnippets[snippetId]) {
				delete customSnippets[snippetId];
				await this._context.globalState.update('customPromptSnippets', customSnippets);

				this._postMessage({
					type: 'customSnippetDeleted',
					data: { snippetId }
				});

				console.log('Deleted custom snippet:', snippetId);
			} else {
				this._postMessage({
					type: 'error',
					data: 'Snippet not found'
				});
			}
		} catch (error) {
			console.error('Error deleting custom snippet:', error);
			this._postMessage({
				type: 'error',
				data: 'Failed to delete custom snippet'
			});
		}
	}

	private convertToWSLPath(windowsPath: string): string {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const wslEnabled = config.get<boolean>('wsl.enabled', false);

		if (wslEnabled && windowsPath.match(/^[a-zA-Z]:/)) {
			// Convert C:\Users\... to /mnt/c/Users/...
			return windowsPath.replace(/^([a-zA-Z]):/, '/mnt/$1').toLowerCase().replace(/\\/g, '/');
		}

		return windowsPath;
	}

	public getMCPConfigPath(): string | undefined {
		const storagePath = this._context.storageUri?.fsPath;
		if (!storagePath) { return undefined; }

		const configPath = path.join(storagePath, 'mcp', 'mcp-servers.json');
		return path.join(configPath);
	}

	private _sendAndSaveMessage(message: { type: string, data: any }): void {

		// Initialize conversation if this is the first message
		if (this._currentConversation.length === 0) {
			this._conversationStartTime = new Date().toISOString();
		}

		// Send to UI using the helper method
		this._postMessage(message);

		// Save to conversation
		this._currentConversation.push({
			timestamp: new Date().toISOString(),
			messageType: message.type,
			data: message.data
		});

		// Persist conversation
		void this._saveCurrentConversation();
	}

	private async _saveCurrentConversation(): Promise<void> {
		if (!this._conversationsPath || this._currentConversation.length === 0) { return; }
		if (!this._currentSessionId) { return; }

		try {
			// Create filename from first user message and timestamp
			const firstUserMessage = this._currentConversation.find(m => m.messageType === 'userInput');
			const firstMessage = firstUserMessage ? firstUserMessage.data : 'conversation';
			const startTime = this._conversationStartTime || new Date().toISOString();
			const sessionId = this._currentSessionId || 'unknown';

			// Clean and truncate first message for filename
			const cleanMessage = firstMessage
				.replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
				.replace(/\s+/g, '-') // Replace spaces with dashes
				.substring(0, 50) // Limit length
				.toLowerCase();

			const datePrefix = startTime.substring(0, 16).replace('T', '_').replace(/:/g, '-');
			const filename = `${datePrefix}_${cleanMessage}.json`;

			const conversationData: ConversationData = {
				sessionId: sessionId,
				startTime: this._conversationStartTime,
				endTime: new Date().toISOString(),
				messageCount: this._currentConversation.length,
				totalCost: this._totalCost,
				totalTokens: {
					input: this._totalTokensInput,
					output: this._totalTokensOutput
				},
				messages: this._currentConversation,
				filename
			};

			const filePath = path.join(this._conversationsPath, filename);
			const content = new TextEncoder().encode(JSON.stringify(conversationData, null, 2));
			await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), content);

			// Update conversation index
			this._updateConversationIndex(filename, conversationData);

			console.log(`Saved conversation: ${filename}`, this._conversationsPath);
		} catch (error: any) {
			console.error('Failed to save conversation:', error.message);
		}
	}


	public async loadConversation(filename: string): Promise<void> {
		// Load the conversation history
		await this._loadConversationHistory(filename);
	}

	private _sendConversationList(): void {
		this._postMessage({
			type: 'conversationList',
			data: this._conversationIndex
		});
	}

	private async _sendWorkspaceFiles(searchTerm?: string): Promise<void> {
		// Use debounced search for better performance during typing
		if (searchTerm && searchTerm.trim()) {
			this._debouncedWorkspaceSearch(searchTerm);
		} else {
			// For initial load (no search term), perform immediately
			await this._performWorkspaceSearch('');
		}
	}

	private async _performWorkspaceSearch(searchTerm: string): Promise<void> {
		try {
			// Check cache first
			const cacheKey = `workspace_files_${searchTerm || 'all'}`;
			const cached = this._workspaceFilesCache.get(cacheKey);
			if (cached) {
				console.log(`WorkspaceFiles: Cache hit for "${searchTerm || 'all'}"`);
				this._postMessage({
					type: 'workspaceFiles',
					data: cached
				});
				return;
			}

			// Always get all files and filter on the backend for better search results
			const files = await vscode.workspace.findFiles(
				'**/*',
				'{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**,**/.nuxt/**,**/target/**,**/bin/**,**/obj/**}',
				500 // Reasonable limit for filtering
			);

			let fileList = files.map(file => {
				const relativePath = vscode.workspace.asRelativePath(file);
				return {
					name: file.path.split('/').pop() || '',
					path: relativePath,
					fsPath: file.fsPath
				};
			});

			// Filter results based on search term
			if (searchTerm && searchTerm.trim()) {
				const term = searchTerm.toLowerCase();
				fileList = fileList.filter(file => {
					const fileName = file.name.toLowerCase();
					const filePath = file.path.toLowerCase();

					// Check if term matches filename or any part of the path
					return fileName.includes(term) ||
						filePath.includes(term) ||
						filePath.split('/').some(segment => segment.includes(term));
				});
			}

			// Sort and limit results
			const result = fileList
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, 50)
				.map(f => ({ path: f.path, name: f.name }));

			// Cache the result
			this._workspaceFilesCache.set(cacheKey, result);

			this._postMessage({
				type: 'workspaceFiles',
				data: result
			});
		} catch (error) {
			console.error('Error getting workspace files:', error);
			this._postMessage({
				type: 'workspaceFiles',
				data: []
			});
		}
	}

	private async _selectImageFile(): Promise<void> {
		try {
			// Show VS Code's native file picker for images
			const result = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: true,
				title: 'Select image files',
				filters: {
					'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']
				}
			});

			if (result && result.length > 0) {
				// Send the selected file paths back to webview
				result.forEach(uri => {
					this._postMessage({
						type: 'imagePath',
						path: uri.fsPath
					});
				});
			}

		} catch (error) {
			console.error('Error selecting image files:', error);
		}
	}

	private _stopClaudeProcess(): void {
		console.log('Stop request received');

		this._isProcessing = false;

		// Update UI state immediately
		this._postMessage({
			type: 'setProcessing',
			data: { isProcessing: false }
		});

		this._postMessage({
			type: 'clearLoading'
		});

		if (this._currentClaudeProcess) {
			console.log('Terminating Claude process with PID:', this._currentClaudeProcess.pid);

			const processToKill = this._currentClaudeProcess;
			const pid = processToKill.pid;

			// Clear process reference immediately to prevent close handler from running
			this._currentClaudeProcess = undefined;

			try {
				// Check if WSL is enabled
				const config = vscode.workspace.getConfiguration('claudeCodeChat');
				const wslEnabled = config.get<boolean>('wsl.enabled', false);

				// On Windows with WSL or native Windows, use standard kill
				// On macOS/Linux (non-WSL), kill the entire process group
				if (process.platform === 'win32' || wslEnabled) {
					// Windows or WSL: use standard kill (don't use process groups)
					console.log('Using standard kill for Windows/WSL');
					processToKill.kill('SIGTERM');
				} else if (pid) {
					// macOS/Linux native: kill the process group
					try {
						// Kill the process group (negative PID kills the group)
						process.kill(-pid, 'SIGTERM');
						console.log('Sent SIGTERM to process group:', -pid);
					} catch (groupErr) {
						// If process group kill fails, try killing the process directly
						console.log('Process group kill failed, trying direct kill:', groupErr);
						processToKill.kill('SIGTERM');
					}
				} else {
					processToKill.kill('SIGTERM');
				}

				// Force kill after 1 second if still running
				setTimeout(() => {
					try {
						if (!processToKill.killed) {
							console.log('Force killing Claude process...');
							if (process.platform !== 'win32' && !wslEnabled && pid) {
								try {
									process.kill(-pid, 'SIGKILL');
								} catch {
									processToKill.kill('SIGKILL');
								}
							} else {
								processToKill.kill('SIGKILL');
							}
						}
					} catch (e) {
						// Process already dead, ignore
						console.log('Force kill error (process may already be dead):', e);
					}
				}, 1000);

			} catch (e) {
				console.error('Error killing Claude process:', e);
			}

			// Send stop confirmation message
			this._sendAndSaveMessage({
				type: 'error',
				data: '⏹️ Claude process was stopped.'
			});

			console.log('Claude process termination initiated');
		} else {
			console.log('No Claude process running to stop');
			// Still send UI update in case state is out of sync
			this._sendAndSaveMessage({
				type: 'error',
				data: '⏹️ Stop requested (no active process).'
			});
		}
	}

	private _updateConversationIndex(filename: string, conversationData: ConversationData): void {
		// Extract first and last user messages
		const userMessages = conversationData.messages.filter((m: any) => m.messageType === 'userInput');
		const firstUserMessage = userMessages.length > 0 ? userMessages[0].data : 'No user message';
		const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].data : firstUserMessage;

		// Create or update index entry
		const indexEntry = {
			filename: filename,
			sessionId: conversationData.sessionId,
			startTime: conversationData.startTime || '',
			endTime: conversationData.endTime,
			messageCount: conversationData.messageCount,
			totalCost: conversationData.totalCost,
			firstUserMessage: firstUserMessage.substring(0, 100), // Truncate for storage
			lastUserMessage: lastUserMessage.substring(0, 100)
		};

		// Remove any existing entry for this session (in case of updates)
		this._conversationIndex = this._conversationIndex.filter(entry => entry.filename !== conversationData.filename);

		// Add new entry at the beginning (most recent first)
		this._conversationIndex.unshift(indexEntry);

		// Keep only last 50 conversations to avoid workspace state bloat
		if (this._conversationIndex.length > 50) {
			this._conversationIndex = this._conversationIndex.slice(0, 50);
		}

		// Save to workspace state
		this._context.workspaceState.update('claude.conversationIndex', this._conversationIndex);
	}

	private _getLatestConversation(): any | undefined {
		return this._conversationIndex.length > 0 ? this._conversationIndex[0] : undefined;
	}

	private async _loadConversationHistory(filename: string): Promise<void> {
		console.log("_loadConversationHistory");
		if (!this._conversationsPath) { return; }

		try {
			const filePath = path.join(this._conversationsPath, filename);
			console.log("filePath", filePath);

			let conversationData: ConversationData;
			try {
				const fileUri = vscode.Uri.file(filePath);
				const content = await vscode.workspace.fs.readFile(fileUri);
				conversationData = JSON.parse(new TextDecoder().decode(content));
			} catch {
				return;
			}

			// Load conversation into current state
			this._currentConversation = conversationData.messages || [];
			this._conversationStartTime = conversationData.startTime;
			this._totalCost = conversationData.totalCost || 0;
			this._totalTokensInput = conversationData.totalTokens?.input || 0;
			this._totalTokensOutput = conversationData.totalTokens?.output || 0;

			// Clear UI messages first, then send all messages to recreate the conversation
			setTimeout(() => {
				// Clear existing messages
				this._postMessage({
					type: 'sessionCleared'
				});

				let requestStartTime: number

				// Small delay to ensure messages are cleared before loading new ones
				setTimeout(() => {
					const messages = this._currentConversation;
					for (let i = 0; i < messages.length; i++) {

						const message = messages[i];

						if(message.messageType === 'permissionRequest'){
							const isLast = i === messages.length - 1;
							if(!isLast){
								continue;
							}
						}

						this._postMessage({
							type: message.messageType,
							data: message.data
						});
						if (message.messageType === 'userInput') {
							try {
								requestStartTime = new Date(message.timestamp).getTime()
							} catch (e) {
								console.log(e)
							}
						}
					}

					// Send updated totals
					this._postMessage({
						type: 'updateTotals',
						data: {
							totalCost: this._totalCost,
							totalTokensInput: this._totalTokensInput,
							totalTokensOutput: this._totalTokensOutput,
							requestCount: this._requestCount
						}
					});

					// Restore processing state if the conversation was saved while processing
					if (this._isProcessing) {
						this._postMessage({
							type: 'setProcessing',
							data: { isProcessing: this._isProcessing, requestStartTime }
						});
					}
					// Send ready message after conversation is loaded
					this._sendReadyMessage();
				}, 50);
			}, 100); // Small delay to ensure webview is ready

			console.log(`Loaded conversation history: ${filename}`);
		} catch (error: any) {
			console.error('Failed to load conversation history:', error.message);
		}
	}

	private _getHtmlForWebview(): string {
		return getHtml(vscode.env?.isTelemetryEnabled);
	}

	private _sendCurrentSettings(): void {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const settings = {
			'thinking.intensity': config.get<string>('thinking.intensity', 'think'),
			'wsl.enabled': config.get<boolean>('wsl.enabled', false),
			'wsl.distro': config.get<string>('wsl.distro', 'Ubuntu'),
			'wsl.nodePath': config.get<string>('wsl.nodePath', '/usr/bin/node'),
			'wsl.claudePath': config.get<string>('wsl.claudePath', '/usr/local/bin/claude'),
			'permissions.yoloMode': config.get<boolean>('permissions.yoloMode', false)
		};

		this._postMessage({
			type: 'settingsData',
			data: settings
		});
	}

	private async _enableYoloMode(): Promise<void> {
		try {
			// Update VS Code configuration to enable YOLO mode
			const config = vscode.workspace.getConfiguration('claudeCodeChat');

			// Clear any global setting and set workspace setting
			await config.update('permissions.yoloMode', true, vscode.ConfigurationTarget.Workspace);

			console.log('YOLO Mode enabled - all future permissions will be skipped');

			// Send updated settings to UI
			this._sendCurrentSettings();

		} catch (error) {
			console.error('Error enabling YOLO mode:', error);
		}
	}

	private _saveInputText(text: string): void {
		this._draftMessage = text || '';
	}

	private async _updateSettings(settings: { [key: string]: any }): Promise<void> {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');

		try {
			for (const [key, value] of Object.entries(settings)) {
				if (key === 'permissions.yoloMode') {
					// YOLO mode is workspace-specific
					await config.update(key, value, vscode.ConfigurationTarget.Workspace);
				} else {
					// Other settings are global (user-wide)
					await config.update(key, value, vscode.ConfigurationTarget.Global);
				}
			}

			console.log('Settings updated:', settings);
		} catch (error) {
			console.error('Failed to update settings:', error);
			vscode.window.showErrorMessage('Failed to update settings');
		}
	}

	private async _getClipboardText(): Promise<void> {
		try {
			const text = await vscode.env.clipboard.readText();
			this._postMessage({
				type: 'clipboardText',
				data: text
			});
		} catch (error) {
			console.error('Failed to read clipboard:', error);
		}
	}

	private _setSelectedModel(model: string): void {
		// Validate model name to prevent issues mentioned in the GitHub issue
		const validModels = ['opus', 'sonnet', 'default'];
		if (validModels.includes(model)) {
			this._selectedModel = model;
			console.log('Model selected:', model);

			// Store the model preference in workspace state
			this._context.workspaceState.update('claude.selectedModel', model);

			// Show confirmation
			vscode.window.showInformationMessage(`Claude model switched to: ${model.charAt(0).toUpperCase() + model.slice(1)}`);
		} else {
			console.error('Invalid model selected:', model);
			vscode.window.showErrorMessage(`Invalid model: ${model}. Please select Opus, Sonnet, or Default.`);
		}
	}

	private _openModelTerminal(): void {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const wslEnabled = config.get<boolean>('wsl.enabled', false);
		const wslDistro = config.get<string>('wsl.distro', 'Ubuntu');
		const nodePath = config.get<string>('wsl.nodePath', '/usr/bin/node');
		const claudePath = config.get<string>('wsl.claudePath', '/usr/local/bin/claude');

		// Build command arguments
		const args = ['/model'];

		// Add session resume if we have a current session
		if (this._currentSessionId) {
			args.push('--resume', this._currentSessionId);
		}

		// Create terminal with the claude /model command
		const terminal = vscode.window.createTerminal('Claude Model Selection');
		if (wslEnabled) {
			terminal.sendText(`wsl -d ${wslDistro} ${nodePath} --no-warnings --enable-source-maps ${claudePath} ${args.join(' ')}`);
		} else {
			terminal.sendText(`claude ${args.join(' ')}`);
		}
		terminal.show();

		// Show info message
		vscode.window.showInformationMessage(
			'Check the terminal to update your default model configuration. Come back to this chat here after making changes.',
			'OK'
		);

		// Send message to UI about terminal
		this._postMessage({
			type: 'terminalOpened',
			data: 'Check the terminal to update your default model configuration. Come back to this chat here after making changes.'
		});
	}

	private _executeSlashCommand(command: string): void {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const wslEnabled = config.get<boolean>('wsl.enabled', false);
		const wslDistro = config.get<string>('wsl.distro', 'Ubuntu');
		const nodePath = config.get<string>('wsl.nodePath', '/usr/bin/node');
		const claudePath = config.get<string>('wsl.claudePath', '/usr/local/bin/claude');

		// Build command arguments
		const args = [`/${command}`];

		// Add session resume if we have a current session
		if (this._currentSessionId) {
			args.push('--resume', this._currentSessionId);
		}

		// Create terminal with the claude command
		const terminal = vscode.window.createTerminal(`Claude /${command}`);
		if (wslEnabled) {
			terminal.sendText(`wsl -d ${wslDistro} ${nodePath} --no-warnings --enable-source-maps ${claudePath} ${args.join(' ')}`);
		} else {
			terminal.sendText(`claude ${args.join(' ')}`);
		}
		terminal.show();

		// Show info message
		vscode.window.showInformationMessage(
			`Executing /${command} command in terminal. Check the terminal output and return when ready.`,
			'OK'
		);

		// Send message to UI about terminal
		this._postMessage({
			type: 'terminalOpened',
			data: `Executing /${command} command in terminal. Check the terminal output and return when ready.`,
		});
	}

	private _sendPlatformInfo() {
		const platform = process.platform;
		const dismissed = this._context.globalState.get<boolean>('wslAlertDismissed', false);

		// Get WSL configuration
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const wslEnabled = config.get<boolean>('wsl.enabled', false);

		this._postMessage({
			type: 'platformInfo',
			data: {
				platform: platform,
				isWindows: platform === 'win32',
				wslAlertDismissed: dismissed,
				wslEnabled: wslEnabled
			}
		});
	}

	private _dismissWSLAlert() {
		this._context.globalState.update('wslAlertDismissed', true);
	}

	private async _openFileInEditor(filePath: string) {
		try {
			const uri = vscode.Uri.file(filePath);
			const document = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
			console.error('Error opening file:', error);
		}
	}

	private async _createImageFile(imageData: string, imageType: string) {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) { return; }

			// Extract base64 data from data URL
			const base64Data = imageData.split(',')[1];
			const buffer = Buffer.from(base64Data, 'base64');

			// Get file extension from image type
			const extension = imageType.split('/')[1] || 'png';

			// Create unique filename with timestamp
			const timestamp = Date.now();
			const imageFileName = `image_${timestamp}.${extension}`;

			// Create images folder in workspace .claude directory
			const imagesDir = vscode.Uri.joinPath(workspaceFolder.uri, '.claude', 'claude-code-chat-images');
			await vscode.workspace.fs.createDirectory(imagesDir);

			// Create .gitignore to ignore all images
			const gitignorePath = vscode.Uri.joinPath(imagesDir, '.gitignore');
			try {
				await vscode.workspace.fs.stat(gitignorePath);
			} catch {
				// .gitignore doesn't exist, create it
				const gitignoreContent = new TextEncoder().encode('*\n');
				await vscode.workspace.fs.writeFile(gitignorePath, gitignoreContent);
			}

			// Create the image file
			const imagePath = vscode.Uri.joinPath(imagesDir, imageFileName);
			await vscode.workspace.fs.writeFile(imagePath, buffer);

			// Send the file path back to webview
			this._postMessage({
				type: 'imagePath',
				data: {
					filePath: imagePath.fsPath
				}
			});

		} catch (error) {
			console.error('Error creating image file:', error);
			vscode.window.showErrorMessage('Failed to create image file');
		}
	}

	// ==================== DOCS MANAGEMENT ====================

	private async _initializeDocsManager(): Promise<void> {
		try {
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				console.log('No workspace root found, DocsManager will not be initialized');
				return;
			}

			this._docsManager = new DocsManager(workspaceRoot);
			console.log('DocsManager initialized successfully');
		} catch (error: any) {
			console.error('Failed to initialize DocsManager:', error.message);
		}
	}

	private async _loadDocs(): Promise<void> {
		try {
			if (!this._docsManager) {
				await this._initializeDocsManager();
			}

			if (!this._docsManager) {
				this._postMessage({ type: 'docsList', data: { docs: [], stats: { totalDocs: 0, totalPages: 0, totalSize: '0 KB' } } });
				return;
			}

			const docs = await this._docsManager.getDocs();
			const totalPages = docs.reduce((sum, d) => sum + (d.pageCount || 0), 0);
			const totalSize = docs.reduce((sum, d) => sum + (d.totalSize || 0), 0);

			this._postMessage({
				type: 'docsList',
				data: {
					docs: docs,
					stats: {
						totalDocs: docs.length,
						totalPages: totalPages,
						totalSize: this._formatBytes(totalSize)
					}
				}
			});
		} catch (error: any) {
			console.error('Error loading docs:', error);
			this._postMessage({ type: 'docError', data: { error: error.message } });
		}
	}

	private _formatBytes(bytes: number): string {
		if (bytes === 0) return '0 KB';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	private async _addDoc(config: { name: string; entryUrl: string; prefixUrl?: string; maxPages?: number; maxDepth?: number }): Promise<void> {
		try {
			if (!this._docsManager) {
				await this._initializeDocsManager();
			}

			if (!this._docsManager) {
				this._postMessage({ type: 'docError', data: { error: 'DocsManager not initialized. Please open a workspace folder.' } });
				return;
			}

			// Add the doc config
			const docConfig = await this._docsManager.addDoc(
				config.name,
				config.entryUrl,
				config.prefixUrl,
				config.maxPages || 50,
				config.maxDepth || 3
			);
			this._postMessage({ type: 'docAdded', data: { name: config.name, docId: docConfig.id } });

			// Set up progress callback for crawling updates
			this._docsManager.setProgressCallback((docId, current, total, status) => {
				this._postMessage({
					type: 'docProgress',
					data: {
						docId: docId,
						name: config.name,
						current: current,
						total: total,
						status: status
					}
				});
			});

			// Start crawling
			await this._docsManager.crawlDoc(docConfig.id);

			// Get the updated doc config to get the page count
			const docs = await this._docsManager.getDocs();
			const updatedDoc = docs.find(d => d.id === docConfig.id);
			const pageCount = updatedDoc?.pageCount || 0;

			this._postMessage({
				type: 'docIndexed',
				data: {
					name: config.name,
					docId: docConfig.id,
					pageCount: pageCount
				}
			});

			// Refresh the docs list
			this._loadDocs();
		} catch (error: any) {
			console.error('Error adding doc:', error);
			this._postMessage({ type: 'docError', data: { error: error.message, name: config.name } });
		}
	}

	private async _reindexDoc(docId: string): Promise<void> {
		try {
			if (!this._docsManager) {
				this._postMessage({ type: 'docError', data: { error: 'DocsManager not initialized' } });
				return;
			}

			// Set up progress callback for crawling updates
			this._docsManager.setProgressCallback((id, current, total, status) => {
				this._postMessage({
					type: 'docProgress',
					data: {
						name: docId,
						pagesProcessed: current,
						totalPages: total,
						currentUrl: status
					}
				});
			});

			await this._docsManager.crawlDoc(docId);
			this._postMessage({ type: 'docIndexed', data: { name: docId } });

			// Refresh the docs list
			this._loadDocs();
		} catch (error: any) {
			console.error('Error reindexing doc:', error);
			this._postMessage({ type: 'docError', data: { error: error.message, name: docId } });
		}
	}

	private async _deleteDoc(docId: string): Promise<void> {
		try {
			if (!this._docsManager) {
				this._postMessage({ type: 'docError', data: { error: 'DocsManager not initialized' } });
				return;
			}

			await this._docsManager.deleteDoc(docId);
			this._postMessage({ type: 'docDeleted', data: { docId: docId, name: docId } });

			// Refresh the docs list
			this._loadDocs();
		} catch (error: any) {
			console.error('Error deleting doc:', error);
			this._postMessage({ type: 'docError', data: { error: error.message } });
		}
	}

	// ==================== PROJECT MEMORY MANAGEMENT ====================

	private async _initializeProjectMemoryManager(): Promise<void> {
		try {
			this._projectMemoryManager = await createProjectMemoryManager();
			if (this._projectMemoryManager) {
				console.log('ProjectMemoryManager initialized successfully');

				// Record project initialization
				await this._projectMemoryManager.addObservations('project_main', [
					`Session started: ${new Date().toISOString()}`,
					'Claude Code Chat extension activated'
				]);
			}
		} catch (error: any) {
			console.error('Failed to initialize ProjectMemoryManager:', error.message);
			this._projectMemoryManager = null;
		}
	}

	private async _initializeSmartMemoryManager(): Promise<void> {
		try {
			if (this._projectMemoryManager) {
				this._smartMemoryManager = await createSmartMemoryManager(
					this._projectMemoryManager,
					vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				);
				if (this._smartMemoryManager) {
					console.log('SmartMemoryManager initialized successfully');
				}
			}
		} catch (error: any) {
			console.error('Failed to initialize SmartMemoryManager:', error.message);
			this._smartMemoryManager = null;
		}
	}

	/**
	 * Initialize the Advanced Context Engine (Priompt-like system)
	 * Provides priority-based context management, memory graphs, and scratchpad
	 */
	private async _initializeAdvancedContextEngine(): Promise<void> {
		try {
			if (this._projectMemoryManager) {
				this._advancedContextEngine = await createAdvancedContextEngine(
					this._projectMemoryManager,
					vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				);
				if (this._advancedContextEngine) {
					console.log('AdvancedContextEngine initialized successfully');
					this._useAdvancedContextEngine = true;
				}
			}
		} catch (error: any) {
			console.error('Failed to initialize AdvancedContextEngine:', error.message);
			this._advancedContextEngine = null;
			this._useAdvancedContextEngine = false;
		}
	}

	/**
	 * Initialize the Self-Verification Engine
	 * Validates responses before presenting to user
	 */
	private async _initializeSelfVerificationEngine(): Promise<void> {
		try {
			this._selfVerificationEngine = await createSelfVerificationEngine(
				vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			);
			if (this._selfVerificationEngine) {
				console.log('SelfVerificationEngine initialized successfully');
			}
		} catch (error: any) {
			console.error('Failed to initialize SelfVerificationEngine:', error.message);
			this._selfVerificationEngine = null;
		}
	}

	/**
	 * Initialize all memory systems in proper sequence
	 * This ensures ProjectMemoryManager is ready before SmartMemoryManager
	 */
	private async _initializeAllMemorySystems(): Promise<void> {
		try {
			console.log('Starting memory systems initialization...');

			// Step 1: Initialize Project Memory Manager first
			await this._initializeProjectMemoryManager();

			// Step 2: Initialize Smart Memory Manager (depends on Project Memory Manager)
			await this._initializeSmartMemoryManager();

			// Step 3: Initialize Advanced Context Engine (depends on Project Memory Manager)
			await this._initializeAdvancedContextEngine();

			// Step 4: Initialize Self-Verification Engine
			await this._initializeSelfVerificationEngine();

			// Mark as initialized
			this._memoryInitialized = true;
			console.log('All memory systems initialized successfully');

			// Notify webview if it's ready
			this._postMessage({
				type: 'memorySystemsReady',
				data: { initialized: true }
			});
		} catch (error: any) {
			console.error('Failed to initialize memory systems:', error.message);
			this._memoryInitialized = true; // Mark as done even on error to prevent infinite waiting
		}
	}

	/**
	 * Wait for memory systems to be initialized (with timeout)
	 */
	private async _waitForMemoryInitialization(timeoutMs: number = 5000): Promise<boolean> {
		if (this._memoryInitialized) {
			return true;
		}

		if (!this._memoryInitializationPromise) {
			return false;
		}

		try {
			await Promise.race([
				this._memoryInitializationPromise,
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Memory initialization timeout')), timeoutMs)
				)
			]);
			return this._memoryInitialized;
		} catch (error) {
			console.warn('Memory initialization wait timed out');
			return false;
		}
	}

	private async _sendMemoryStats(): Promise<void> {
		// Wait for initialization if not yet complete
		if (!this._memoryInitialized) {
			await this._waitForMemoryInitialization();
		}
		if (!this._projectMemoryManager) {
			this._postMessage({
				type: 'memoryStats',
				data: {
					initialized: false,
					totalEntities: 0,
					totalRelations: 0,
					totalObservations: 0,
					entitiesByType: {},
					hooksStatus: {
						isActive: false,
						rawEventsCount: 0,
						lastEventTime: null,
						scratchpadActive: false
					}
				}
			});
			return;
		}

		try {
			const stats = this._projectMemoryManager.getMemoryStats();
			const hooksStatus = await this._projectMemoryManager.getHooksStatus();
			const scratchpad = await this._projectMemoryManager.getScratchpad();

			this._postMessage({
				type: 'memoryStats',
				data: {
					initialized: true,
					...stats,
					hooksStatus,
					activeGoals: scratchpad?.activeGoals || [],
					currentTasks: scratchpad?.currentTasks || [],
					sessionId: scratchpad?.sessionId || null
				}
			});
		} catch (error: any) {
			console.error('Error getting memory stats:', error);
			this._postMessage({
				type: 'memoryError',
				data: { error: error.message }
			});
		}
	}

	private async _sendMemoryContext(): Promise<void> {
		// Wait for initialization if not yet complete
		if (!this._memoryInitialized) {
			await this._waitForMemoryInitialization();
		}

		if (!this._projectMemoryManager) {
			this._postMessage({
				type: 'memoryContext',
				data: { context: 'Project memory not initialized.' }
			});
			return;
		}

		try {
			const context = this._projectMemoryManager.generateMemoryContextPrompt();
			this._postMessage({
				type: 'memoryContext',
				data: { context }
			});
		} catch (error: any) {
			console.error('Error generating memory context:', error);
			this._postMessage({
				type: 'memoryError',
				data: { error: error.message }
			});
		}
	}

	private async _searchMemory(query: string): Promise<void> {
		// Use debounced search for better performance during typing
		this._debouncedMemorySearch(query);
	}

	private async _performMemorySearch(query: string): Promise<void> {
		if (!this._projectMemoryManager) {
			this._postMessage({
				type: 'memorySearchResults',
				data: { results: [], query }
			});
			return;
		}

		try {
			const results = this._projectMemoryManager.searchEntities(query);
			this._postMessage({
				type: 'memorySearchResults',
				data: {
					query,
					results: results.map(r => ({
						name: r.entity.name,
						type: r.entity.entityType,
						relevance: r.relevance,
						observations: r.matchedObservations.slice(0, 3),
						status: r.entity.metadata?.status || 'active'
					}))
				}
			});
		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			console.error('Error searching memory:', errorMsg);
			this._postMessage({
				type: 'memoryError',
				data: { error: errorMsg }
			});
		}
	}

	private async _clearProjectMemory(): Promise<void> {
		if (!this._projectMemoryManager) {
			this._postMessage({
				type: 'memoryCleared',
				data: { success: false, error: 'Memory manager not initialized' }
			});
			return;
		}

		try {
			const success = await this._projectMemoryManager.clearMemory();
			this._postMessage({
				type: 'memoryCleared',
				data: { success }
			});

			if (success) {
				vscode.window.showInformationMessage('Project memory cleared successfully');
			}
		} catch (error: any) {
			console.error('Error clearing memory:', error);
			this._postMessage({
				type: 'memoryError',
				data: { error: error.message }
			});
		}
	}

	private async _exportMemory(): Promise<void> {
		if (!this._projectMemoryManager) {
			this._postMessage({
				type: 'memoryExported',
				data: { success: false, error: 'Memory manager not initialized' }
			});
			return;
		}

		try {
			const exportData = this._projectMemoryManager.exportForMCP();
			const context = this._projectMemoryManager.generateMemoryContextPrompt();
			const stats = this._projectMemoryManager.getMemoryStats();

			// Create export object with full data
			const exportObject = {
				exportedAt: new Date().toISOString(),
				version: 1,
				stats: {
					totalEntities: stats.totalEntities,
					totalRelations: stats.totalRelations,
					totalObservations: stats.totalObservations,
					entitiesByType: stats.entitiesByType
				},
				entities: exportData.entities,
				relations: exportData.relations,
				contextPrompt: context
			};

			// Save to file using VS Code's save dialog
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			const defaultUri = workspaceFolder
				? vscode.Uri.file(path.join(workspaceFolder, `memory-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`))
				: undefined;

			const saveUri = await vscode.window.showSaveDialog({
				defaultUri,
				filters: {
					'JSON Files': ['json'],
					'All Files': ['*']
				},
				title: 'Export Project Memory'
			});

			if (saveUri) {
				const fs = await import('fs');
				await fs.promises.writeFile(saveUri.fsPath, JSON.stringify(exportObject, null, 2), 'utf-8');

				this._postMessage({
					type: 'memoryExported',
					data: {
						success: true,
						entities: exportData.entities.length,
						relations: exportData.relations.length,
						filePath: saveUri.fsPath
					}
				});

				vscode.window.showInformationMessage(`Memory exported to ${path.basename(saveUri.fsPath)}`);
			} else {
				// User cancelled - just show stats without saving
				this._postMessage({
					type: 'memoryExported',
					data: {
						success: true,
						entities: exportData.entities.length,
						relations: exportData.relations.length,
						cancelled: true
					}
				});
			}
		} catch (error: any) {
			console.error('Error exporting memory:', error);
			this._postMessage({
				type: 'memoryError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Send memory settings to UI
	 */
	private _sendMemorySettings(): void {
		const config = vscode.workspace.getConfiguration('claudeCodeChat');
		const autoInject = config.get<boolean>('memory.autoInject', true);
		const maxContextSize = config.get<number>('memory.maxContextSize', 4000);

		this._postMessage({
			type: 'memorySettings',
			data: {
				autoInject,
				maxContextSize
			}
		});
	}

	/**
	 * Update memory settings from UI
	 */
	private async _updateMemorySettings(settings: { autoInject: boolean; maxContextSize: number }): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration('claudeCodeChat');

			// Update auto-inject setting
			await config.update('memory.autoInject', settings.autoInject, vscode.ConfigurationTarget.Global);

			// Update max context size (validate range)
			const maxContextSize = Math.min(16000, Math.max(500, settings.maxContextSize));
			await config.update('memory.maxContextSize', maxContextSize, vscode.ConfigurationTarget.Global);

			this._postMessage({
				type: 'memorySettingsUpdated',
				data: { success: true }
			});

			console.log(`Memory settings updated: autoInject=${settings.autoInject}, maxContextSize=${maxContextSize}`);
		} catch (error: any) {
			console.error('Error updating memory settings:', error.message);
			this._postMessage({
				type: 'memoryError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Record conversation in project memory for knowledge persistence
	 */
	private async _recordConversationInMemory(role: 'user' | 'assistant', content: string): Promise<void> {
		if (!this._projectMemoryManager) return;

		try {
			await this._projectMemoryManager.recordConversation(role, content, this._currentSessionId);
		} catch (error: any) {
			console.error('Error recording conversation in memory:', error.message);
		}
	}

	// ==================== Scratchpad Management (CRITICAL FIX) ====================

	/**
	 * Scratchpad item interface for UI/file synchronization
	 */
	private _scratchpadPath: string | null = null;

	/**
	 * Get the scratchpad file path
	 */
	private _getScratchpadPath(): string | null {
		if (this._scratchpadPath) return this._scratchpadPath;

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) return null;

		this._scratchpadPath = path.join(workspaceFolder, '.claude', 'scratchpad.json');
		return this._scratchpadPath;
	}

	/**
	 * Save scratchpad items to file (CRITICAL FIX for persistence)
	 * This handler was MISSING and caused items to be lost on refresh
	 */
	private async _saveScratchpadItems(items: Array<{
		id: string;
		type: 'goal' | 'todo' | 'note' | 'decision';
		content: string;
		createdAt: string;
	}>): Promise<void> {
		const scratchpadPath = this._getScratchpadPath();
		if (!scratchpadPath) {
			console.error('Scratchpad: No workspace folder available');
			return;
		}

		try {
			const fs = await import('fs');

			// Ensure .claude directory exists
			const claudeDir = path.dirname(scratchpadPath);
			await fs.promises.mkdir(claudeDir, { recursive: true });

			// Convert UI format to unified format with additional fields
			const unifiedItems = items.map(item => ({
				id: item.id,
				type: item.type,
				content: item.content,
				priority: item.type === 'goal' ? 10 : item.type === 'todo' ? 7 : item.type === 'decision' ? 8 : 5,
				status: 'active' as const,
				createdAt: item.createdAt,
				updatedAt: new Date().toISOString()
			}));

			// Save to file
			await fs.promises.writeFile(
				scratchpadPath,
				JSON.stringify(unifiedItems, null, 2),
				'utf-8'
			);

			console.log(`Scratchpad: Saved ${items.length} items to ${scratchpadPath}`);

			// Also update AdvancedContextEngine if available (two-way sync)
			if (this._advancedContextEngine && this._advancedContextEngine.isInitialized()) {
				// Clear existing scratchpad entries and add new ones
				for (const item of items) {
					await this._advancedContextEngine.addToScratchpad(
						item.type as any,
						item.content,
						item.type === 'goal' ? 10 : item.type === 'todo' ? 7 : 5
					);
				}
			}

			// Send confirmation back to UI
			this._postMessage({
				type: 'scratchpadSaved',
				data: { success: true, count: items.length }
			});

		} catch (error: any) {
			console.error('Scratchpad: Error saving items:', error.message);
			this._postMessage({
				type: 'scratchpadError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Load and send scratchpad items to UI
	 */
	private async _sendScratchpadItems(): Promise<void> {
		const scratchpadPath = this._getScratchpadPath();

		try {
			const fs = await import('fs');
			let items: Array<{
				id: string;
				type: string;
				content: string;
				createdAt: string;
			}> = [];

			if (scratchpadPath) {
				try {
					const content = await fs.promises.readFile(scratchpadPath, 'utf-8');
					const data = JSON.parse(content);

					// Handle both array format and object format
					if (Array.isArray(data)) {
						items = data.map(item => ({
							id: item.id,
							type: item.type,
							content: item.content,
							createdAt: item.createdAt
						}));
					} else {
						// Convert from AdvancedContextEngine Map format {id: entry}
						items = Object.values(data).map((entry: any) => ({
							id: entry.id,
							type: entry.type,
							content: entry.content,
							createdAt: entry.createdAt
						}));
					}
				} catch {
					// File doesn't exist yet or invalid - start with empty array
					items = [];
				}
			}

			this._postMessage({
				type: 'scratchpadItems',
				data: { items }
			});

			console.log(`Scratchpad: Sent ${items.length} items to UI`);

		} catch (error: any) {
			console.error('Scratchpad: Error loading items:', error.message);
			this._postMessage({
				type: 'scratchpadItems',
				data: { items: [] }
			});
		}
	}

	// ==================== TASK MANAGER METHODS ====================

	/**
	 * Get all tasks for the Task Manager UI
	 */
	private async _getAllTasks(): Promise<void> {
		// Wait for initialization if not yet complete
		if (!this._memoryInitialized) {
			await this._waitForMemoryInitialization();
		}

		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'allTasks',
				data: { tasks: [], error: 'Smart memory manager not initialized' }
			});
			return;
		}

		try {
			const tasks = await this._smartMemoryManager.getAllTasks();
			this._postMessage({
				type: 'allTasks',
				data: { tasks }
			});
		} catch (error: any) {
			console.error('Error getting all tasks:', error);
			this._postMessage({
				type: 'taskError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Get details for a specific task
	 */
	private async _getTaskDetails(taskId: string): Promise<void> {
		// Wait for initialization if not yet complete
		if (!this._memoryInitialized) {
			await this._waitForMemoryInitialization();
		}

		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'taskDetails',
				data: { task: null, error: 'Smart memory manager not initialized' }
			});
			return;
		}

		try {
			const task = await this._smartMemoryManager.getTaskDetails(taskId);
			this._postMessage({
				type: 'taskDetails',
				data: { task }
			});
		} catch (error: any) {
			console.error('Error getting task details:', error);
			this._postMessage({
				type: 'taskError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Update task status
	 */
	private async _updateTaskStatus(taskId: string, status: 'active' | 'completed' | 'deprecated'): Promise<void> {
		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'taskUpdated',
				data: { success: false, error: 'Smart memory manager not initialized' }
			});
			return;
		}

		try {
			const success = await this._smartMemoryManager.updateTaskStatus(taskId, status);
			this._postMessage({
				type: 'taskUpdated',
				data: { success, taskId, status }
			});

			// Refresh task list
			if (success) {
				this._getAllTasks();
			}
		} catch (error: any) {
			console.error('Error updating task status:', error);
			this._postMessage({
				type: 'taskError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Create a new task
	 */
	private async _createTask(
		name: string,
		description: string,
		importance: 'low' | 'medium' | 'high' | 'critical' = 'medium',
		relatedFiles?: string[]
	): Promise<void> {
		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'taskCreated',
				data: { success: false, error: 'Smart memory manager not initialized' }
			});
			return;
		}

		try {
			const taskId = await this._smartMemoryManager.createTask(name, description, importance, relatedFiles);
			this._postMessage({
				type: 'taskCreated',
				data: { success: !!taskId, taskId }
			});

			// Refresh task list
			if (taskId) {
				this._getAllTasks();
			}
		} catch (error: any) {
			console.error('Error creating task:', error);
			this._postMessage({
				type: 'taskError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Add observation to a task
	 */
	private async _addTaskObservation(taskId: string, observation: string): Promise<void> {
		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'observationAdded',
				data: { success: false, error: 'Smart memory manager not initialized' }
			});
			return;
		}

		try {
			const success = await this._smartMemoryManager.addTaskObservation(taskId, observation);
			this._postMessage({
				type: 'observationAdded',
				data: { success, taskId }
			});

			// Refresh task details
			if (success) {
				this._getTaskDetails(taskId);
			}
		} catch (error: any) {
			console.error('Error adding task observation:', error);
			this._postMessage({
				type: 'taskError',
				data: { error: error.message }
			});
		}
	}

	/**
	 * Send session health to UI
	 */
	private _sendSessionHealth(): void {
		if (!this._smartMemoryManager) {
			this._postMessage({
				type: 'sessionHealth',
				data: {
					status: 'healthy',
					usagePercent: 0,
					recommendation: 'Smart memory manager not initialized',
					sessionTokens: this._sessionEstimatedTokens,
					messageCount: this._sessionMessageCount
				}
			});
			return;
		}

		const sessionContext: SessionContext = {
			sessionId: this._currentSessionId || 'new',
			messageCount: this._sessionMessageCount,
			estimatedTokens: this._sessionEstimatedTokens,
			lastCompactionTime: this._lastSessionCompaction,
			isOverBudget: this._sessionEstimatedTokens > 120000
		};

		const health = this._smartMemoryManager.getSessionHealth(sessionContext);

		this._postMessage({
			type: 'sessionHealth',
			data: {
				...health,
				sessionTokens: this._sessionEstimatedTokens,
				messageCount: this._sessionMessageCount
			}
		});
	}

	public dispose() {
		console.log('ChatProvider: Disposing all resources...');

		// Cancel pending debounced operations
		this._debouncedWorkspaceSearch.cancel();
		this._debouncedMemorySearch.cancel();

		// Clear caches
		this._workspaceFilesCache.clear();

		// Dispose panel
		if (this._panel) {
			this._panel.dispose();
			this._panel = undefined;
		}

		// Dispose message handler if it exists
		if (this._messageHandlerDisposable) {
			this._messageHandlerDisposable.dispose();
			this._messageHandlerDisposable = undefined;
		}

		// Dispose all managers to prevent memory leaks
		if (this._smartMemoryManager) {
			this._smartMemoryManager.dispose();
			this._smartMemoryManager = null;
		}

		if (this._projectMemoryManager) {
			this._projectMemoryManager.dispose();
			this._projectMemoryManager = null;
		}

		if (this._projectContextManager) {
			this._projectContextManager.dispose();
			this._projectContextManager = null;
		}

		if (this._contextWindowManager) {
			this._contextWindowManager.dispose();
		}

		if (this._docsManager) {
			this._docsManager.dispose();
			this._docsManager = null;
		}

		// Stop any running Claude process
		if (this._currentClaudeProcess) {
			try {
				this._currentClaudeProcess.kill('SIGTERM');
				this._currentClaudeProcess = undefined;
			} catch (e) {
				console.error('Error killing Claude process:', e);
			}
		}

		// Dispose permission watcher
		if (this._permissionWatcher) {
			this._permissionWatcher.dispose();
		}

		// Dispose all other disposables
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}

		console.log('ChatProvider: All resources disposed');
	}
}