/**
 * Type Definitions for Claude Code Chat Extension
 *
 * This file contains all shared type definitions, interfaces, and enums
 * used across the extension for better type safety and code quality.
 */

// ==================== Webview Message Types ====================

/**
 * Base interface for all webview messages
 */
export interface WebviewMessageBase {
    type: string;
}

/**
 * Plan mode types for different planning approaches
 */
export type PlanModeType = 'planfast' | 'ask' | 'agent' | 'auto' | 'trueplan';

/**
 * Message to send a chat message to Claude
 */
export interface SendMessageMessage extends WebviewMessageBase {
    type: 'sendMessage';
    text: string;
    planMode?: boolean;
    planModeType?: PlanModeType;
    thinkingMode?: boolean;
}

/**
 * Message to start a new session
 */
export interface NewSessionMessage extends WebviewMessageBase {
    type: 'newSession';
}

/**
 * Message to restore a commit
 */
export interface RestoreCommitMessage extends WebviewMessageBase {
    type: 'restoreCommit';
    commitSha: string;
}

/**
 * Message to get conversation list
 */
export interface GetConversationListMessage extends WebviewMessageBase {
    type: 'getConversationList';
}

/**
 * Message to get workspace files
 */
export interface GetWorkspaceFilesMessage extends WebviewMessageBase {
    type: 'getWorkspaceFiles';
    searchTerm?: string;
}

/**
 * Message to select an image file
 */
export interface SelectImageFileMessage extends WebviewMessageBase {
    type: 'selectImageFile';
}

/**
 * Message to load a conversation
 */
export interface LoadConversationMessage extends WebviewMessageBase {
    type: 'loadConversation';
    filename: string;
}

/**
 * Message to stop the current request
 */
export interface StopRequestMessage extends WebviewMessageBase {
    type: 'stopRequest';
}

/**
 * Message to get settings
 */
export interface GetSettingsMessage extends WebviewMessageBase {
    type: 'getSettings';
}

/**
 * Message to update settings
 */
export interface UpdateSettingsMessage extends WebviewMessageBase {
    type: 'updateSettings';
    settings: ExtensionSettings;
}

/**
 * Message to get clipboard text
 */
export interface GetClipboardTextMessage extends WebviewMessageBase {
    type: 'getClipboardText';
}

/**
 * Message to select a model
 */
export interface SelectModelMessage extends WebviewMessageBase {
    type: 'selectModel';
    model: string;
}

/**
 * Message to open model terminal
 */
export interface OpenModelTerminalMessage extends WebviewMessageBase {
    type: 'openModelTerminal';
}

/**
 * Message to execute a slash command
 */
export interface ExecuteSlashCommandMessage extends WebviewMessageBase {
    type: 'executeSlashCommand';
    command: string;
}

/**
 * Message to dismiss WSL alert
 */
export interface DismissWSLAlertMessage extends WebviewMessageBase {
    type: 'dismissWSLAlert';
}

/**
 * Message to open a file
 */
export interface OpenFileMessage extends WebviewMessageBase {
    type: 'openFile';
    filePath: string;
}

/**
 * Message to create an image file
 */
export interface CreateImageFileMessage extends WebviewMessageBase {
    type: 'createImageFile';
    imageData: string;
    imageType: string;
}

/**
 * Message to handle permission response
 */
export interface PermissionResponseMessage extends WebviewMessageBase {
    type: 'permissionResponse';
    id: string;
    approved: boolean;
    alwaysAllow?: boolean;
}

/**
 * Message to get permissions
 */
export interface GetPermissionsMessage extends WebviewMessageBase {
    type: 'getPermissions';
}

/**
 * Message to remove a permission
 */
export interface RemovePermissionMessage extends WebviewMessageBase {
    type: 'removePermission';
    toolName: string;
    command: string | null;
}

/**
 * Message to add a permission
 */
export interface AddPermissionMessage extends WebviewMessageBase {
    type: 'addPermission';
    toolName: string;
    command: string;
}

/**
 * Message to load MCP servers
 */
export interface LoadMCPServersMessage extends WebviewMessageBase {
    type: 'loadMCPServers';
}

/**
 * Message to save an MCP server
 */
export interface SaveMCPServerMessage extends WebviewMessageBase {
    type: 'saveMCPServer';
    name: string;
    config: MCPServerConfig;
}

/**
 * Message to delete an MCP server
 */
export interface DeleteMCPServerMessage extends WebviewMessageBase {
    type: 'deleteMCPServer';
    name: string;
}

/**
 * Message to get custom snippets
 */
export interface GetCustomSnippetsMessage extends WebviewMessageBase {
    type: 'getCustomSnippets';
}

/**
 * Message to save a custom snippet
 */
export interface SaveCustomSnippetMessage extends WebviewMessageBase {
    type: 'saveCustomSnippet';
    snippet: CustomSnippet;
}

/**
 * Message to delete a custom snippet
 */
export interface DeleteCustomSnippetMessage extends WebviewMessageBase {
    type: 'deleteCustomSnippet';
    snippetId: string;
}

/**
 * Message to enable YOLO mode
 */
export interface EnableYoloModeMessage extends WebviewMessageBase {
    type: 'enableYoloMode';
}

/**
 * Message to save input text
 */
export interface SaveInputTextMessage extends WebviewMessageBase {
    type: 'saveInputText';
    text: string;
}

/**
 * Message to get checkpoints
 */
export interface GetCheckpointsMessage extends WebviewMessageBase {
    type: 'getCheckpoints';
}

/**
 * Message to preview restore
 */
export interface PreviewRestoreMessage extends WebviewMessageBase {
    type: 'previewRestore';
    checkpointId: string;
}

/**
 * Message to confirm restore
 */
export interface ConfirmRestoreMessage extends WebviewMessageBase {
    type: 'confirmRestore';
    checkpointId: string;
    options?: RestoreOptions;
}

/**
 * Message to get checkpoint stats
 */
export interface GetCheckpointStatsMessage extends WebviewMessageBase {
    type: 'getCheckpointStats';
}

/**
 * Message to clear checkpoints
 */
export interface ClearCheckpointsMessage extends WebviewMessageBase {
    type: 'clearCheckpoints';
}

/**
 * Message to undo restore
 */
export interface UndoRestoreMessage extends WebviewMessageBase {
    type: 'undoRestore';
}

/**
 * Message to get restore backup status
 */
export interface GetRestoreBackupStatusMessage extends WebviewMessageBase {
    type: 'getRestoreBackupStatus';
}

/**
 * Message to get context stats
 */
export interface GetContextStatsMessage extends WebviewMessageBase {
    type: 'getContextStats';
}

/**
 * Message to compact context
 */
export interface CompactContextMessage extends WebviewMessageBase {
    type: 'compactContext';
}

/**
 * Message to get snapshots
 */
export interface GetSnapshotsMessage extends WebviewMessageBase {
    type: 'getSnapshots';
}

/**
 * Message to restore snapshot
 */
export interface RestoreSnapshotMessage extends WebviewMessageBase {
    type: 'restoreSnapshot';
    snapshotId: string;
}

/**
 * Message to create snapshot
 */
export interface CreateSnapshotMessage extends WebviewMessageBase {
    type: 'createSnapshot';
}

/**
 * Message to get memory stats
 */
export interface GetMemoryStatsMessage extends WebviewMessageBase {
    type: 'getMemoryStats';
}

/**
 * Message to search memory
 */
export interface SearchMemoryMessage extends WebviewMessageBase {
    type: 'searchMemory';
    query: string;
}

/**
 * Message to clear memory
 */
export interface ClearMemoryMessage extends WebviewMessageBase {
    type: 'clearMemory';
}

/**
 * Documentation related messages
 */
export interface AddDocMessage extends WebviewMessageBase {
    type: 'addDoc';
    url: string;
    name: string;
    entryUrl?: string;
    prefixUrl?: string;
    maxPages?: number;
    maxDepth?: number;
}

export interface DeleteDocMessage extends WebviewMessageBase {
    type: 'deleteDoc';
    docId: string;
}

export interface ReindexDocMessage extends WebviewMessageBase {
    type: 'reindexDoc';
    docId: string;
}

export interface GetDocsListMessage extends WebviewMessageBase {
    type: 'getDocsList';
}

export interface LoadDocsMessage extends WebviewMessageBase {
    type: 'loadDocs';
}

/**
 * Additional message types
 */
export interface ClearAllCheckpointsMessage extends WebviewMessageBase {
    type: 'clearAllCheckpoints';
}

export interface RestoreFromBackupMessage extends WebviewMessageBase {
    type: 'restoreFromBackup';
}

export interface CheckRestoreBackupAvailableMessage extends WebviewMessageBase {
    type: 'checkRestoreBackupAvailable';
}

export interface BackupProjectContextMessage extends WebviewMessageBase {
    type: 'backupProjectContext';
    manual?: boolean;
}

export interface ViewProjectSnapshotsMessage extends WebviewMessageBase {
    type: 'viewProjectSnapshots';
}

export interface RestoreProjectContextMessage extends WebviewMessageBase {
    type: 'restoreProjectContext';
    snapshotId: string;
}

export interface SkipContextRestoreMessage extends WebviewMessageBase {
    type: 'skipContextRestore';
}

export interface EditAndRestorePromptMessage extends WebviewMessageBase {
    type: 'editAndRestorePrompt';
    messageIndex: number;
    editedContent: string;
    originalContent: string;
}

export interface GetMemoryContextMessage extends WebviewMessageBase {
    type: 'getMemoryContext';
}

export interface ExportMemoryMessage extends WebviewMessageBase {
    type: 'exportMemory';
}

export interface GetMemorySettingsMessage extends WebviewMessageBase {
    type: 'getMemorySettings';
}

export interface UpdateMemorySettingsMessage extends WebviewMessageBase {
    type: 'updateMemorySettings';
    settings: {
        autoInject: boolean;
        maxContextSize: number;
    };
}

// ==================== Task Manager Message Types ====================

/**
 * Message to get all tasks
 */
export interface GetAllTasksMessage extends WebviewMessageBase {
    type: 'getAllTasks';
}

/**
 * Message to get task details
 */
export interface GetTaskDetailsMessage extends WebviewMessageBase {
    type: 'getTaskDetails';
    taskId: string;
}

/**
 * Message to update task status
 */
export interface UpdateTaskStatusMessage extends WebviewMessageBase {
    type: 'updateTaskStatus';
    taskId: string;
    status: 'active' | 'completed' | 'deprecated';
}

/**
 * Message to create a task
 */
export interface CreateTaskMessage extends WebviewMessageBase {
    type: 'createTask';
    name: string;
    description: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    relatedFiles?: string[];
}

/**
 * Message to add observation to task
 */
export interface AddTaskObservationMessage extends WebviewMessageBase {
    type: 'addTaskObservation';
    taskId: string;
    observation: string;
}

/**
 * Message to get session health
 */
export interface GetSessionHealthMessage extends WebviewMessageBase {
    type: 'getSessionHealth';
}

/**
 * Message to force a new session
 */
export interface ForceNewSessionMessage extends WebviewMessageBase {
    type: 'forceNewSession';
}

/**
 * Message to save scratchpad items (CRITICAL FIX for persistence)
 */
export interface SaveScratchpadItemsMessage extends WebviewMessageBase {
    type: 'saveScratchpadItems';
    items: Array<{
        id: string;
        type: 'goal' | 'todo' | 'note' | 'decision';
        content: string;
        createdAt: string;
    }>;
}

/**
 * Message to get scratchpad items from storage
 */
export interface GetScratchpadItemsMessage extends WebviewMessageBase {
    type: 'getScratchpadItems';
}

/**
 * Union type for all webview messages
 */
export type WebviewMessage =
    | SendMessageMessage
    | NewSessionMessage
    | RestoreCommitMessage
    | GetConversationListMessage
    | GetWorkspaceFilesMessage
    | SelectImageFileMessage
    | LoadConversationMessage
    | StopRequestMessage
    | GetSettingsMessage
    | UpdateSettingsMessage
    | GetClipboardTextMessage
    | SelectModelMessage
    | OpenModelTerminalMessage
    | ExecuteSlashCommandMessage
    | DismissWSLAlertMessage
    | OpenFileMessage
    | CreateImageFileMessage
    | PermissionResponseMessage
    | GetPermissionsMessage
    | RemovePermissionMessage
    | AddPermissionMessage
    | LoadMCPServersMessage
    | SaveMCPServerMessage
    | DeleteMCPServerMessage
    | GetCustomSnippetsMessage
    | SaveCustomSnippetMessage
    | DeleteCustomSnippetMessage
    | EnableYoloModeMessage
    | SaveInputTextMessage
    | GetCheckpointsMessage
    | PreviewRestoreMessage
    | ConfirmRestoreMessage
    | GetCheckpointStatsMessage
    | ClearCheckpointsMessage
    | UndoRestoreMessage
    | GetRestoreBackupStatusMessage
    | GetContextStatsMessage
    | CompactContextMessage
    | GetSnapshotsMessage
    | RestoreSnapshotMessage
    | CreateSnapshotMessage
    | GetMemoryStatsMessage
    | SearchMemoryMessage
    | ClearMemoryMessage
    | AddDocMessage
    | DeleteDocMessage
    | ReindexDocMessage
    | GetDocsListMessage
    | LoadDocsMessage
    | ClearAllCheckpointsMessage
    | RestoreFromBackupMessage
    | CheckRestoreBackupAvailableMessage
    | BackupProjectContextMessage
    | ViewProjectSnapshotsMessage
    | RestoreProjectContextMessage
    | SkipContextRestoreMessage
    | EditAndRestorePromptMessage
    | GetMemoryContextMessage
    | ExportMemoryMessage
    | GetMemorySettingsMessage
    | UpdateMemorySettingsMessage
    | GetAllTasksMessage
    | GetTaskDetailsMessage
    | UpdateTaskStatusMessage
    | CreateTaskMessage
    | AddTaskObservationMessage
    | GetSessionHealthMessage
    | ForceNewSessionMessage
    | SaveScratchpadItemsMessage
    | GetScratchpadItemsMessage;

// ==================== Extension to Webview Message Types ====================

/**
 * Base interface for messages sent from extension to webview
 */
export interface ExtensionMessageBase {
    type: string;
}

/**
 * Message containing response data
 */
export interface ResponseMessage extends ExtensionMessageBase {
    type: 'response';
    data: string;
}

/**
 * Message indicating stream end
 */
export interface StreamEndMessage extends ExtensionMessageBase {
    type: 'streamEnd';
}

/**
 * Error message
 */
export interface ErrorMessage extends ExtensionMessageBase {
    type: 'error';
    data: {
        message: string;
    };
}

/**
 * Ready message
 */
export interface ReadyMessage extends ExtensionMessageBase {
    type: 'ready';
    data: {
        model: string;
        hasHistory: boolean;
    };
}

/**
 * Conversation list message
 */
export interface ConversationListMessage extends ExtensionMessageBase {
    type: 'conversationList';
    data: ConversationListItem[];
}

/**
 * Workspace files message
 */
export interface WorkspaceFilesMessage extends ExtensionMessageBase {
    type: 'workspaceFiles';
    data: WorkspaceFile[];
}

/**
 * Settings message
 */
export interface SettingsMessage extends ExtensionMessageBase {
    type: 'settings';
    data: ExtensionSettings;
}

/**
 * Memory injected message
 */
export interface MemoryInjectedMessage extends ExtensionMessageBase {
    type: 'memoryInjected';
    data: {
        entities: number;
        observations: number;
        contextSize: number;
    };
}

// ==================== Configuration Types ====================

/**
 * Extension settings
 */
export interface ExtensionSettings {
    model?: string;
    wslEnabled?: boolean;
    autoSave?: boolean;
    thinkingIntensity?: 'think' | 'think-hard' | 'think-harder' | 'ultrathink';
    planMode?: PlanModeType;
    memoryAutoInject?: boolean;
    memoryMaxContextSize?: number;
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
}

/**
 * Custom snippet
 */
export interface CustomSnippet {
    id: string;
    name: string;
    content: string;
    description?: string;
    category?: string;
}

/**
 * Restore options for checkpoints
 */
export interface RestoreOptions {
    createBackup?: boolean;
    preserveUntracked?: boolean;
    dryRun?: boolean;
}

// ==================== Data Types ====================

/**
 * Conversation list item
 */
export interface ConversationListItem {
    filename: string;
    sessionId: string;
    title: string;
    timestamp: number;
    messageCount: number;
}

/**
 * Workspace file
 */
export interface WorkspaceFile {
    path: string;
    name: string;
    type: 'file' | 'directory';
    size?: number;
}

/**
 * Permission request
 */
export interface PermissionRequest {
    id: string;
    toolName: string;
    command?: string;
    description?: string;
    timestamp: number;
}

/**
 * Allowed permission
 */
export interface AllowedPermission {
    toolName: string;
    command?: string;
    allowedAt: number;
}

// ==================== Utility Types ====================

/**
 * Result type for operations that can fail
 */
export interface OperationResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Async operation status
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
    dispose(): void;
}

/**
 * Event handler type
 */
export type EventHandler<T = void> = (data: T) => void;

/**
 * Debounced function type
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
}

/**
 * Cache entry with expiration
 */
export interface CacheEntry<T> {
    value: T;
    timestamp: number;
    expiresAt?: number;
}

/**
 * LRU Cache options
 */
export interface LRUCacheOptions {
    maxSize: number;
    ttlMs?: number;
}
