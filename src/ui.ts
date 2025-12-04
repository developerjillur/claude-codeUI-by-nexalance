import getScript from './script';
import styles from './ui-styles'


const getHtml = (isTelemetryEnabled: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Claude Code Chat</title>
	${styles}
</head>
<body>
	<div class="header">
		<div style="display: flex; align-items: center;">
			<h2>Claude Code Chat</h2>
			<!-- <div id="sessionInfo" class="session-badge" style="display: none;">
				<span class="session-icon">💬</span>
				<span id="sessionId">-</span>
				<span class="session-label">session</span>
			</div> -->
		</div>
		<div style="display: flex; gap: 8px; align-items: center;">
			<div id="sessionStatus" class="session-status" style="display: none;">No session</div>
			<button class="btn outlined" id="settingsBtn" onclick="toggleSettings()" title="Settings">⚙️</button>
			<button class="btn outlined" id="historyBtn" onclick="toggleConversationHistory()">📚 History</button>
			<button class="btn primary" id="newSessionBtn" onclick="newSession()">New Chat</button>
		</div>
	</div>
	
	<div id="conversationHistory" class="conversation-history" style="display: none;">
		<div class="conversation-header">
			<h3>Conversation History</h3>
			<button class="btn" onclick="toggleConversationHistory()">✕ Close</button>
		</div>
		<div id="conversationList" class="conversation-list">
			<!-- Conversations will be loaded here -->
		</div>
	</div>

	<!-- Activity Panel - Shows running agents/tasks -->
	<div id="activityPanel" class="activity-panel">
		<div class="activity-header">
			<span>Running Tasks</span>
			<span class="activity-count" id="activityCount">0</span>
		</div>
		<div class="activity-list" id="activityList">
			<!-- Activities will be dynamically added here -->
		</div>
	</div>

	<!-- Todo Panel - Shows current task progress -->
	<div id="todoPanel" class="todo-panel">
		<div class="todo-header">
			<div class="todo-title">
				<span>📋</span>
				<span>Task Progress</span>
			</div>
			<span class="todo-progress" id="todoProgress">0/0</span>
		</div>
		<div class="todo-list" id="todoList">
			<!-- Todo items will be dynamically added here -->
		</div>
	</div>

	<div class="chat-container" id="chatContainer">
		<div class="messages" id="messages"></div>
		
		<!-- WSL Alert for Windows users -->
		<div id="wslAlert" class="wsl-alert" style="display: none;">
			<div class="wsl-alert-content">
				<div class="wsl-alert-icon">💻</div>
				<div class="wsl-alert-text">
					<strong>Looks like you are using Windows!</strong><br/>
					If you are using WSL to run Claude Code, you should enable WSL integration in the settings.
				</div>
				<div class="wsl-alert-actions">
					<button class="btn" onclick="openWSLSettings()">Enable WSL</button>
					<button class="btn outlined" onclick="dismissWSLAlert()">Dismiss</button>
				</div>
			</div>
		</div>
		
		<div class="input-resize-handle" id="inputResizeHandle"></div>
		<div class="input-container" id="inputContainer">
			<div class="input-modes">
				<div class="mode-toggle">
					<span id="planModeLabel" onclick="togglePlanMode()">Plan First</span>
					<div class="mode-switch" id="planModeSwitch" onclick="togglePlanMode()"></div>
				</div>
				<div class="mode-toggle">
					<span id="thinkingModeLabel" onclick="toggleThinkingMode()">Thinking Mode</span>
					<div class="mode-switch" id="thinkingModeSwitch" onclick="toggleThinkingMode()"></div>
				</div>
			</div>
			<div class="textarea-container">
				<div class="textarea-wrapper">
					<textarea class="input-field" id="messageInput" placeholder="Type your message to Claude Code..." rows="1"></textarea>
					<div class="input-controls">
						<div class="left-controls">
							<button class="model-selector" id="modelSelector" onclick="showModelSelector()" title="Select model">
								<span id="selectedModel">Opus</span>
								<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
									<path d="M1 2.5l3 3 3-3"></path>
								</svg>
							</button>
							<button class="tools-btn" onclick="showMCPModal()" title="Configure MCP servers">
								MCP
								<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
									<path d="M1 2.5l3 3 3-3"></path>
								</svg>
							</button>
							<button class="tools-btn docs-btn" onclick="showDocsModal()" title="Manage documentation (@Docs)">
								📚 Docs
							</button>
							<div class="context-usage-container" id="contextUsageContainer" title="Context window usage">
								<div class="context-usage-circle" id="contextUsageCircle" onclick="showContextInfo()">
									<svg class="context-usage-svg" viewBox="0 0 36 36">
										<path class="context-circle-bg"
											d="M18 2.0845
												a 15.9155 15.9155 0 0 1 0 31.831
												a 15.9155 15.9155 0 0 1 0 -31.831"
											fill="none"
											stroke="rgba(255,255,255,0.1)"
											stroke-width="3"
										/>
										<path class="context-circle-progress" id="contextCircleProgress"
											d="M18 2.0845
												a 15.9155 15.9155 0 0 1 0 31.831
												a 15.9155 15.9155 0 0 1 0 -31.831"
											fill="none"
											stroke="#3b82f6"
											stroke-width="3"
											stroke-dasharray="0, 100"
											stroke-linecap="round"
										/>
									</svg>
									<span class="context-usage-text" id="contextUsageText">0%</span>
								</div>
								<div class="context-usage-tooltip" id="contextUsageTooltip">
									<div class="context-tooltip-header">Context Window</div>
									<div class="context-tooltip-body">
										<span id="contextRemainingText">100% remaining</span>
										<span id="contextAutoCompactText">until auto-compact</span>
									</div>
									<div class="context-tooltip-action" onclick="manualCompactContext()">
										Click to compact now
									</div>
								</div>
							</div>
							<button class="backup-context-btn" id="backupContextBtn" onclick="backupProjectContext()" title="Backup Project Context">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
									<polyline points="17 21 17 13 7 13 7 21"></polyline>
									<polyline points="7 3 7 8 15 8"></polyline>
								</svg>
							</button>
							<button class="tools-btn context-manager-btn" onclick="showContextManagerModal()" title="Context & Memory Manager">
								🧠
							</button>
						</div>
						<div class="right-controls">
							<button class="slash-btn" onclick="showSlashCommandsModal()" title="Slash commands">/</button>
							<button class="at-btn" onclick="showFilePicker()" title="Reference files">@</button>
							<button class="image-btn" id="imageBtn" onclick="selectImage()" title="Attach images">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 16 16"
								width="14"
								height="16"
								>
								<g fill="currentColor">
									<path d="M6.002 5.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0"></path>
									<path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2zm13 1a.5.5 0 0 1 .5.5v6l-3.775-1.947a.5.5 0 0 0-.577.093l-3.71 3.71l-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12v.54L1 12.5v-9a.5.5 0 0 1 .5-.5z"></path>
								</g>
							</svg>
							</button>
							<button class="send-btn" id="sendBtn" onclick="handleSendOrStop()">
								<div class="send-state">
									<span>Send </span>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11">
										<path fill="currentColor" d="M20 4v9a4 4 0 0 1-4 4H6.914l2.5 2.5L8 20.914L3.086 16L8 11.086L9.414 12.5l-2.5 2.5H16a2 2 0 0 0 2-2V4z"></path>
									</svg>
								</div>
								<div class="stop-state" style="display: none;">
									<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
										<rect x="6" y="6" width="12" height="12" rx="2"/>
									</svg>
									<span>Stop</span>
								</div>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	
	<div class="status ready" id="status">
		<div class="status-indicator"></div>
		<div class="status-text" id="statusText">Initializing...</div>
		<button class="btn stop" id="stopBtn" onclick="stopRequest()" style="display: none;">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
				<path d="M6 6h12v12H6z"/>
			</svg>
			Stop
		</button>
	</div>

			<div id="yoloWarning" class="yolo-warning" style="display: none;">
			⚠️ Yolo Mode Active: Claude Code will auto-approve all tool requests.
		</div>

	<!-- File picker modal -->
	<div id="filePickerModal" class="file-picker-modal" style="display: none;">
		<div class="file-picker-content">
			<div class="file-picker-header">
				<span>Select File</span>
				<input type="text" id="fileSearchInput" placeholder="Search files..." class="file-search-input">
			</div>
			<div id="fileList" class="file-list">
				<!-- Files will be loaded here -->
			</div>
		</div>
	</div>

	<!-- MCP Servers modal -->
	<div id="mcpModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content">
			<div class="tools-modal-header">
				<span>MCP Servers</span>
				<button class="tools-close-btn" onclick="hideMCPModal()">✕</button>
			</div>
			<div class="tools-list">
				<div class="mcp-servers-list" id="mcpServersList">
					<!-- MCP servers will be loaded here -->
				</div>
				<div class="mcp-add-server">
					<button class="btn outlined" onclick="showAddServerForm()" id="addServerBtn">+ Add MCP Server</button>
				</div>
				<div class="mcp-popular-servers" id="popularServers">
					<h4>Popular MCP Servers</h4>
					<div class="popular-servers-grid">
						<div class="popular-server-item" onclick="addPopularServer('context7', { type: 'http', url: 'https://context7.liam.sh/mcp' })">
							<div class="popular-server-icon">📚</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Context7</div>
								<div class="popular-server-desc">Up-to-date Code Docs For Any Prompt</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('sequential-thinking', { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] })">
							<div class="popular-server-icon">🔗</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Sequential Thinking</div>
								<div class="popular-server-desc">Step-by-step reasoning capabilities</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('memory', { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] })">
							<div class="popular-server-icon">🧠</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Memory</div>
								<div class="popular-server-desc">Knowledge graph storage</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('puppeteer', { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] })">
							<div class="popular-server-icon">🎭</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Puppeteer</div>
								<div class="popular-server-desc">Browser automation</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('fetch', { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] })">
							<div class="popular-server-icon">🌐</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Fetch</div>
								<div class="popular-server-desc">HTTP requests & web scraping</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('filesystem', { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] })">
							<div class="popular-server-icon">📁</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Filesystem</div>
								<div class="popular-server-desc">File operations & management</div>
							</div>
						</div>
						<div class="popular-server-item" onclick="addPopularServer('playwright', { type: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'] })">
							<div class="popular-server-icon">🎬</div>
							<div class="popular-server-info">
								<div class="popular-server-name">Playwright</div>
								<div class="popular-server-desc">Browser automation & testing</div>
							</div>
						</div>
					</div>
				</div>
				<div class="mcp-add-form" id="addServerForm" style="display: none;">
				<div class="form-group">
					<label for="serverName">Server Name:</label>
					<input type="text" id="serverName" placeholder="my-server" required>
				</div>
				<div class="form-group">
					<label for="serverType">Server Type:</label>
					<select id="serverType" onchange="updateServerForm()">
						<option value="http">HTTP</option>
						<option value="sse">SSE</option>
						<option value="stdio">stdio</option>
					</select>
				</div>
				<div class="form-group" id="commandGroup" style="display: none;">
					<label for="serverCommand">Command:</label>
					<input type="text" id="serverCommand" placeholder="/path/to/server">
				</div>
				<div class="form-group" id="urlGroup">
					<label for="serverUrl">URL:</label>
					<input type="text" id="serverUrl" placeholder="https://example.com/mcp">
				</div>
				<div class="form-group" id="argsGroup" style="display: none;">
					<label for="serverArgs">Arguments (one per line):</label>
					<textarea id="serverArgs" placeholder="--api-key&#10;abc123" rows="3"></textarea>
				</div>
				<div class="form-group" id="envGroup" style="display: none;">
					<label for="serverEnv">Environment Variables (KEY=value, one per line):</label>
					<textarea id="serverEnv" placeholder="API_KEY=123&#10;CACHE_DIR=/tmp" rows="3"></textarea>
				</div>
				<div class="form-group" id="headersGroup">
					<label for="serverHeaders">Headers (KEY=value, one per line):</label>
					<textarea id="serverHeaders" placeholder="Authorization=Bearer token&#10;X-API-Key=key" rows="3"></textarea>
				</div>
				<div class="form-buttons">
					<button class="btn" onclick="saveMCPServer()">Add Server</button>
					<button class="btn outlined" onclick="hideAddServerForm()">Cancel</button>
				</div>
			</div>
		</div>
	</div>
	</div>

	<!-- Docs Manager modal -->
	<div id="docsModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content docs-modal-content">
			<div class="tools-modal-header">
				<span>📚 Documentation Manager</span>
				<button class="tools-close-btn" onclick="hideDocsModal()">✕</button>
			</div>
			<div class="docs-modal-body">
				<p class="docs-description">Crawl and index documentation websites. Reference them in chat using @DocName mentions.</p>

				<div class="docs-list" id="docsList">
					<!-- Docs will be loaded here -->
				</div>

				<div class="docs-add-section">
					<button class="btn outlined" onclick="showAddDocForm()" id="addDocBtn">+ Add Documentation</button>
				</div>

				<div class="docs-add-form" id="addDocForm" style="display: none;">
					<h4>Add New Documentation</h4>
					<div class="form-group">
						<label for="docName">Name:</label>
						<input type="text" id="docName" placeholder="e.g., React, PyTorch, TailwindCSS" required>
						<span class="form-hint">This is how you'll reference it: @React</span>
					</div>
					<div class="form-group">
						<label for="docEntryUrl">Entry URL:</label>
						<input type="text" id="docEntryUrl" placeholder="https://docs.example.com/getting-started" required>
						<span class="form-hint">Starting page for crawling</span>
					</div>
					<div class="form-group">
						<label for="docPrefixUrl">Prefix URL (optional):</label>
						<input type="text" id="docPrefixUrl" placeholder="https://docs.example.com/">
						<span class="form-hint">Limit crawling to URLs starting with this prefix</span>
					</div>
					<div class="docs-advanced-toggle" onclick="toggleDocsAdvanced()">
						<span>▶ Advanced Options</span>
					</div>
					<div class="docs-advanced-options" id="docsAdvancedOptions" style="display: none;">
						<div class="form-row">
							<div class="form-group">
								<label for="docMaxPages">Max Pages:</label>
								<input type="number" id="docMaxPages" value="50" min="1" max="200">
							</div>
							<div class="form-group">
								<label for="docMaxDepth">Max Depth:</label>
								<input type="number" id="docMaxDepth" value="3" min="1" max="10">
							</div>
						</div>
					</div>
					<div class="form-buttons">
						<button class="btn" onclick="startAddDoc()">🔍 Start Crawling</button>
						<button class="btn outlined" onclick="hideAddDocForm()">Cancel</button>
					</div>
				</div>

				<div class="docs-stats" id="docsStats">
					<!-- Stats will be loaded here -->
				</div>
			</div>
		</div>
	</div>

	<!-- Unified Context Manager Modal -->
	<div id="contextManagerModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content context-manager-modal-content">
			<div class="tools-modal-header context-manager-header">
				<div class="context-manager-title">
					<span class="context-manager-icon">🧠</span>
					<span>Context Manager</span>
				</div>
				<button class="tools-close-btn" onclick="hideContextManagerModal()">✕</button>
			</div>

			<!-- Tab Navigation -->
			<div class="context-manager-tabs">
				<button class="context-tab active" data-tab="overview" onclick="switchContextTab('overview')">
					<span class="tab-icon">📊</span>
					<span class="tab-label">Overview</span>
				</button>
				<button class="context-tab" data-tab="memory" onclick="switchContextTab('memory')">
					<span class="tab-icon">🧠</span>
					<span class="tab-label">Memory</span>
				</button>
				<button class="context-tab" data-tab="tasks" onclick="switchContextTab('tasks')">
					<span class="tab-icon">📋</span>
					<span class="tab-label">Tasks</span>
				</button>
				<button class="context-tab" data-tab="scratchpad" onclick="switchContextTab('scratchpad')">
					<span class="tab-icon">📝</span>
					<span class="tab-label">Scratchpad</span>
				</button>
				<button class="context-tab" data-tab="settings" onclick="switchContextTab('settings')">
					<span class="tab-icon">⚙️</span>
					<span class="tab-label">Settings</span>
				</button>
			</div>

			<div class="context-manager-body">
				<!-- Overview Tab -->
				<div class="context-tab-content active" id="tab-overview">
					<div class="context-overview-description">
						<p>Intelligent context management powered by priority-based memory injection, knowledge graphs, and real-time session tracking.</p>
					</div>

					<!-- Real-time Session Health -->
					<div class="context-session-health">
						<div class="session-health-header">
							<div class="session-health-status">
								<span class="session-health-icon" id="ctxSessionHealthIcon">🟢</span>
								<span class="session-health-title">Session Health</span>
								<span class="session-health-badge" id="ctxSessionHealthBadge">Healthy</span>
							</div>
							<button class="btn small outlined refresh-btn" onclick="refreshContextOverview()">
								<span class="refresh-icon">🔄</span>
							</button>
						</div>
						<div class="session-health-bar-container">
							<div class="session-health-bar">
								<div class="session-health-progress" id="ctxSessionHealthProgress" style="width: 0%"></div>
							</div>
							<span class="session-health-percent" id="ctxSessionHealthPercent">0%</span>
						</div>
						<div class="session-health-details">
							<div class="health-detail-item">
								<span class="health-detail-label">Tokens Used</span>
								<span class="health-detail-value" id="ctxTokensUsed">0</span>
							</div>
							<div class="health-detail-item">
								<span class="health-detail-label">Messages</span>
								<span class="health-detail-value" id="ctxMessageCount">0</span>
							</div>
							<div class="health-detail-item">
								<span class="health-detail-label">Avg/Message</span>
								<span class="health-detail-value" id="ctxAvgTokens">0</span>
							</div>
						</div>
						<div class="session-health-recommendation" id="ctxSessionRecommendation" style="display: none;">
							<span class="recommendation-icon">⚠️</span>
							<span class="recommendation-text" id="ctxRecommendationText"></span>
							<button class="btn small primary" onclick="forceNewSession()">New Session</button>
						</div>
					</div>

					<!-- Quick Stats Grid -->
					<div class="context-quick-stats">
						<div class="quick-stat-card" onclick="switchContextTab('memory')">
							<div class="quick-stat-icon">🧠</div>
							<div class="quick-stat-content">
								<span class="quick-stat-value" id="ctxTotalEntities">0</span>
								<span class="quick-stat-label">Memory Entities</span>
							</div>
							<span class="quick-stat-arrow">→</span>
						</div>
						<div class="quick-stat-card" onclick="switchContextTab('tasks')">
							<div class="quick-stat-icon">📋</div>
							<div class="quick-stat-content">
								<span class="quick-stat-value" id="ctxActiveTasks">0</span>
								<span class="quick-stat-label">Active Tasks</span>
							</div>
							<span class="quick-stat-arrow">→</span>
						</div>
						<div class="quick-stat-card" onclick="switchContextTab('scratchpad')">
							<div class="quick-stat-icon">📝</div>
							<div class="quick-stat-content">
								<span class="quick-stat-value" id="ctxScratchpadItems">0</span>
								<span class="quick-stat-label">Scratchpad Items</span>
							</div>
							<span class="quick-stat-arrow">→</span>
						</div>
						<div class="quick-stat-card info">
							<div class="quick-stat-icon">⚡</div>
							<div class="quick-stat-content">
								<span class="quick-stat-value" id="ctxInjectionStatus">Ready</span>
								<span class="quick-stat-label">Smart Injection</span>
							</div>
						</div>
					</div>

					<!-- Context Priority Preview -->
					<div class="context-priority-section">
						<div class="priority-header">
							<h4>Context Priority Allocation</h4>
							<span class="priority-info" title="How context budget is distributed across priority tiers">ℹ️</span>
						</div>
						<div class="priority-bars">
							<div class="priority-bar-item">
								<div class="priority-bar-label">
									<span class="priority-dot critical"></span>
									<span>Critical</span>
								</div>
								<div class="priority-bar-track">
									<div class="priority-bar-fill critical" id="priorityCritical" style="width: 15%"></div>
								</div>
								<span class="priority-bar-percent" id="priorityCriticalPercent">15%</span>
							</div>
							<div class="priority-bar-item">
								<div class="priority-bar-label">
									<span class="priority-dot high"></span>
									<span>High</span>
								</div>
								<div class="priority-bar-track">
									<div class="priority-bar-fill high" id="priorityHigh" style="width: 35%"></div>
								</div>
								<span class="priority-bar-percent" id="priorityHighPercent">35%</span>
							</div>
							<div class="priority-bar-item">
								<div class="priority-bar-label">
									<span class="priority-dot medium"></span>
									<span>Medium</span>
								</div>
								<div class="priority-bar-track">
									<div class="priority-bar-fill medium" id="priorityMedium" style="width: 30%"></div>
								</div>
								<span class="priority-bar-percent" id="priorityMediumPercent">30%</span>
							</div>
							<div class="priority-bar-item">
								<div class="priority-bar-label">
									<span class="priority-dot low"></span>
									<span>Low</span>
								</div>
								<div class="priority-bar-track">
									<div class="priority-bar-fill low" id="priorityLow" style="width: 20%"></div>
								</div>
								<span class="priority-bar-percent" id="priorityLowPercent">20%</span>
							</div>
						</div>
					</div>

					<!-- Recent Activity -->
					<div class="context-recent-activity">
						<h4>Recent Memory Activity</h4>
						<div class="activity-timeline" id="ctxActivityTimeline">
							<div class="activity-empty">No recent activity. Start chatting to build memory.</div>
						</div>
					</div>
				</div>

				<!-- Memory Tab -->
				<div class="context-tab-content" id="tab-memory">
					<div class="memory-header-row">
						<div class="memory-stats-inline">
							<div class="stat-chip">
								<span class="stat-chip-value" id="memoryTotalEntities">0</span>
								<span class="stat-chip-label">entities</span>
							</div>
							<div class="stat-chip">
								<span class="stat-chip-value" id="memoryTotalRelations">0</span>
								<span class="stat-chip-label">relations</span>
							</div>
							<div class="stat-chip">
								<span class="stat-chip-value" id="memoryTotalObservations">0</span>
								<span class="stat-chip-label">observations</span>
							</div>
						</div>
						<span class="memory-last-update" id="memoryLastUpdated">Updated just now</span>
					</div>

					<div class="memory-search-section">
						<div class="memory-search-wrapper">
							<span class="search-icon">🔍</span>
							<input type="text" id="memorySearchInput" class="memory-search-input" placeholder="Search memory..." oninput="debounceMemorySearch(this.value)">
						</div>
					</div>

					<div class="memory-graph-section" id="memoryEntitiesSection">
						<div class="memory-graph-header">
							<h4>Knowledge Graph</h4>
							<button class="btn small outlined" onclick="generateMemoryContext()">Preview Context</button>
						</div>
						<div class="memory-entity-types" id="memoryEntityTypes">
							<!-- Entity type breakdown will be loaded here -->
						</div>
					</div>

					<div class="memory-search-results" id="memorySearchResults" style="display: none;">
						<h4>Search Results</h4>
						<div class="memory-results-list" id="memoryResultsList">
							<!-- Search results will be loaded here -->
						</div>
					</div>

					<div class="memory-context-section" id="memoryContextSection" style="display: none;">
						<div class="context-preview-header">
							<h4>Context Preview</h4>
							<button class="btn small" onclick="closeContextPreview()">Close</button>
						</div>
						<div class="memory-context-preview" id="memoryContextPreview">
							<p class="memory-context-hint">Loading context preview...</p>
						</div>
					</div>

					<div class="memory-actions-row">
						<button class="btn outlined" onclick="exportProjectMemory()">
							<span>📤</span> Export
						</button>
						<button class="btn outlined danger" onclick="confirmClearMemory()">
							<span>🗑️</span> Clear All
						</button>
					</div>
				</div>

				<!-- Tasks Tab -->
				<div class="context-tab-content" id="tab-tasks">
					<div class="tasks-header-row">
						<div class="task-filters">
							<button class="task-filter-btn active" data-filter="all" onclick="filterTasks('all')">All</button>
							<button class="task-filter-btn" data-filter="active" onclick="filterTasks('active')">Active</button>
							<button class="task-filter-btn" data-filter="completed" onclick="filterTasks('completed')">Completed</button>
						</div>
						<button class="btn small outlined" onclick="refreshTaskList()">🔄 Refresh</button>
					</div>

					<div class="task-list-container">
						<div class="task-list" id="taskList">
							<div class="task-list-empty">
								<span class="empty-icon">📋</span>
								<p>No tasks found</p>
								<span class="empty-hint">Tasks are automatically extracted from your conversations</span>
							</div>
						</div>
					</div>

					<!-- Task Details Panel (shown when a task is selected) -->
					<div class="task-details-panel" id="taskDetailsPanel" style="display: none;">
						<div class="task-details-header">
							<button class="btn small" onclick="hideTaskDetails()">← Back</button>
							<span class="task-details-title" id="taskDetailsTitle">Task Details</span>
						</div>
						<div class="task-details-content" id="taskDetailsContent">
							<!-- Task details will be loaded here -->
						</div>
					</div>

					<!-- Create Task Section -->
					<div class="create-task-section collapsed" id="createTaskSection">
						<button class="create-task-toggle" onclick="toggleCreateTask()">
							<span>+ Create New Task</span>
						</button>
						<div class="create-task-form" id="createTaskForm">
							<input type="text" id="newTaskName" placeholder="Task name..." class="task-input">
							<textarea id="newTaskDescription" placeholder="Description..." class="task-textarea" rows="2"></textarea>
							<div class="create-task-options">
								<select id="newTaskImportance" class="task-select">
									<option value="low">Low</option>
									<option value="medium" selected>Medium</option>
									<option value="high">High</option>
									<option value="critical">Critical</option>
								</select>
								<button class="btn primary" onclick="createNewTask()">Create</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Scratchpad Tab -->
				<div class="context-tab-content" id="tab-scratchpad">
					<div class="scratchpad-description">
						<p>Quick notes and goals that boost attention in context injection. Items here get priority in AI responses.</p>
					</div>

					<div class="scratchpad-add-section">
						<div class="scratchpad-add-form">
							<select id="scratchpadType" class="scratchpad-type-select">
								<option value="goal">🎯 Goal</option>
								<option value="todo">📌 Todo</option>
								<option value="note">📝 Note</option>
								<option value="decision">✅ Decision</option>
							</select>
							<input type="text" id="scratchpadContent" placeholder="Add a note, goal, or decision..." class="scratchpad-input">
							<button class="btn primary" onclick="addScratchpadItem()">Add</button>
						</div>
					</div>

					<div class="scratchpad-list" id="scratchpadList">
						<div class="scratchpad-empty">
							<span class="empty-icon">📝</span>
							<p>No scratchpad items</p>
							<span class="empty-hint">Add goals or notes to boost their priority in context</span>
						</div>
					</div>
				</div>

				<!-- Settings Tab -->
				<div class="context-tab-content" id="tab-settings">
					<div class="settings-section">
						<h4>Context Injection</h4>
						<div class="setting-item">
							<div class="setting-row">
								<div class="setting-info">
									<span class="setting-title">Auto-inject Context</span>
									<span class="setting-desc">Automatically include relevant memory in prompts</span>
								</div>
								<label class="toggle-switch">
									<input type="checkbox" id="memoryAutoInject" onchange="updateMemorySettings()">
									<span class="toggle-slider"></span>
								</label>
							</div>
						</div>
						<div class="setting-item">
							<div class="setting-row">
								<div class="setting-info">
									<span class="setting-title">Use Advanced Engine</span>
									<span class="setting-desc">Priority-based context with compression and decay</span>
								</div>
								<label class="toggle-switch">
									<input type="checkbox" id="useAdvancedEngine" checked onchange="updateAdvancedEngineSettings()">
									<span class="toggle-slider"></span>
								</label>
							</div>
						</div>
					</div>

					<div class="settings-section">
						<h4>Context Budget</h4>
						<div class="setting-item">
							<div class="setting-info">
								<span class="setting-title">Max Context Size</span>
								<span class="setting-desc">Maximum tokens for memory injection</span>
							</div>
							<div class="setting-input-group">
								<input type="number" id="memoryMaxContext" min="500" max="16000" step="500" value="4000" onchange="updateMemorySettings()">
								<span class="setting-unit">tokens</span>
							</div>
						</div>
						<div class="context-slider-container">
							<input type="range" id="memoryMaxContextSlider" min="500" max="16000" step="500" value="4000" oninput="syncMemoryContextSlider(this.value)">
							<div class="slider-labels">
								<span>500</span>
								<span>4K</span>
								<span>8K</span>
								<span>12K</span>
								<span>16K</span>
							</div>
						</div>
					</div>

					<div class="settings-section">
						<h4>Memory Decay</h4>
						<div class="setting-item">
							<div class="setting-info">
								<span class="setting-title">Decay Half-Life</span>
								<span class="setting-desc">Hours until memory relevance drops 50%</span>
							</div>
							<div class="setting-input-group">
								<input type="number" id="decayHalfLife" min="1" max="168" value="24" onchange="updateDecaySettings()">
								<span class="setting-unit">hours</span>
							</div>
						</div>
					</div>

					<div class="settings-section">
						<h4>Storage</h4>
						<div class="storage-info">
							<div class="storage-item">
								<span class="storage-icon">📁</span>
								<span class="storage-path">.claude/memory.jsonl</span>
								<span class="storage-label">Memory</span>
							</div>
							<div class="storage-item">
								<span class="storage-icon">📝</span>
								<span class="storage-path">.claude/scratchpad.json</span>
								<span class="storage-label">Scratchpad</span>
							</div>
							<div class="storage-item">
								<span class="storage-icon">🔗</span>
								<span class="storage-path">.claude/memory-graph.json</span>
								<span class="storage-label">Graph</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer with real-time status -->
			<div class="context-manager-footer">
				<div class="footer-status">
					<span class="status-dot" id="ctxFooterStatusDot"></span>
					<span class="status-text" id="ctxFooterStatusText">Ready</span>
				</div>
				<div class="footer-actions">
					<button class="btn small outlined" onclick="exportProjectMemory()">Export</button>
					<button class="btn small primary" onclick="refreshContextOverview()">Refresh All</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Settings modal -->
	<div id="settingsModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content">
			<div class="tools-modal-header">
				<span>Claude Code Chat Settings</span>
				<button class="tools-close-btn" onclick="hideSettingsModal()">✕</button>
			</div>
			<div class="tools-list">
				<h3 style="margin-top: 0; margin-bottom: 16px; font-size: 14px; font-weight: 600;">WSL Configuration</h3>
				<div>
					<p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin: 0;">
						WSL integration allows you to run Claude Code from within Windows Subsystem for Linux.
						This is useful if you have Claude installed in WSL instead of Windows.
					</p>
				</div>
				<div class="settings-group">
					<div class="tool-item">
						<input type="checkbox" id="wsl-enabled" onchange="updateSettings()">
						<label for="wsl-enabled">Enable WSL Integration</label>
					</div>
					
					<div id="wslOptions" style="margin-left: 24px; margin-top: 12px;">
						<div style="margin-bottom: 12px;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--vscode-descriptionForeground);">WSL Distribution</label>
							<input type="text" id="wsl-distro" class="file-search-input" style="width: 100%;" placeholder="Ubuntu" onchange="updateSettings()">
						</div>
						
						<div style="margin-bottom: 12px;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--vscode-descriptionForeground);">Node.js Path in WSL</label>
							<input type="text" id="wsl-node-path" class="file-search-input" style="width: 100%;" placeholder="/usr/bin/node" onchange="updateSettings()">
							<p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin: 4px 0 0 0;">
								Find your node installation path in WSL by running: <code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">which node</code>
							</p>
						</div>
						
						<div style="margin-bottom: 12px;">
							<label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--vscode-descriptionForeground);">Claude Path in WSL</label>
							<input type="text" id="wsl-claude-path" class="file-search-input" style="width: 100%;" placeholder="/usr/local/bin/claude" onchange="updateSettings()">
							<p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin: 4px 0 0 0;">
								Find your claude installation path in WSL by running: <code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">which claude</code>
							</p>
						</div>
					</div>
				</div>

				<h3 style="margin-top: 24px; margin-bottom: 16px; font-size: 14px; font-weight: 600;">Permissions</h3>
				<div>
					<p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin: 0;">
						Manage commands and tools that are automatically allowed without asking for permission.
					</p>
				</div>
				<div class="settings-group">
					<div id="permissionsList" class="permissions-list">
						<div class="permissions-loading" style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">
							Loading permissions...
						</div>
					</div>
					<div class="permissions-add-section">
						<div id="addPermissionForm" class="permissions-add-form" style="display: none;">
							<div class="permissions-form-row">
								<select id="addPermissionTool" class="permissions-tool-select" onchange="toggleCommandInput()">
									<option value="">Select tool...</option>
									<option value="Bash">Bash</option>
									<option value="Read">Read</option>
									<option value="Edit">Edit</option>
									<option value="Write">Write</option>
									<option value="MultiEdit">MultiEdit</option>
									<option value="Glob">Glob</option>
									<option value="Grep">Grep</option>
									<option value="LS">LS</option>
									<option value="WebSearch">WebSearch</option>
									<option value="WebFetch">WebFetch</option>
								</select>
								<div style="flex-grow: 1; display: flex;">
									<input type="text" id="addPermissionCommand" class="permissions-command-input" placeholder="Command pattern (e.g., npm i *)" style="display: none;" />
								</div>
								<button id="addPermissionBtn" class="permissions-add-btn" onclick="addPermission()">Add</button>
							</div>
							<div id="permissionsFormHint" class="permissions-form-hint">
								Select a tool to add always-allow permission.
							</div>
						</div>
						<button id="showAddPermissionBtn" class="permissions-show-add-btn" onclick="showAddPermissionForm()">
							+ Add permission
						</button>
						<div class="yolo-mode-section">
							<input type="checkbox" id="yolo-mode" onchange="updateSettings(); updateYoloWarning();">
							<label for="yolo-mode">Enable Yolo Mode (Auto-allow all permissions)</label>
						</div>
					</div>
				</div>

				
			</div>
		</div>
	</div>

	<!-- Model selector modal -->
	<div id="modelModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content" style="width: 450px;">
			<div class="tools-modal-header">
				<span>Select Model</span>
				<button class="tools-close-btn" onclick="hideModelModal()">✕</button>
			</div>
			<div class="model-explanatory-text">
				Choose a model for this conversation. Higher capability models provide better results but may be slower.
			</div>
			<div class="tools-list">
				<div class="tool-item" onclick="selectModel('opus')">
					<input type="radio" name="model" id="model-opus" value="opus">
					<label for="model-opus">
						<div class="model-title">
							<span class="model-name">Opus 4.5</span>
							<span class="model-badge premium">Most Powerful</span>
						</div>
						<div class="model-description">
							Best for complex reasoning, creative tasks, and highest quality output. Extended thinking support.
						</div>
						<div class="model-specs">200K context • Max output 64K tokens • $5/$25 per 1M tokens</div>
					</label>
				</div>
				<div class="tool-item" onclick="selectModel('sonnet')">
					<input type="radio" name="model" id="model-sonnet" value="sonnet" checked>
					<label for="model-sonnet">
						<div class="model-title">
							<span class="model-name">Sonnet 4.5</span>
							<span class="model-badge recommended">Recommended</span>
						</div>
						<div class="model-description">
							Excellent balance of capability, speed, and cost. Great for most coding tasks.
						</div>
						<div class="model-specs">200K context • Max output 16K tokens • $3/$15 per 1M tokens</div>
					</label>
				</div>
				<div class="tool-item" onclick="selectModel('haiku')">
					<input type="radio" name="model" id="model-haiku" value="haiku">
					<label for="model-haiku">
						<div class="model-title">
							<span class="model-name">Haiku 4.5</span>
							<span class="model-badge fast">Fast & Efficient</span>
						</div>
						<div class="model-description">
							Fast responses, cost-efficient. 90% of Sonnet capability at lower cost.
						</div>
						<div class="model-specs">200K context • Max output 8K tokens • $0.80/$4 per 1M tokens</div>
					</label>
				</div>
				<div class="tool-item model-divider" onclick="selectModel('default')">
					<input type="radio" name="model" id="model-default" value="default">
					<label for="model-default" class="default-model-layout">
						<div class="model-option-content">
							<div class="model-title">
								<span class="model-name">Default</span>
								<span class="model-badge default">User Config</span>
							</div>
							<div class="model-description">
								Uses your Claude Code CLI default model configuration
							</div>
						</div>
						<button class="secondary-button configure-button" onclick="event.stopPropagation(); openModelTerminal();">
							Configure
						</button>
					</label>
				</div>
			</div>
		</div>
	</div>

	<!-- Thinking intensity modal -->
	<div id="thinkingIntensityModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content" style="width: 450px;">
			<div class="tools-modal-header">
				<span>Thinking Mode Intensity</span>
				<button class="tools-close-btn" onclick="hideThinkingIntensityModal()">✕</button>
			</div>
			<div class="thinking-modal-description">
				Configure the intensity of thinking mode. Higher levels provide more detailed reasoning but consume more tokens.
			</div>
			<div class="tools-list">
				<div class="thinking-slider-container">
					<input type="range" min="0" max="3" value="0" step="1" class="thinking-slider" id="thinkingIntensitySlider" oninput="updateThinkingIntensityDisplay(this.value)">
					<div class="slider-labels">
						<div class="slider-label active" id="thinking-label-0" onclick="setThinkingIntensityValue(0)">Think</div>
						<div class="slider-label" id="thinking-label-1" onclick="setThinkingIntensityValue(1)">Think Hard</div>
						<div class="slider-label" id="thinking-label-2" onclick="setThinkingIntensityValue(2)">Think Harder</div>
						<div class="slider-label" id="thinking-label-3" onclick="setThinkingIntensityValue(3)">Ultrathink</div>
					</div>
				</div>
				<div class="thinking-modal-actions">
					<button class="confirm-btn" onclick="confirmThinkingIntensity()">Confirm</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Plan Mode modal -->
	<div id="planModeModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content" style="width: 450px;">
			<div class="tools-modal-header">
				<span>Plan Mode Selection</span>
				<button class="tools-close-btn" onclick="hidePlanModeModal()">✕</button>
			</div>
			<div class="plan-modal-description">
				Choose how Claude should approach your request. Each mode offers different levels of planning and interaction.
			</div>
			<div class="tools-list">
				<div class="plan-mode-options">
					<div class="plan-mode-option" id="planMode-planfast" onclick="selectPlanMode('planfast')">
						<div class="plan-mode-radio">
							<input type="radio" name="planMode" id="radio-planfast" value="planfast">
							<span class="plan-mode-radio-custom"></span>
						</div>
						<div class="plan-mode-content">
							<div class="plan-mode-title">
								<span class="plan-mode-icon">⚡</span>
								<span class="plan-mode-name">Plan Fast</span>
								<span class="plan-mode-badge fast">Quick</span>
							</div>
							<div class="plan-mode-desc">Quick planning overview before implementation. Shows brief plan then proceeds automatically.</div>
						</div>
					</div>
					<div class="plan-mode-option" id="planMode-ask" onclick="selectPlanMode('ask')">
						<div class="plan-mode-radio">
							<input type="radio" name="planMode" id="radio-ask" value="ask">
							<span class="plan-mode-radio-custom"></span>
						</div>
						<div class="plan-mode-content">
							<div class="plan-mode-title">
								<span class="plan-mode-icon">💬</span>
								<span class="plan-mode-name">Ask</span>
								<span class="plan-mode-badge interactive">Interactive</span>
							</div>
							<div class="plan-mode-desc">Detailed planning with approval required. Shows comprehensive plan and waits for your confirmation before proceeding.</div>
						</div>
					</div>
					<div class="plan-mode-option" id="planMode-agent" onclick="selectPlanMode('agent')">
						<div class="plan-mode-radio">
							<input type="radio" name="planMode" id="radio-agent" value="agent">
							<span class="plan-mode-radio-custom"></span>
						</div>
						<div class="plan-mode-content">
							<div class="plan-mode-title">
								<span class="plan-mode-icon">🤖</span>
								<span class="plan-mode-name">Agent</span>
								<span class="plan-mode-badge autonomous">Autonomous</span>
							</div>
							<div class="plan-mode-desc">Full autonomous agent mode. Claude analyzes, plans, and executes tasks independently with minimal intervention.</div>
						</div>
					</div>
					<div class="plan-mode-option" id="planMode-auto" onclick="selectPlanMode('auto')">
						<div class="plan-mode-radio">
							<input type="radio" name="planMode" id="radio-auto" value="auto">
							<span class="plan-mode-radio-custom"></span>
						</div>
						<div class="plan-mode-content">
							<div class="plan-mode-title">
								<span class="plan-mode-icon">🎯</span>
								<span class="plan-mode-name">AutoMode</span>
								<span class="plan-mode-badge automode">Plan + Execute</span>
							</div>
							<div class="plan-mode-desc">Highest quality output. Creates comprehensive plan first, then automatically executes with full autonomy. Best for complex tasks.</div>
						</div>
					</div>
					<div class="plan-mode-option" id="planMode-trueplan" onclick="selectPlanMode('trueplan')">
						<div class="plan-mode-radio">
							<input type="radio" name="planMode" id="radio-trueplan" value="trueplan">
							<span class="plan-mode-radio-custom"></span>
						</div>
						<div class="plan-mode-content">
							<div class="plan-mode-title">
								<span class="plan-mode-icon">🔒</span>
								<span class="plan-mode-name">True Plan</span>
								<span class="plan-mode-badge trueplan">Native Mode</span>
							</div>
							<div class="plan-mode-desc">Uses Claude Code's native plan mode. Claude operates in read-only mode and cannot make any file modifications until you explicitly approve. Same as CLI plan mode.</div>
						</div>
					</div>
				</div>
				<div class="plan-modal-actions">
					<button class="confirm-btn" onclick="confirmPlanMode()">Confirm</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Slash commands modal -->
	<div id="slashCommandsModal" class="tools-modal" style="display: none;">
		<div class="tools-modal-content">
			<div class="tools-modal-header">
				<span>Commands & Prompt Snippets</span>
				<button class="tools-close-btn" onclick="hideSlashCommandsModal()">✕</button>
			</div>
			<div class="tools-modal-body">
			
			<!-- Search box -->
			<div class="slash-commands-search">
				<div class="search-input-wrapper">
					<span class="search-prefix">/</span>
					<input type="text" id="slashCommandsSearch" placeholder="Search commands and snippets..." oninput="filterSlashCommands()">
				</div>
			</div>
			
			<!-- Custom Commands Section -->
			<div class="slash-commands-section">
				<h3>Custom Commands</h3>
				<div class="slash-commands-info">
					<p>Custom slash commands for quick prompt access. Click to use directly in chat.</p>
				</div>
				<div class="slash-commands-list" id="promptSnippetsList">
					<!-- Add Custom Snippet Button -->
					<div class="slash-command-item add-snippet-item" onclick="showAddSnippetForm()">
						<div class="slash-command-icon">➕</div>
						<div class="slash-command-content">
							<div class="slash-command-title">Add Custom Command</div>
							<div class="slash-command-description">Create your own slash command</div>
						</div>
					</div>
					
					<!-- Add Custom Command Form (initially hidden) -->
					<div class="add-snippet-form" id="addSnippetForm" style="display: none;">
						<div class="form-group">
							<label for="snippetName">Command name:</label>
							<div class="command-input-wrapper">
								<span class="command-prefix">/</span>
								<input type="text" id="snippetName" placeholder="e.g., fix-bug" maxlength="50">
							</div>
						</div>
						<div class="form-group">
							<label for="snippetPrompt">Prompt Text:</label>
							<textarea id="snippetPrompt" placeholder="e.g., Help me fix this bug in my code..." rows="3"></textarea>
						</div>
						<div class="form-buttons">
							<button class="btn" onclick="saveCustomSnippet()">Save Command</button>
							<button class="btn outlined" onclick="hideAddSnippetForm()">Cancel</button>
						</div>
					</div>
					
					<!-- Built-in Snippets -->
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('performance-analysis')">
						<div class="slash-command-icon">⚡</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/performance-analysis</div>
							<div class="slash-command-description">Analyze this code for performance issues and suggest optimizations</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('security-review')">
						<div class="slash-command-icon">🔒</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/security-review</div>
							<div class="slash-command-description">Review this code for security vulnerabilities</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('implementation-review')">
						<div class="slash-command-icon">🔍</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/implementation-review</div>
							<div class="slash-command-description">Review the implementation in this code</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('code-explanation')">
						<div class="slash-command-icon">📖</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/code-explanation</div>
							<div class="slash-command-description">Explain how this code works in detail</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('bug-fix')">
						<div class="slash-command-icon">🐛</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/bug-fix</div>
							<div class="slash-command-description">Help me fix this bug in my code</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('refactor')">
						<div class="slash-command-icon">🔄</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/refactor</div>
							<div class="slash-command-description">Refactor this code to improve readability and maintainability</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('test-generation')">
						<div class="slash-command-icon">🧪</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/test-generation</div>
							<div class="slash-command-description">Generate comprehensive tests for this code</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="usePromptSnippet('documentation')">
						<div class="slash-command-icon">📝</div>
						<div class="slash-command-content">
							<div class="slash-command-title">/documentation</div>
							<div class="slash-command-description">Generate documentation for this code</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Context References Section -->
			<div class="slash-commands-section">
				<h3>Context References</h3>
				<div class="slash-commands-info">
					<p>Add file or folder references to your message using @ syntax. Click to insert.</p>
				</div>
				<div class="slash-commands-list">
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@.claude/checkpoints/')">
						<div class="slash-command-icon">📁</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@.claude/checkpoints/</div>
							<div class="slash-command-description">Reference checkpoint files for restoration context</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@.claude/settings.json')">
						<div class="slash-command-icon">⚙️</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@.claude/settings.json</div>
							<div class="slash-command-description">Reference project settings file</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@CLAUDE.md')">
						<div class="slash-command-icon">📄</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@CLAUDE.md</div>
							<div class="slash-command-description">Reference project memory/instructions file</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@package.json')">
						<div class="slash-command-icon">📦</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@package.json</div>
							<div class="slash-command-description">Reference package configuration</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@src/')">
						<div class="slash-command-icon">📂</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@src/</div>
							<div class="slash-command-description">Reference source code directory</div>
						</div>
					</div>
					<div class="slash-command-item prompt-snippet-item" onclick="insertContextReference('@README.md')">
						<div class="slash-command-icon">📖</div>
						<div class="slash-command-content">
							<div class="slash-command-title">@README.md</div>
							<div class="slash-command-description">Reference project documentation</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Built-in Commands Section -->
			<div class="slash-commands-section">
				<h3>Built-in Commands</h3>
				<div class="slash-commands-info">
					<p>These commands require the Claude CLI and will open in VS Code terminal. Return here after completion.</p>
				</div>
				<div class="slash-commands-list" id="nativeCommandsList">
				<div class="slash-command-item" onclick="executeSlashCommand('add-dir')">
					<div class="slash-command-icon">📁</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/add-dir</div>
						<div class="slash-command-description">Add additional working directories to the session</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('agents')">
					<div class="slash-command-icon">🤖</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/agents</div>
						<div class="slash-command-description">Create and manage custom AI subagents for specialized tasks</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('bug')">
					<div class="slash-command-icon">🐛</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/bug</div>
						<div class="slash-command-description">Report bugs (sends conversation to Anthropic)</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('clear')">
					<div class="slash-command-icon">🗑️</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/clear</div>
						<div class="slash-command-description">Clear conversation history and start fresh</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('compact')">
					<div class="slash-command-icon">📦</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/compact</div>
						<div class="slash-command-description">Compress context window with optional focus instructions</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('config')">
					<div class="slash-command-icon">⚙️</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/config</div>
						<div class="slash-command-description">Open settings and configuration interface</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('context')">
					<div class="slash-command-icon">📋</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/context</div>
						<div class="slash-command-description">Manage and view project context</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('cost')">
					<div class="slash-command-icon">💰</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/cost</div>
						<div class="slash-command-description">Show token usage and cost statistics</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('doctor')">
					<div class="slash-command-icon">🩺</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/doctor</div>
						<div class="slash-command-description">Diagnose Claude Code installation issues</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('help')">
					<div class="slash-command-icon">❓</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/help</div>
						<div class="slash-command-description">Display available commands and usage help</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('init')">
					<div class="slash-command-icon">🚀</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/init</div>
						<div class="slash-command-description">Generate CLAUDE.md project guide</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('login')">
					<div class="slash-command-icon">🔑</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/login</div>
						<div class="slash-command-description">Log in or switch Anthropic accounts</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('logout')">
					<div class="slash-command-icon">🚪</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/logout</div>
						<div class="slash-command-description">Sign out from your Anthropic account</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('mcp')">
					<div class="slash-command-icon">🔌</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/mcp</div>
						<div class="slash-command-description">Configure MCP servers and OAuth connections</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('memory')">
					<div class="slash-command-icon">🧠</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/memory</div>
						<div class="slash-command-description">Edit project memory files (CLAUDE.md)</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('model')">
					<div class="slash-command-icon">🤖</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/model</div>
						<div class="slash-command-description">Select model (opus, sonnet, haiku)</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('permissions')">
					<div class="slash-command-icon">🔒</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/permissions</div>
						<div class="slash-command-description">View and configure permission settings</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('pr-comments')">
					<div class="slash-command-icon">💬</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/pr-comments</div>
						<div class="slash-command-description">Get GitHub PR comments for context</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('release-notes')">
					<div class="slash-command-icon">📋</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/release-notes</div>
						<div class="slash-command-description">View latest Claude Code release notes</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('review')">
					<div class="slash-command-icon">👀</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/review</div>
						<div class="slash-command-description">Review pull requests and code changes</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('rewind')">
					<div class="slash-command-icon">⏪</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/rewind</div>
						<div class="slash-command-description">Checkpoint/undo - rewind conversation and/or code</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('security-review')">
					<div class="slash-command-icon">🛡️</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/security-review</div>
						<div class="slash-command-description">Complete security review of the codebase</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('status')">
					<div class="slash-command-icon">📊</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/status</div>
						<div class="slash-command-description">Show account info, model, and connectivity status</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('statusline')">
					<div class="slash-command-icon">📍</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/statusline</div>
						<div class="slash-command-description">Set up Claude Code status line in terminal</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('terminal-setup')">
					<div class="slash-command-icon">⌨️</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/terminal-setup</div>
						<div class="slash-command-description">Install Shift+Enter key binding for newlines</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('usage')">
					<div class="slash-command-icon">📈</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/usage</div>
						<div class="slash-command-description">Show plan usage limits and rate limit status</div>
					</div>
				</div>
				<div class="slash-command-item" onclick="executeSlashCommand('vim')">
					<div class="slash-command-icon">📝</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/vim</div>
						<div class="slash-command-description">Enter vim mode for alternating insert/command modes</div>
					</div>
				</div>
				<div class="slash-command-item custom-command-item">
					<div class="slash-command-icon">⚡</div>
					<div class="slash-command-content">
						<div class="slash-command-title">Quick Command</div>
						<div class="slash-command-description">
							<div class="command-input-wrapper">
								<span class="command-prefix">/</span>
								<input type="text" 
									   class="custom-command-input" 
									   id="customCommandInput"
									   placeholder="enter-command" 
									   onkeydown="handleCustomCommandKeydown(event)"
									   onclick="event.stopPropagation()">
							</div>
						</div>
					</div>
				</div>
			</div>
			</div>
		</div>
	</div>

	${getScript(isTelemetryEnabled)}
	
	<!-- 
	Analytics FAQ:
	
	1. Is Umami GDPR compliant?
	Yes, Umami does not collect any personally identifiable information and anonymizes all data collected. Users cannot be identified and are never tracked across websites.
	
	2. Do I need to display a cookie notice to users?
	No, Umami does not use any cookies in the tracking code.
	-->
	${isTelemetryEnabled ? '<script defer src="https://cloud.umami.is/script.js" data-website-id="d050ac9b-2b6d-4c67-b4c6-766432f95644"></script>' : '<!-- Umami analytics disabled due to VS Code telemetry settings -->'}
</body>
</html>`;

export default getHtml;