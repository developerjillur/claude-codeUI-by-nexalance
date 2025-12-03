const getScript = (isTelemetryEnabled: boolean) => `<script>
		const vscode = acquireVsCodeApi();
		const messagesDiv = document.getElementById('messages');
		const messageInput = document.getElementById('messageInput');
		const sendBtn = document.getElementById('sendBtn');
		const statusDiv = document.getElementById('status');
		const statusTextDiv = document.getElementById('statusText');
		const filePickerModal = document.getElementById('filePickerModal');
		const fileSearchInput = document.getElementById('fileSearchInput');
		const fileList = document.getElementById('fileList');
		const imageBtn = document.getElementById('imageBtn');

		let isProcessRunning = false;
		let filteredFiles = [];
		let selectedFileIndex = -1;
		let planModeEnabled = false;
		let selectedPlanMode = 'ask'; // 'planfast', 'ask', 'agent', or 'auto'
		let thinkingModeEnabled = false;
		let autoModePhase = 'idle'; // 'idle' | 'planning' | 'executing'
		let autoModeOriginalMessage = '';
		let restoreBackupAvailable = false;
		let restoreBackupInfo = null;

		// Edit prompt mode tracking
		let messageIndex = 0;
		let editingMessageDiv = null;
		let originalMessageContent = '';

		// Context window management
		let contextUsagePercent = 0;
		let contextStats = {
			totalTokens: 0,
			maxTokens: 200000,
			usagePercent: 0,
			messageCount: 0,
			canCompress: false,
			needsCompression: false,
			isWarning: false
		};

		function shouldAutoScroll(messagesDiv) {
			const threshold = 100; // pixels from bottom
			const scrollTop = messagesDiv.scrollTop;
			const scrollHeight = messagesDiv.scrollHeight;
			const clientHeight = messagesDiv.clientHeight;
			
			return (scrollTop + clientHeight >= scrollHeight - threshold);
		}

		function scrollToBottomIfNeeded(messagesDiv, shouldScroll = null) {
			// If shouldScroll is not provided, check current scroll position
			if (shouldScroll === null) {
				shouldScroll = shouldAutoScroll(messagesDiv);
			}
			
			if (shouldScroll) {
				messagesDiv.scrollTop = messagesDiv.scrollHeight;
			}
		}

		function addMessage(content, type = 'claude') {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// For system messages (like token info), use tree format
			if (type === 'system') {
				const treeDiv = document.createElement('div');
				treeDiv.className = 'tree-token-info';
				treeDiv.innerHTML = \`<span class="tree-token-icon">📊</span><span>\${escapeHtml(content.replace('📊 ', ''))}</span>\`;
				messagesDiv.appendChild(treeDiv);
				scrollToBottomIfNeeded(messagesDiv, shouldScroll);
				return;
			}

			// For Claude messages, use tree-item format with bullet
			if (type === 'claude' || type === 'thinking') {
				const treeDiv = document.createElement('div');
				treeDiv.className = 'tree-item';

				const bullet = document.createElement('span');
				bullet.className = 'tree-bullet main';
				bullet.innerHTML = '●';

				const contentSpan = document.createElement('span');
				contentSpan.className = 'tree-content';
				contentSpan.innerHTML = content;

				treeDiv.appendChild(bullet);
				treeDiv.appendChild(contentSpan);
				messagesDiv.appendChild(treeDiv);
				scrollToBottomIfNeeded(messagesDiv, shouldScroll);
				return;
			}

			const messageDiv = document.createElement('div');
			messageDiv.className = \`message \${type}\`;

			// Assign unique message ID for user messages (for edit/restore functionality)
			if (type === 'user') {
				messageIndex++;
				messageDiv.setAttribute('data-message-id', \`msg-\${messageIndex}\`);
				messageDiv.setAttribute('data-message-index', messageIndex.toString());
			}

			// Add header for main message types (excluding system)
			if (type === 'user' || type === 'error') {
				const headerDiv = document.createElement('div');
				headerDiv.className = 'message-header';

				const iconDiv = document.createElement('div');
				iconDiv.className = \`message-icon \${type}\`;

				const labelDiv = document.createElement('div');
				labelDiv.className = 'message-label';

				// Set icon and label based on type
				switch(type) {
					case 'user':
						iconDiv.textContent = '👤';
						labelDiv.textContent = 'YOU';
						break;
					case 'error':
						iconDiv.textContent = '⚠️';
						labelDiv.textContent = 'Error';
						break;
				}
				
				// Create button container for right side
				const btnContainer = document.createElement('div');
				btnContainer.className = 'message-btn-container';

				// Add edit button for user messages only
				if (type === 'user') {
					const editBtn = document.createElement('button');
					editBtn.className = 'edit-prompt-btn';
					editBtn.title = 'Edit and resubmit prompt';
					editBtn.onclick = () => enterEditPromptMode(messageDiv);
					editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
					btnContainer.appendChild(editBtn);
				}

				// Add scroll-to-prompt button (not for first message)
				if (messageIndex > 0) {
					const scrollBtn = document.createElement('button');
					scrollBtn.className = 'scroll-to-prompt-btn';
					scrollBtn.title = 'Scroll to this prompt location';
					scrollBtn.onclick = () => scrollToPromptInput(messageDiv);
					scrollBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
					btnContainer.appendChild(scrollBtn);
				}

				// Add copy button
				const copyBtn = document.createElement('button');
				copyBtn.className = 'copy-btn';
				copyBtn.title = 'Copy message';
				copyBtn.onclick = () => copyMessageContent(messageDiv);
				copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
				btnContainer.appendChild(copyBtn);

				headerDiv.appendChild(iconDiv);
				headerDiv.appendChild(labelDiv);
				headerDiv.appendChild(btnContainer);
				messageDiv.appendChild(headerDiv);
			}
			
			// Add content
			const contentDiv = document.createElement('div');
			contentDiv.className = 'message-content';

			if(type == 'user'){
				contentDiv.innerHTML = content;
			} else {
				const preElement = document.createElement('pre');
				preElement.textContent = content;
				contentDiv.appendChild(preElement);
			}
			
			messageDiv.appendChild(contentDiv);
			
			// Check if this is a permission-related error and add yolo mode button
			if (type === 'error' && isPermissionError(content)) {
				const yoloSuggestion = document.createElement('div');
				yoloSuggestion.className = 'yolo-suggestion';
				yoloSuggestion.innerHTML = \`
					<div class="yolo-suggestion-text">
						<span>💡 This looks like a permission issue. You can enable Yolo Mode to skip all permission checks.</span>
					</div>
					<button class="yolo-suggestion-btn" onclick="enableYoloMode()">Enable Yolo Mode</button>
				\`;
				messageDiv.appendChild(yoloSuggestion);
			}
			
			messagesDiv.appendChild(messageDiv);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}


		// Helper to get tool type for CSS class
		function getToolType(toolName) {
			const name = toolName.toLowerCase();
			if (name.includes('read')) return 'read';
			if (name.includes('write')) return 'write';
			if (name.includes('edit') || name.includes('multiedit')) return 'edit';
			if (name.includes('search') || name.includes('grep') || name.includes('glob')) return 'search';
			if (name.includes('bash')) return 'bash';
			if (name.includes('mcp') || name.startsWith('mcp_')) return 'mcp';
			if (name.includes('task') || name.includes('agent')) return 'task';
			return '';
		}

		// Format tool arguments for tree display
		function formatTreeToolArgs(rawInput, toolName) {
			if (!rawInput) return '';

			// Handle different tool types
			if (toolName === 'Read' && rawInput.file_path) {
				const path = rawInput.file_path.replace(/^.*\\/Documents\\//, '~/Documents/').replace(/^.*\\/Users\\/[^/]+\\//, '~/');
				return \`(<span class="tree-tool-args">\${escapeHtml(path)}</span>)\`;
			}
			if ((toolName === 'Grep' || toolName === 'Search') && rawInput.pattern) {
				const pattern = rawInput.pattern.length > 50 ? rawInput.pattern.substring(0, 50) + '...' : rawInput.pattern;
				let args = \`pattern: "\${escapeHtml(pattern)}"\`;
				if (rawInput.path) {
					const path = rawInput.path.replace(/^.*\\/Documents\\//, '~/Documents/').replace(/^.*\\/Users\\/[^/]+\\//, '~/');
					args += \`, path: "\${escapeHtml(path)}"\`;
				}
				if (rawInput.output_mode) {
					args += \`, output_mode: "\${rawInput.output_mode}"\`;
				}
				return \`(<span class="tree-tool-args">\${args}</span>)\`;
			}
			if (toolName === 'Glob' && rawInput.pattern) {
				let args = \`pattern: "\${escapeHtml(rawInput.pattern)}"\`;
				if (rawInput.path) {
					const path = rawInput.path.replace(/^.*\\/Documents\\//, '~/Documents/').replace(/^.*\\/Users\\/[^/]+\\//, '~/');
					args += \`, path: "\${escapeHtml(path)}"\`;
				}
				return \`(<span class="tree-tool-args">\${args}</span>)\`;
			}
			if ((toolName === 'Edit' || toolName === 'Write') && rawInput.file_path) {
				const path = rawInput.file_path.replace(/^.*\\/Documents\\//, '~/Documents/').replace(/^.*\\/Users\\/[^/]+\\//, '~/');
				return \`(<span class="tree-tool-args">\${escapeHtml(path)}</span>)\`;
			}
			if (toolName === 'Bash' && rawInput.command) {
				const cmd = rawInput.command.length > 60 ? rawInput.command.substring(0, 60) + '...' : rawInput.command;
				return \`(<span class="tree-tool-args">\${escapeHtml(cmd)}</span>)\`;
			}
			if (toolName === 'Task' && rawInput.prompt) {
				const prompt = rawInput.prompt.length > 50 ? rawInput.prompt.substring(0, 50) + '...' : rawInput.prompt;
				return \`(<span class="tree-tool-args">\${escapeHtml(prompt)}</span>)\`;
			}

			return '';
		}

		function addToolUseMessage(data) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// Create tree-style tool message
			const treeDiv = document.createElement('div');
			treeDiv.className = 'tree-tool';
			treeDiv.setAttribute('data-tool-id', data.toolId || '');

			// Get tool name and type
			let toolName = data.toolInfo.replace('🔧 Executing: ', '');
			const displayName = toolName === 'TodoWrite' ? 'Update Todos' : toolName;
			const toolType = getToolType(toolName);

			// Create header row with bullet and tool name (no toggle here)
			const headerDiv = document.createElement('div');
			headerDiv.className = 'tree-tool-header';

			const bullet = document.createElement('span');
			bullet.className = \`tree-tool-bullet \${toolType}\`;

			const nameSpan = document.createElement('span');
			nameSpan.className = \`tree-tool-name \${toolType}\`;
			nameSpan.innerHTML = displayName + formatTreeToolArgs(data.rawInput, toolName);

			headerDiv.appendChild(bullet);
			headerDiv.appendChild(nameSpan);
			treeDiv.appendChild(headerDiv);

			// Create results container for expand/collapse functionality
			const resultsContainer = document.createElement('div');
			resultsContainer.className = 'tree-tool-results';

			// Add child details for specific tools
			if (data.rawInput) {
				// Handle TodoWrite specially
				if (data.toolName === 'TodoWrite' && data.rawInput.todos) {
					const resultDiv = document.createElement('div');
					resultDiv.className = 'tree-tool-result';
					resultDiv.innerHTML = '<span class="tree-connector">└─</span><span class="tree-tool-result-content">Todo List Update:</span>';
					resultsContainer.appendChild(resultDiv);

					for (const todo of data.rawInput.todos) {
						const status = todo.status === 'completed' ? '✅' :
							todo.status === 'in_progress' ? '🔄' : '⏳';
						const todoDiv = document.createElement('div');
						todoDiv.className = 'tree-tool-result';
						todoDiv.style.marginLeft = '28px';
						todoDiv.innerHTML = \`<span class="tree-connector">  </span><span class="tree-tool-result-content">\${status} \${escapeHtml(todo.content)}</span>\`;
						resultsContainer.appendChild(todoDiv);
					}
				}
				// For Read tool, show what's being read
				else if (toolName === 'Read' && data.rawInput.file_path) {
					const resultDiv = document.createElement('div');
					resultDiv.className = 'tree-tool-result';
					let info = '';
					if (data.rawInput.limit) {
						info = \`Read \${data.rawInput.limit} lines\`;
						if (data.rawInput.offset) info += \` from line \${data.rawInput.offset}\`;
					}
					if (info) {
						resultDiv.innerHTML = \`<span class="tree-connector">└─</span><span class="tree-tool-result-content">\${info}</span>\`;
						resultsContainer.appendChild(resultDiv);
					}
				}
				// For Edit tool, show diff info
				else if ((toolName === 'Edit' || toolName === 'MultiEdit') && data.rawInput) {
					const inputDiv = document.createElement('div');
					inputDiv.className = 'tool-input';
					inputDiv.style.marginLeft = '14px';
					inputDiv.style.marginTop = '4px';

					const contentDiv = document.createElement('div');
					contentDiv.className = 'tool-input-content';

					if (toolName === 'Edit') {
						contentDiv.innerHTML = formatEditToolDiff(data.rawInput);
					} else {
						contentDiv.innerHTML = formatMultiEditToolDiff(data.rawInput);
					}

					inputDiv.appendChild(contentDiv);
					resultsContainer.appendChild(inputDiv);
				}
				// For Write tool
				else if (toolName === 'Write' && data.rawInput) {
					const inputDiv = document.createElement('div');
					inputDiv.className = 'tool-input';
					inputDiv.style.marginLeft = '14px';
					inputDiv.style.marginTop = '4px';

					const contentDiv = document.createElement('div');
					contentDiv.className = 'tool-input-content';
					contentDiv.innerHTML = formatWriteToolDiff(data.rawInput);

					inputDiv.appendChild(contentDiv);
					resultsContainer.appendChild(inputDiv);
				}
			}

			// Append results container to tree div
			treeDiv.appendChild(resultsContainer);

			messagesDiv.appendChild(treeDiv);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}

		function createExpandableInput(toolInput, rawInput) {
			try {
				let html = toolInput.replace(/\\[expand\\]/g, '<span class="expand-btn" onclick="toggleExpand(this)">expand</span>');
				
				// Store raw input data for expansion
				if (rawInput && typeof rawInput === 'object') {
					let btnIndex = 0;
					html = html.replace(/<span class="expand-btn"[^>]*>expand<\\/span>/g, (match) => {
						const keys = Object.keys(rawInput);
						const key = keys[btnIndex] || '';
						const value = rawInput[key] || '';
						const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
						const escapedValue = valueStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
						btnIndex++;
						return \`<span class="expand-btn" data-key="\${key}" data-value="\${escapedValue}" onclick="toggleExpand(this)">expand</span>\`;
					});
				}
				
				return html;
			} catch (error) {
				console.error('Error creating expandable input:', error);
				return toolInput;
			}
		}


		function addToolResultMessage(data) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// For Read and Edit tools with hidden flag, just hide loading state
			if (data.hidden && (data.toolName === 'Read' || data.toolName === 'Edit' || data.toolName === 'TodoWrite' || data.toolName === 'MultiEdit') && !data.isError) {
				// For Read tool, add tree child showing result with Show/Hide toggle
				if (data.toolName === 'Read' && data.content) {
					// Find the last tree-tool element and add result to its results container
					const lastTreeTool = messagesDiv.querySelector('.tree-tool:last-of-type');
					if (lastTreeTool) {
						const resultsContainer = lastTreeTool.querySelector('.tree-tool-results') || lastTreeTool;
						const lines = data.content.split('\\n').length;
						const size = data.content.length > 1024 ?
							(data.content.length / 1024).toFixed(1) + 'KB' :
							data.content.length + ' chars';

						// Create result wrapper
						const resultWrapper = document.createElement('div');
						resultWrapper.className = 'tree-tool-result-wrapper';

						// Create result line with toggle button
						const resultDiv = document.createElement('div');
						resultDiv.className = 'tree-tool-result';

						const contentId = 'content_' + Math.random().toString(36).substr(2, 9);

						// Create toggle button
						const toggleBtn = document.createElement('button');
						toggleBtn.className = 'tree-result-toggle';
						toggleBtn.innerHTML = '▶ Show';
						toggleBtn.onclick = function() {
							const contentDiv = document.getElementById(contentId);
							if (contentDiv) {
								const isVisible = contentDiv.classList.contains('visible');
								if (isVisible) {
									contentDiv.classList.remove('visible');
									toggleBtn.innerHTML = '▶ Show';
								} else {
									contentDiv.classList.add('visible');
									toggleBtn.innerHTML = '▼ Hide';
								}
							}
						};

						resultDiv.innerHTML = \`<span class="tree-connector">└─</span><span class="tree-tool-result-content">\${escapeHtml(data.content.substring(0, 80))}\${data.content.length > 80 ? '...' : ''} (\${size})</span>\`;
						resultDiv.appendChild(toggleBtn);

						// Create hidden content container
						const fullContentDiv = document.createElement('div');
						fullContentDiv.id = contentId;
						fullContentDiv.className = 'tree-result-content-full';
						fullContentDiv.textContent = data.content;

						resultWrapper.appendChild(resultDiv);
						resultWrapper.appendChild(fullContentDiv);
						resultsContainer.appendChild(resultWrapper);
					}
				}
				return;
			}

			if(data.isError && data.content === "File has not been read yet. Read it first before writing to it."){
				return addMessage("File has not been read yet. Let me read it first before writing to it.", 'system');
			}

			// Create tree-style result
			const treeDiv = document.createElement('div');
			treeDiv.className = 'tree-tool-result';
			treeDiv.style.marginLeft = '0';
			treeDiv.style.paddingLeft = '14px';

			const content = data.content || '';

			if (data.isError) {
				// Show error in tree format
				treeDiv.innerHTML = \`<span class="tree-connector" style="color: var(--accent-red);">└─</span><span class="tree-tool-result-content" style="color: var(--accent-red);">Error: \${escapeHtml(content.substring(0, 100))}\${content.length > 100 ? '...' : ''}</span>\`;

				// Check if this is a permission-related error and add yolo mode button
				if (isPermissionError(content)) {
					const yoloDiv = document.createElement('div');
					yoloDiv.className = 'yolo-suggestion';
					yoloDiv.style.marginLeft = '14px';
					yoloDiv.innerHTML = \`
						<div class="yolo-suggestion-text">
							<span>💡 Permission issue. Enable Yolo Mode to skip permission checks.</span>
						</div>
						<button class="yolo-suggestion-btn" onclick="enableYoloMode()">Enable Yolo Mode</button>
					\`;
					messagesDiv.appendChild(treeDiv);
					messagesDiv.appendChild(yoloDiv);
					scrollToBottomIfNeeded(messagesDiv, shouldScroll);
					return;
				}
			} else {
				// Show success result in tree format with Show/Hide toggle for long content
				const lines = content.split('\\n').length;
				const size = content.length > 1024 ?
					(content.length / 1024).toFixed(1) + 'KB' :
					content.length + ' chars';

				// Create wrapper for result + expandable content
				const resultWrapper = document.createElement('div');
				resultWrapper.className = 'tree-tool-result-wrapper';

				// Truncate display content
				const displayContent = content.length > 80 ? content.substring(0, 80) + '...' : content;

				treeDiv.innerHTML = \`<span class="tree-connector">└─</span><span class="tree-tool-result-content">\${escapeHtml(displayContent)} (\${size})</span>\`;

				// Add Show/Hide toggle for content longer than 80 chars
				if (content.length > 80) {
					const contentId = 'content_' + Math.random().toString(36).substr(2, 9);

					const toggleBtn = document.createElement('button');
					toggleBtn.className = 'tree-result-toggle';
					toggleBtn.innerHTML = '▶ Show';
					toggleBtn.onclick = function() {
						const contentDiv = document.getElementById(contentId);
						if (contentDiv) {
							const isVisible = contentDiv.classList.contains('visible');
							if (isVisible) {
								contentDiv.classList.remove('visible');
								toggleBtn.innerHTML = '▶ Show';
							} else {
								contentDiv.classList.add('visible');
								toggleBtn.innerHTML = '▼ Hide';
							}
						}
					};
					treeDiv.appendChild(toggleBtn);

					// Create hidden full content container
					const fullContentDiv = document.createElement('div');
					fullContentDiv.id = contentId;
					fullContentDiv.className = 'tree-result-content-full';
					fullContentDiv.textContent = content;

					resultWrapper.appendChild(treeDiv);
					resultWrapper.appendChild(fullContentDiv);
					messagesDiv.appendChild(resultWrapper);
				} else {
					messagesDiv.appendChild(treeDiv);
				}
			}

			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}

		function formatToolInputUI(input) {
			if (!input || typeof input !== 'object') {
				const str = String(input);
				if (str.length > 100) {
					const truncateAt = 97;
					const truncated = str.substring(0, truncateAt);
					const inputId = 'input_' + Math.random().toString(36).substr(2, 9);
					
					return '<span id="' + inputId + '_visible">' + escapeHtml(truncated) + '</span>' +
						   '<span id="' + inputId + '_ellipsis">...</span>' +
						   '<span id="' + inputId + '_hidden" style="display: none;">' + escapeHtml(str.substring(truncateAt)) + '</span>' +
						   '<div class="diff-expand-container">' +
						   '<button class="diff-expand-btn" onclick="toggleResultExpansion(\\\'' + inputId + '\\\')">Show more</button>' +
						   '</div>';
				}
				return str;
			}

			// Special handling for Read tool with file_path
			if (input.file_path && Object.keys(input).length === 1) {
				const formattedPath = formatFilePath(input.file_path);
				return '<div class="diff-file-path" onclick="openFileInEditor(\\\'' + escapeHtml(input.file_path) + '\\\')">' + formattedPath + '</div>';
			}

			let result = '';
			let isFirst = true;
			for (const [key, value] of Object.entries(input)) {
				const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
				
				if (!isFirst) result += '\\n';
				isFirst = false;
				
				// Special formatting for file_path in Read tool context
				if (key === 'file_path') {
					const formattedPath = formatFilePath(valueStr);
					result += '<div class="diff-file-path" onclick="openFileInEditor(\\\'' + escapeHtml(valueStr) + '\\\')">' + formattedPath + '</div>';
				} else if (valueStr.length > 100) {
					const truncated = valueStr.substring(0, 97) + '...';
					const escapedValue = valueStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
					result += '<span class="expandable-item"><strong>' + key + ':</strong> ' + truncated + ' <span class="expand-btn" data-key="' + key + '" data-value="' + escapedValue + '" onclick="toggleExpand(this)">expand</span></span>';
				} else {
					result += '<strong>' + key + ':</strong> ' + valueStr;
				}
			}
			return result;
		}

		function formatEditToolDiff(input) {
			if (!input || typeof input !== 'object') {
				return formatToolInputUI(input);
			}

			// Check if this is an Edit tool (has file_path, old_string, new_string)
			if (!input.file_path || !input.old_string || !input.new_string) {
				return formatToolInputUI(input);
			}

			// Format file path with better display
			const formattedPath = formatFilePath(input.file_path);
			let result = '<div class="diff-file-path" onclick="openFileInEditor(\\\'' + escapeHtml(input.file_path) + '\\\')">' + formattedPath + '</div>\\n';
			
			// Create diff view
			const oldLines = input.old_string.split('\\n');
			const newLines = input.new_string.split('\\n');
			const allLines = [...oldLines.map(line => ({type: 'removed', content: line})), 
							 ...newLines.map(line => ({type: 'added', content: line}))];
			
			const maxLines = 6;
			const shouldTruncate = allLines.length > maxLines;
			const visibleLines = shouldTruncate ? allLines.slice(0, maxLines) : allLines;
			const hiddenLines = shouldTruncate ? allLines.slice(maxLines) : [];
			
			result += '<div class="diff-container">';
			result += '<div class="diff-header">Changes:</div>';
			
			// Create a unique ID for this diff
			const diffId = 'diff_' + Math.random().toString(36).substr(2, 9);
			
			// Show visible lines
			result += '<div id="' + diffId + '_visible">';
			for (const line of visibleLines) {
				const prefix = line.type === 'removed' ? '- ' : '+ ';
				const cssClass = line.type === 'removed' ? 'removed' : 'added';
				result += '<div class="diff-line ' + cssClass + '">' + prefix + escapeHtml(line.content) + '</div>';
			}
			result += '</div>';
			
			// Show hidden lines (initially hidden)
			if (shouldTruncate) {
				result += '<div id="' + diffId + '_hidden" style="display: none;">';
				for (const line of hiddenLines) {
					const prefix = line.type === 'removed' ? '- ' : '+ ';
					const cssClass = line.type === 'removed' ? 'removed' : 'added';
					result += '<div class="diff-line ' + cssClass + '">' + prefix + escapeHtml(line.content) + '</div>';
				}
				result += '</div>';
				
				// Add expand button
				result += '<div class="diff-expand-container">';
				result += '<button class="diff-expand-btn" onclick="toggleDiffExpansion(\\\'' + diffId + '\\\')">Show ' + hiddenLines.length + ' more lines</button>';
				result += '</div>';
			}
			
			result += '</div>';
			
			// Add other properties if they exist
			for (const [key, value] of Object.entries(input)) {
				if (key !== 'file_path' && key !== 'old_string' && key !== 'new_string') {
					const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
					result += '\\n<strong>' + key + ':</strong> ' + valueStr;
				}
			}
			
			return result;
		}

		function formatMultiEditToolDiff(input) {
			if (!input || typeof input !== 'object') {
				return formatToolInputUI(input);
			}

			// Check if this is a MultiEdit tool (has file_path and edits array)
			if (!input.file_path || !input.edits || !Array.isArray(input.edits)) {
				return formatToolInputUI(input);
			}

			// Format file path with better display
			const formattedPath = formatFilePath(input.file_path);
			let result = '<div class="diff-file-path" onclick="openFileInEditor(\\\'' + escapeHtml(input.file_path) + '\\\')">' + formattedPath + '</div>\\n';
			
			// Count total lines across all edits for truncation
			let totalLines = 0;
			for (const edit of input.edits) {
				if (edit.old_string && edit.new_string) {
					const oldLines = edit.old_string.split('\\n');
					const newLines = edit.new_string.split('\\n');
					totalLines += oldLines.length + newLines.length;
				}
			}

			const maxLines = 6;
			const shouldTruncate = totalLines > maxLines;
			
			result += '<div class="diff-container">';
			result += '<div class="diff-header">Changes (' + input.edits.length + ' edit' + (input.edits.length > 1 ? 's' : '') + '):</div>';
			
			// Create a unique ID for this diff
			const diffId = 'multiedit_' + Math.random().toString(36).substr(2, 9);
			
			let currentLineCount = 0;
			let visibleEdits = [];
			let hiddenEdits = [];
			
			// Determine which edits to show/hide based on line count
			for (let i = 0; i < input.edits.length; i++) {
				const edit = input.edits[i];
				if (!edit.old_string || !edit.new_string) continue;
				
				const oldLines = edit.old_string.split('\\n');
				const newLines = edit.new_string.split('\\n');
				const editLines = oldLines.length + newLines.length;
				
				if (shouldTruncate && currentLineCount + editLines > maxLines && visibleEdits.length > 0) {
					hiddenEdits.push(edit);
				} else {
					visibleEdits.push(edit);
					currentLineCount += editLines;
				}
			}
			
			// Show visible edits
			result += '<div id="' + diffId + '_visible">';
			for (let i = 0; i < visibleEdits.length; i++) {
				const edit = visibleEdits[i];
				if (i > 0) result += '<div class="diff-edit-separator"></div>';
				result += formatSingleEdit(edit, i + 1);
			}
			result += '</div>';
			
			// Show hidden edits (initially hidden)
			if (hiddenEdits.length > 0) {
				result += '<div id="' + diffId + '_hidden" style="display: none;">';
				for (let i = 0; i < hiddenEdits.length; i++) {
					const edit = hiddenEdits[i];
					result += '<div class="diff-edit-separator"></div>';
					result += formatSingleEdit(edit, visibleEdits.length + i + 1);
				}
				result += '</div>';
				
				// Add expand button
				result += '<div class="diff-expand-container">';
				result += '<button class="diff-expand-btn" onclick="toggleDiffExpansion(\\\'' + diffId + '\\\')">Show ' + hiddenEdits.length + ' more edit' + (hiddenEdits.length > 1 ? 's' : '') + '</button>';
				result += '</div>';
			}
			
			result += '</div>';
			
			// Add other properties if they exist
			for (const [key, value] of Object.entries(input)) {
				if (key !== 'file_path' && key !== 'edits') {
					const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
					result += '\\n<strong>' + key + ':</strong> ' + valueStr;
				}
			}
			
			return result;
		}

		function formatSingleEdit(edit, editNumber) {
			let result = '<div class="single-edit">';
			result += '<div class="edit-number">Edit #' + editNumber + '</div>';
			
			// Create diff view for this single edit
			const oldLines = edit.old_string.split('\\n');
			const newLines = edit.new_string.split('\\n');
			
			// Show removed lines
			for (const line of oldLines) {
				result += '<div class="diff-line removed">- ' + escapeHtml(line) + '</div>';
			}
			
			// Show added lines
			for (const line of newLines) {
				result += '<div class="diff-line added">+ ' + escapeHtml(line) + '</div>';
			}
			
			result += '</div>';
			return result;
		}

		function formatWriteToolDiff(input) {
			if (!input || typeof input !== 'object') {
				return formatToolInputUI(input);
			}

			// Check if this is a Write tool (has file_path and content)
			if (!input.file_path || !input.content) {
				return formatToolInputUI(input);
			}

			// Format file path with better display
			const formattedPath = formatFilePath(input.file_path);
			let result = '<div class="diff-file-path" onclick="openFileInEditor(\\\'' + escapeHtml(input.file_path) + '\\\')">' + formattedPath + '</div>\\n';
			
			// Create diff view showing all content as additions
			const contentLines = input.content.split('\\n');
			
			const maxLines = 6;
			const shouldTruncate = contentLines.length > maxLines;
			const visibleLines = shouldTruncate ? contentLines.slice(0, maxLines) : contentLines;
			const hiddenLines = shouldTruncate ? contentLines.slice(maxLines) : [];
			
			result += '<div class="diff-container">';
			result += '<div class="diff-header">New file content:</div>';
			
			// Create a unique ID for this diff
			const diffId = 'write_' + Math.random().toString(36).substr(2, 9);
			
			// Show visible lines (all as additions)
			result += '<div id="' + diffId + '_visible">';
			for (const line of visibleLines) {
				result += '<div class="diff-line added">+ ' + escapeHtml(line) + '</div>';
			}
			result += '</div>';
			
			// Show hidden lines (initially hidden)
			if (shouldTruncate) {
				result += '<div id="' + diffId + '_hidden" style="display: none;">';
				for (const line of hiddenLines) {
					result += '<div class="diff-line added">+ ' + escapeHtml(line) + '</div>';
				}
				result += '</div>';
				
				// Add expand button
				result += '<div class="diff-expand-container">';
				result += '<button class="diff-expand-btn" onclick="toggleDiffExpansion(\\\'' + diffId + '\\\')">Show ' + hiddenLines.length + ' more lines</button>';
				result += '</div>';
			}
			
			result += '</div>';
			
			// Add other properties if they exist
			for (const [key, value] of Object.entries(input)) {
				if (key !== 'file_path' && key !== 'content') {
					const valueStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
					result += '\\n<strong>' + key + ':</strong> ' + valueStr;
				}
			}
			
			return result;
		}

		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		function openFileInEditor(filePath) {
			vscode.postMessage({
				type: 'openFile',
				filePath: filePath
			});
		}

		function formatFilePath(filePath) {
			if (!filePath) return '';
			
			// Extract just the filename
			const parts = filePath.split('/');
			const fileName = parts[parts.length - 1];
			
			return '<span class="file-path-truncated" title="' + escapeHtml(filePath) + '" data-file-path="' + escapeHtml(filePath) + '">' + 
				   '<span class="file-icon">📄</span>' + escapeHtml(fileName) + '</span>';
		}

		function toggleDiffExpansion(diffId) {
			const hiddenDiv = document.getElementById(diffId + '_hidden');
			const button = document.querySelector('[onclick*="' + diffId + '"]');
			
			if (hiddenDiv && button) {
				if (hiddenDiv.style.display === 'none') {
					hiddenDiv.style.display = 'block';
					button.textContent = 'Show less';
				} else {
					hiddenDiv.style.display = 'none';
					const hiddenLines = hiddenDiv.querySelectorAll('.diff-line').length;
					button.textContent = 'Show ' + hiddenLines + ' more lines';
				}
			}
		}

		function toggleResultExpansion(resultId) {
			const hiddenDiv = document.getElementById(resultId + '_hidden');
			const ellipsis = document.getElementById(resultId + '_ellipsis');
			const button = document.querySelector('[onclick*="toggleResultExpansion(\\'' + resultId + '\\\')"]');
			
			if (hiddenDiv && button) {
				if (hiddenDiv.style.display === 'none') {
					hiddenDiv.style.display = 'inline';
					if (ellipsis) ellipsis.style.display = 'none';
					button.textContent = 'Show less';
				} else {
					hiddenDiv.style.display = 'none';
					if (ellipsis) ellipsis.style.display = 'inline';
					button.textContent = 'Show more';
				}
			}
		}

		function toggleExpand(button) {
			const key = button.getAttribute('data-key');
			const value = button.getAttribute('data-value');
			
			// Find the container that holds just this key-value pair
			let container = button.parentNode;
			while (container && !container.classList.contains('expandable-item')) {
				container = container.parentNode;
			}
			
			if (!container) {
				// Fallback: create a wrapper around the current line
				const parent = button.parentNode;
				const wrapper = document.createElement('div');
				wrapper.className = 'expandable-item';
				parent.insertBefore(wrapper, button.previousSibling || button);
				
				// Move the key, value text, and button into the wrapper
				let currentNode = wrapper.nextSibling;
				const nodesToMove = [];
				while (currentNode && currentNode !== button.nextSibling) {
					nodesToMove.push(currentNode);
					currentNode = currentNode.nextSibling;
				}
				nodesToMove.forEach(node => wrapper.appendChild(node));
				container = wrapper;
			}
			
			if (button.textContent === 'expand') {
				// Show full content
				const decodedValue = value.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
				container.innerHTML = '<strong>' + key + ':</strong> ' + decodedValue + ' <span class="expand-btn" data-key="' + key + '" data-value="' + value + '" onclick="toggleExpand(this)">collapse</span>';
			} else {
				// Show truncated content
				const decodedValue = value.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
				const truncated = decodedValue.substring(0, 97) + '...';
				container.innerHTML = '<strong>' + key + ':</strong> ' + truncated + ' <span class="expand-btn" data-key="' + key + '" data-value="' + value + '" onclick="toggleExpand(this)">expand</span>';
			}
		}

		function sendMessage() {
			const text = messageInput.value.trim();
			if (text) {
				// Track if this is AutoMode Phase 1
				if (planModeEnabled && selectedPlanMode === 'auto') {
					autoModePhase = 'planning';
					autoModeOriginalMessage = text;
				}

				vscode.postMessage({
					type: 'sendMessage',
					text: text,
					planMode: planModeEnabled,
					planModeType: selectedPlanMode,
					thinkingMode: thinkingModeEnabled
				});

				messageInput.value = '';
			}
		}

		function togglePlanMode() {
			planModeEnabled = !planModeEnabled;
			const switchElement = document.getElementById('planModeSwitch');

			if (planModeEnabled) {
				switchElement.classList.add('active');
				// Show plan mode selection modal when enabling
				showPlanModeModal();
			} else {
				switchElement.classList.remove('active');
				// Reset label to default when turning off
				const toggleLabel = document.getElementById('planModeLabel');
				if (toggleLabel) {
					toggleLabel.textContent = 'Plan First';
				}
			}
		}

		// Plan Mode Modal Functions
		function showPlanModeModal() {
			// Update selection state based on current selectedPlanMode
			updatePlanModeSelection(selectedPlanMode);
			document.getElementById('planModeModal').style.display = 'flex';
		}

		function hidePlanModeModal() {
			document.getElementById('planModeModal').style.display = 'none';
		}

		function selectPlanMode(mode) {
			selectedPlanMode = mode;
			updatePlanModeSelection(mode);
		}

		function updatePlanModeSelection(mode) {
			// Remove selected class from all options
			const options = document.querySelectorAll('.plan-mode-option');
			options.forEach(option => {
				option.classList.remove('selected');
			});

			// Add selected class to the chosen option
			const selectedOption = document.getElementById('planMode-' + mode);
			if (selectedOption) {
				selectedOption.classList.add('selected');
			}

			// Update radio button
			const radioBtn = document.getElementById('radio-' + mode);
			if (radioBtn) {
				radioBtn.checked = true;
			}
		}

		function updatePlanModeToggleName(mode) {
			const modeNames = {
				'planfast': 'Plan Fast',
				'ask': 'Ask Mode',
				'agent': 'Agent Mode',
				'auto': 'AutoMode'
			};
			const modeName = modeNames[mode] || 'Plan First';
			const toggleLabel = document.getElementById('planModeLabel');
			if (toggleLabel) {
				toggleLabel.textContent = modeName;
			}
		}

		function confirmPlanMode() {
			// Update the toggle name with confirmed selection
			updatePlanModeToggleName(selectedPlanMode);

			// Save the plan mode setting
			vscode.postMessage({
				type: 'updateSettings',
				settings: {
					'plan.mode': selectedPlanMode
				}
			});

			// Close the modal
			hidePlanModeModal();
		}

		// AutoMode: Trigger Phase 2 execution after Phase 1 planning completes
		function triggerAutoModeExecution() {
			// Show system message
			addSystemMessage('AutoMode: Plan received. Proceeding with autonomous execution...');

			// Send execution request with Agent mode
			const proceedMessage = 'Proceed with the implementation plan you just created. Execute all steps autonomously with minimal intervention. Report progress and handle edge cases proactively.';

			vscode.postMessage({
				type: 'sendMessage',
				text: proceedMessage,
				planMode: true,
				planModeType: 'agent',
				thinkingMode: thinkingModeEnabled
			});

			// Force UI state immediately - use forceShowStopButton to guarantee it
			isProcessing = true;
			forceShowStopButton();

			// Also run after delays to override any competing updates from extension messages
			setTimeout(() => {
				if (autoModePhase === 'executing') {
					forceShowStopButton();
				}
			}, 50);

			setTimeout(() => {
				if (autoModePhase === 'executing') {
					forceShowStopButton();
				}
			}, 150);
		}

		// Helper function to add system messages for AutoMode
		function addSystemMessage(text) {
			const messageDiv = document.createElement('div');
			messageDiv.className = 'message system-message';
			messageDiv.innerHTML = '<div class="message-content">' + text + '</div>';
			messagesDiv.appendChild(messageDiv);
			scrollToBottomIfNeeded(messagesDiv, true);
		}

		function toggleThinkingMode() {
			thinkingModeEnabled = !thinkingModeEnabled;
			
			if (thinkingModeEnabled) {
				sendStats('Thinking mode enabled');
			}
			
			const switchElement = document.getElementById('thinkingModeSwitch');
			const toggleLabel = document.getElementById('thinkingModeLabel');
			if (thinkingModeEnabled) {
				switchElement.classList.add('active');
				// Show thinking intensity modal when thinking mode is enabled
				showThinkingIntensityModal();
			} else {
				switchElement.classList.remove('active');
				// Reset to default "Thinking Mode" when turned off
				if (toggleLabel) {
					toggleLabel.textContent = 'Thinking Mode';
				}
			}
		}


		let totalCost = 0;
		let totalTokensInput = 0;
		let totalTokensOutput = 0;
		let requestCount = 0;
		let isProcessing = false;
		let requestStartTime = null;
		let requestTimer = null;

		// Send usage statistics
		function sendStats(eventName) {
			${isTelemetryEnabled ? 
			`try {
				if (typeof umami !== 'undefined' && umami.track) {
					umami.track(eventName);
				}
			} catch (error) {
				console.error('Error sending stats:', error);
			}` : 
			`// Telemetry disabled - no tracking`}
		}

		function updateStatus(text, state = 'ready') {
			statusTextDiv.textContent = text;
			statusDiv.className = \`status \${state}\`;
		}

		function updateStatusWithTotals() {
			if (isProcessing) {
				// While processing, show tokens and elapsed time
				const totalTokens = totalTokensInput + totalTokensOutput;
				const tokensStr = totalTokens > 0 ? 
					\`\${totalTokens.toLocaleString()} tokens\` : '0 tokens';
				
				let elapsedStr = '';
				if (requestStartTime) {
					const elapsedSeconds = Math.floor((Date.now() - requestStartTime) / 1000);
					elapsedStr = \` • \${elapsedSeconds}s\`;
				}
				
				const statusText = \`Processing • \${tokensStr}\${elapsedStr}\`;
				updateStatus(statusText, 'processing');
			} else {
				// When ready, show full info
				const costStr = totalCost > 0 ? \`$\${totalCost.toFixed(4)}\` : '$0.00';
				const totalTokens = totalTokensInput + totalTokensOutput;
				const tokensStr = totalTokens > 0 ? 
					\`\${totalTokens.toLocaleString()} tokens\` : '0 tokens';
				const requestStr = requestCount > 0 ? \`\${requestCount} requests\` : '';
				
				const statusText = \`Ready • \${costStr} • \${tokensStr}\${requestStr ? \` • \${requestStr}\` : ''}\`;
				updateStatus(statusText, 'ready');
			}
		}

		function startRequestTimer(startTime = undefined) {
			requestStartTime = startTime || Date.now();
			// Update status every 100ms for smooth real-time display
			requestTimer = setInterval(() => {
				if (isProcessing) {
					updateStatusWithTotals();
				}
			}, 100);
		}

		function stopRequestTimer() {
			if (requestTimer) {
				clearInterval(requestTimer);
				requestTimer = null;
			}
			requestStartTime = null;
		}

		// Auto-resize textarea
		function adjustTextareaHeight() {
			// Reset height to calculate new height
			messageInput.style.height = 'auto';
			
			// Get computed styles
			const computedStyle = getComputedStyle(messageInput);
			const lineHeight = parseFloat(computedStyle.lineHeight);
			const paddingTop = parseFloat(computedStyle.paddingTop);
			const paddingBottom = parseFloat(computedStyle.paddingBottom);
			const borderTop = parseFloat(computedStyle.borderTopWidth);
			const borderBottom = parseFloat(computedStyle.borderBottomWidth);
			
			// Calculate heights
			const scrollHeight = messageInput.scrollHeight;
			const maxRows = 5;
			const minHeight = lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
			const maxHeight = (lineHeight * maxRows) + paddingTop + paddingBottom + borderTop + borderBottom;
			
			// Set height
			if (scrollHeight <= maxHeight) {
				messageInput.style.height = Math.max(scrollHeight, minHeight) + 'px';
				messageInput.style.overflowY = 'hidden';
			} else {
				messageInput.style.height = maxHeight + 'px';
				messageInput.style.overflowY = 'auto';
			}
		}

		messageInput.addEventListener('input', adjustTextareaHeight);

		// Save input text as user types (debounced)
		let saveInputTimeout;
		messageInput.addEventListener('input', () => {
			clearTimeout(saveInputTimeout);
			saveInputTimeout = setTimeout(() => {
				vscode.postMessage({
					type: 'saveInputText',
					text: messageInput.value
				});
			}, 500); // Save after 500ms of no typing
		});

		// Check for @docs mentions while typing
		messageInput.addEventListener('input', () => {
			checkForDocsMention(messageInput);
		});
		
		messageInput.addEventListener('keydown', (e) => {
			// Handle docs autocomplete keyboard navigation first
			if (handleDocsAutocompleteKey(e)) {
				return;
			}

			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				const sendBtn = document.getElementById('sendBtn');
				if (sendBtn.disabled){
					return;
				}
				sendMessage();
			} else if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
				// Don't prevent default, let @ be typed first
				// Check for docs mentions after a short delay
				setTimeout(() => {
					checkForDocsMention(messageInput);
				}, 50);
			} else if (e.key === 'Escape' && filePickerModal.style.display === 'flex') {
				e.preventDefault();
				hideFilePicker();
			} else if (e.key === 'Escape' && docsAutocompleteVisible) {
				e.preventDefault();
				hideDocsAutocomplete();
			} else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
				// Handle Ctrl+V/Cmd+V explicitly in case paste event doesn't fire
				// Don't prevent default - let browser handle it first
				setTimeout(() => {
					// If value hasn't changed, manually trigger paste
					const currentValue = messageInput.value;
					setTimeout(() => {
						if (messageInput.value === currentValue) {
							// Value didn't change, request clipboard from VS Code
							vscode.postMessage({
								type: 'getClipboardText'
							});
						}
					}, 50);
				}, 0);
			}
		});

		// Add explicit paste event handler for better clipboard support in VSCode webviews
		messageInput.addEventListener('paste', async (e) => {
			e.preventDefault();
			
			try {
				// Try to get clipboard data from the event first
				const clipboardData = e.clipboardData;
				
				// Check for images first
				if (clipboardData && clipboardData.items) {
					let hasImage = false;
					for (let i = 0; i < clipboardData.items.length; i++) {
						const item = clipboardData.items[i];
						if (item.type.startsWith('image/')) {
							// Found an image, handle it
							console.log('Image detected in clipboard:', item.type);
							hasImage = true;
							const blob = item.getAsFile();
							if (blob) {
								console.log('Converting image blob to base64...');
								// Convert blob to base64
								const reader = new FileReader();
								reader.onload = function(event) {
									const base64Data = event.target.result;
									console.log('Sending image to extension for file creation');
									// Send to extension to create file
									vscode.postMessage({
										type: 'createImageFile',
										imageData: base64Data,
										imageType: item.type
									});
								};
								reader.readAsDataURL(blob);
							}
							break; // Process only the first image found
						}
					}
					
					// If we found an image, don't process any text
					if (hasImage) {
						return;
					}
				}
				
				// No image found, handle text
				let text = '';
				
				if (clipboardData) {
					text = clipboardData.getData('text/plain');
				}
				
				// If no text from event, try navigator.clipboard API
				if (!text && navigator.clipboard && navigator.clipboard.readText) {
					try {
						text = await navigator.clipboard.readText();
					} catch (err) {
						console.log('Clipboard API failed:', err);
					}
				}
				
				// If still no text, request from VS Code extension
				if (!text) {
					vscode.postMessage({
						type: 'getClipboardText'
					});
					return;
				}
				
				// Insert text at cursor position
				const start = messageInput.selectionStart;
				const end = messageInput.selectionEnd;
				const currentValue = messageInput.value;
				
				const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
				messageInput.value = newValue;
				
				// Set cursor position after pasted text
				const newCursorPos = start + text.length;
				messageInput.setSelectionRange(newCursorPos, newCursorPos);
				
				// Trigger input event to adjust height
				messageInput.dispatchEvent(new Event('input', { bubbles: true }));
			} catch (error) {
				console.error('Paste error:', error);
			}
		});

		// Handle context menu paste
		messageInput.addEventListener('contextmenu', (e) => {
			// Don't prevent default - allow context menu to show
			// but ensure paste will work when selected
		});

		// Initialize textarea height
		adjustTextareaHeight();

		// File picker event listeners
		fileSearchInput.addEventListener('input', (e) => {
			filterFiles(e.target.value);
		});

		fileSearchInput.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedFileIndex = Math.min(selectedFileIndex + 1, filteredFiles.length - 1);
				renderFileList();
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedFileIndex = Math.max(selectedFileIndex - 1, -1);
				renderFileList();
			} else if (e.key === 'Enter' && selectedFileIndex >= 0) {
				e.preventDefault();
				selectFile(filteredFiles[selectedFileIndex]);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				hideFilePicker();
			}
		});

		// Close modal when clicking outside
		filePickerModal.addEventListener('click', (e) => {
			if (e.target === filePickerModal) {
				hideFilePicker();
			}
		});

		// Tools modal functions
		function showMCPModal() {
			document.getElementById('mcpModal').style.display = 'flex';
			// Load existing MCP servers
			loadMCPServers();
		}
		
		function updateYoloWarning() {
			const yoloModeCheckbox = document.getElementById('yolo-mode');
			const warning = document.getElementById('yoloWarning');
			
			if (!yoloModeCheckbox || !warning) {
				return; // Elements not ready yet
			}
			
			const yoloMode = yoloModeCheckbox.checked;
			warning.style.display = yoloMode ? 'block' : 'none';
		}
		
		function isPermissionError(content) {
			const permissionErrorPatterns = [
				'Error: MCP config file not found',
				'Error: MCP tool',
				'Claude requested permissions to use',
				'permission denied',
				'Permission denied',
				'permission request',
				'Permission request',
				'EACCES',
				'permission error',
				'Permission error'
			];
			
			return permissionErrorPatterns.some(pattern => 
				content.toLowerCase().includes(pattern.toLowerCase())
			);
		}
		
		function enableYoloMode() {
			sendStats('YOLO mode enabled');
			
			// Update the checkbox
			const yoloModeCheckbox = document.getElementById('yolo-mode');
			if (yoloModeCheckbox) {
				yoloModeCheckbox.checked = true;
				
				// Trigger the settings update
				updateSettings();
				
				// Show confirmation message
				addMessage('✅ Yolo Mode enabled! All permission checks will be bypassed for future commands.', 'system');
				
				// Update the warning banner
				updateYoloWarning();
			}
		}

		function hideMCPModal() {
			document.getElementById('mcpModal').style.display = 'none';
			hideAddServerForm();
		}

		// Close MCP modal when clicking outside
		document.getElementById('mcpModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('mcpModal')) {
				hideMCPModal();
			}
		});

		// ===== Documentation Manager Functions =====
		let docsCache = [];

		function showDocsModal() {
			document.getElementById('docsModal').style.display = 'flex';
			loadDocs();
		}

		function hideDocsModal() {
			document.getElementById('docsModal').style.display = 'none';
			hideAddDocForm();
		}

		// Close docs modal when clicking outside
		document.getElementById('docsModal')?.addEventListener('click', (e) => {
			if (e.target === document.getElementById('docsModal')) {
				hideDocsModal();
			}
		});

		function loadDocs() {
			vscode.postMessage({ type: 'loadDocs' });
		}

		function renderDocsList(docs) {
			docsCache = docs || [];
			const container = document.getElementById('docsList');

			if (!docs || docs.length === 0) {
				container.innerHTML = '<div class="no-docs">No documentation indexed yet. Click "+ Add Documentation" to get started.</div>';
				updateDocsStats({ totalDocs: 0, totalPages: 0, totalSize: '0 KB' });
				return;
			}

			let html = '';
			for (const doc of docs) {
				const statusClass = doc.status;
				const date = new Date(doc.updatedAt).toLocaleDateString();
				const time = new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

				html += \`
					<div class="docs-item" data-doc-id="\${doc.id}">
						<div class="docs-item-status \${statusClass}" title="\${doc.status}"></div>
						<div class="docs-item-info">
							<div class="docs-item-name">@\${doc.name}</div>
							<div class="docs-item-meta">
								<span>\${doc.pageCount} pages</span>
								<span>Indexed \${date}, \${time}</span>
							</div>
							<div class="docs-item-url">\${doc.entryUrl}</div>
							\${doc.status === 'indexing' ? '<div class="docs-item-progress">Crawling in progress...</div>' : ''}
							\${doc.status === 'failed' && doc.error ? '<div class="docs-item-error">Error: ' + escapeHtml(doc.error) + '</div>' : ''}
						</div>
						<div class="docs-item-actions">
							<button class="docs-action-btn" onclick="reindexDoc('\${doc.id}')" title="Re-index">🔄</button>
							<button class="docs-action-btn delete" onclick="deleteDoc('\${doc.id}')" title="Delete">🗑️</button>
						</div>
					</div>
				\`;
			}

			container.innerHTML = html;
		}

		function updateDocsStats(stats) {
			const container = document.getElementById('docsStats');
			if (stats.totalDocs === 0) {
				container.innerHTML = '';
				return;
			}
			container.innerHTML = \`Total: \${stats.totalDocs} docs • \${stats.totalPages} pages • \${stats.totalSize}\`;
		}

		function showAddDocForm() {
			document.getElementById('addDocBtn').style.display = 'none';
			document.getElementById('addDocForm').style.display = 'block';
		}

		function hideAddDocForm() {
			document.getElementById('addDocBtn').style.display = 'block';
			document.getElementById('addDocForm').style.display = 'none';
			document.getElementById('docsAdvancedOptions').style.display = 'none';

			// Clear form
			document.getElementById('docName').value = '';
			document.getElementById('docEntryUrl').value = '';
			document.getElementById('docPrefixUrl').value = '';
			document.getElementById('docMaxPages').value = '50';
			document.getElementById('docMaxDepth').value = '3';
		}

		function toggleDocsAdvanced() {
			const options = document.getElementById('docsAdvancedOptions');
			const toggle = document.querySelector('.docs-advanced-toggle span');
			if (options.style.display === 'none') {
				options.style.display = 'block';
				toggle.textContent = '▼ Advanced Options';
			} else {
				options.style.display = 'none';
				toggle.textContent = '▶ Advanced Options';
			}
		}

		function startAddDoc() {
			const name = document.getElementById('docName').value.trim();
			const entryUrl = document.getElementById('docEntryUrl').value.trim();
			const prefixUrl = document.getElementById('docPrefixUrl').value.trim();
			const maxPages = parseInt(document.getElementById('docMaxPages').value) || 50;
			const maxDepth = parseInt(document.getElementById('docMaxDepth').value) || 3;

			if (!name) {
				alert('Please enter a name for the documentation');
				return;
			}

			if (!entryUrl) {
				alert('Please enter the entry URL');
				return;
			}

			// Validate URL
			try {
				new URL(entryUrl);
			} catch {
				alert('Please enter a valid URL');
				return;
			}

			vscode.postMessage({
				type: 'addDoc',
				name,
				entryUrl,
				prefixUrl,
				maxPages,
				maxDepth
			});

			hideAddDocForm();
		}

		function reindexDoc(docId) {
			// Show inline confirmation
			const item = document.querySelector(\`.docs-item[data-doc-id="\${docId}"]\`);
			if (!item) return;

			const actionsDiv = item.querySelector('.docs-item-actions');
			if (!actionsDiv) return;

			// Check if already showing confirmation
			if (actionsDiv.querySelector('.confirm-actions')) return;

			// Save original content and show confirmation
			const originalContent = actionsDiv.innerHTML;
			actionsDiv.innerHTML = \`
				<div class="confirm-actions">
					<span class="confirm-text">Re-crawl?</span>
					<button class="docs-action-btn confirm-yes" onclick="confirmReindexDoc('\${docId}')">✓</button>
					<button class="docs-action-btn confirm-no" onclick="cancelDocAction('\${docId}')">✗</button>
				</div>
			\`;
			actionsDiv.dataset.originalContent = originalContent;
		}

		function confirmReindexDoc(docId) {
			// Send the reindex request
			vscode.postMessage({ type: 'reindexDoc', docId: docId });
			// Restore buttons
			cancelDocAction(docId);
		}

		function deleteDoc(docId) {
			// Show inline confirmation
			const item = document.querySelector(\`.docs-item[data-doc-id="\${docId}"]\`);
			if (!item) return;

			const actionsDiv = item.querySelector('.docs-item-actions');
			if (!actionsDiv) return;

			// Check if already showing confirmation
			if (actionsDiv.querySelector('.confirm-actions')) return;

			// Save original content and show confirmation
			const originalContent = actionsDiv.innerHTML;
			actionsDiv.innerHTML = \`
				<div class="confirm-actions">
					<span class="confirm-text">Delete?</span>
					<button class="docs-action-btn confirm-yes delete" onclick="confirmDeleteDoc('\${docId}')">✓</button>
					<button class="docs-action-btn confirm-no" onclick="cancelDocAction('\${docId}')">✗</button>
				</div>
			\`;
			actionsDiv.dataset.originalContent = originalContent;
		}

		function confirmDeleteDoc(docId) {
			// Send the delete request
			vscode.postMessage({ type: 'deleteDoc', docId: docId });
		}

		function cancelDocAction(docId) {
			const item = document.querySelector(\`.docs-item[data-doc-id="\${docId}"]\`);
			if (!item) return;

			const actionsDiv = item.querySelector('.docs-item-actions');
			if (!actionsDiv || !actionsDiv.dataset.originalContent) return;

			actionsDiv.innerHTML = actionsDiv.dataset.originalContent;
			delete actionsDiv.dataset.originalContent;
		}

		function updateDocProgress(docId, current, total, status) {
			const item = document.querySelector(\`.docs-item[data-doc-id="\${docId}"]\`);
			if (!item) return;

			const progressDiv = item.querySelector('.docs-item-progress');
			if (status.startsWith('error:')) {
				if (progressDiv) {
					progressDiv.className = 'docs-item-error';
					progressDiv.textContent = status;
				}
				const statusDot = item.querySelector('.docs-item-status');
				statusDot.className = 'docs-item-status failed';
			} else if (status === 'completed') {
				loadDocs(); // Refresh the list
			} else {
				if (progressDiv) {
					progressDiv.textContent = \`\${status} (\${current}/\${total})\`;
				}
			}
		}

		// ===== @Docs Mention Autocomplete =====
		let docsAutocompleteVisible = false;
		let docsAutocompleteIndex = 0;

		function showDocsAutocomplete(searchTerm) {
			const filteredDocs = docsCache.filter(d =>
				d.status === 'indexed' &&
				d.name.toLowerCase().includes(searchTerm.toLowerCase())
			);

			if (filteredDocs.length === 0) {
				hideDocsAutocomplete();
				return;
			}

			let container = document.getElementById('docsAutocomplete');
			if (!container) {
				container = document.createElement('div');
				container.id = 'docsAutocomplete';
				container.className = 'docs-autocomplete';
				document.querySelector('.textarea-wrapper').appendChild(container);
			}

			let html = '<div class="docs-autocomplete-header">📚 Documentation</div>';
			filteredDocs.forEach((doc, index) => {
				html += \`
					<div class="docs-autocomplete-item \${index === docsAutocompleteIndex ? 'selected' : ''}"
						 data-doc-name="\${doc.name}"
						 onclick="insertDocMention('\${doc.name}')">
						<span class="docs-autocomplete-icon">📖</span>
						<div class="docs-autocomplete-info">
							<div class="docs-autocomplete-name">@\${doc.name}</div>
							<div class="docs-autocomplete-detail">\${doc.pageCount} pages</div>
						</div>
					</div>
				\`;
			});

			container.innerHTML = html;
			container.style.display = 'block';
			docsAutocompleteVisible = true;
		}

		function hideDocsAutocomplete() {
			const container = document.getElementById('docsAutocomplete');
			if (container) {
				container.style.display = 'none';
			}
			docsAutocompleteVisible = false;
			docsAutocompleteIndex = 0;
		}

		function insertDocMention(docName) {
			const input = document.getElementById('messageInput');
			const text = input.value;
			const cursorPos = input.selectionStart;

			// Find the @ symbol position
			let atPos = cursorPos - 1;
			while (atPos >= 0 && text[atPos] !== '@' && text[atPos] !== ' ' && text[atPos] !== '\\n') {
				atPos--;
			}

			if (text[atPos] === '@') {
				const before = text.substring(0, atPos);
				const after = text.substring(cursorPos);
				input.value = before + '@' + docName + ' ' + after;
				input.selectionStart = input.selectionEnd = atPos + docName.length + 2;
			}

			hideDocsAutocomplete();
			input.focus();
		}

		// Handle keyboard navigation in autocomplete
		function handleDocsAutocompleteKey(e) {
			if (!docsAutocompleteVisible) return false;

			const items = document.querySelectorAll('.docs-autocomplete-item');
			if (items.length === 0) return false;

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				docsAutocompleteIndex = Math.min(docsAutocompleteIndex + 1, items.length - 1);
				updateDocsAutocompleteSelection(items);
				return true;
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				docsAutocompleteIndex = Math.max(docsAutocompleteIndex - 1, 0);
				updateDocsAutocompleteSelection(items);
				return true;
			} else if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				const selectedItem = items[docsAutocompleteIndex];
				if (selectedItem) {
					insertDocMention(selectedItem.dataset.docName);
				}
				return true;
			} else if (e.key === 'Escape') {
				hideDocsAutocomplete();
				return true;
			}

			return false;
		}

		function updateDocsAutocompleteSelection(items) {
			items.forEach((item, index) => {
				item.classList.toggle('selected', index === docsAutocompleteIndex);
			});
		}

		// Check for @ mentions in input
		function checkForDocsMention(input) {
			const text = input.value;
			const cursorPos = input.selectionStart;

			// Find if we're typing after an @
			let atPos = cursorPos - 1;
			while (atPos >= 0 && text[atPos] !== ' ' && text[atPos] !== '\\n') {
				if (text[atPos] === '@') {
					const searchTerm = text.substring(atPos + 1, cursorPos);
					// Only show autocomplete if we have docs cached and term is not empty
					if (docsCache.length > 0) {
						showDocsAutocomplete(searchTerm);
						return;
					}
				}
				atPos--;
			}

			hideDocsAutocomplete();
		}

		// ===== Project Memory Management Functions =====
		let memorySearchTimeout;
		const entityTypeIcons = {
			project: '📁',
			task: '✅',
			file: '📄',
			decision: '🎯',
			pattern: '🔄',
			bug: '🐛',
			feature: '✨',
			dependency: '📦',
			architecture: '🏗️',
			conversation: '💬',
			milestone: '🏆'
		};

		function showMemoryModal() {
			document.getElementById('memoryModal').style.display = 'flex';
			loadMemoryStats();
			loadMemorySettings();
		}

		function hideMemoryModal() {
			document.getElementById('memoryModal').style.display = 'none';
			document.getElementById('memorySearchResults').style.display = 'none';
			document.getElementById('memoryEntitiesSection').style.display = 'block';
			document.getElementById('memorySearchInput').value = '';
		}

		// Memory Settings Functions
		function loadMemorySettings() {
			vscode.postMessage({ type: 'getMemorySettings' });
		}

		function renderMemorySettings(settings) {
			const autoInjectCheckbox = document.getElementById('memoryAutoInject');
			const maxContextInput = document.getElementById('memoryMaxContext');
			const maxContextSlider = document.getElementById('memoryMaxContextSlider');

			if (autoInjectCheckbox) {
				autoInjectCheckbox.checked = settings.autoInject !== false;
			}
			if (maxContextInput) {
				maxContextInput.value = settings.maxContextSize || 4000;
			}
			if (maxContextSlider) {
				maxContextSlider.value = settings.maxContextSize || 4000;
			}
		}

		function syncMemoryContextSlider(value) {
			const maxContextInput = document.getElementById('memoryMaxContext');
			if (maxContextInput) {
				maxContextInput.value = value;
			}
			updateMemorySettings();
		}

		function updateMemorySettings() {
			const autoInjectCheckbox = document.getElementById('memoryAutoInject');
			const maxContextInput = document.getElementById('memoryMaxContext');

			const settings = {
				autoInject: autoInjectCheckbox ? autoInjectCheckbox.checked : true,
				maxContextSize: maxContextInput ? parseInt(maxContextInput.value, 10) : 4000
			};

			// Sync slider with input
			const slider = document.getElementById('memoryMaxContextSlider');
			if (slider) {
				slider.value = settings.maxContextSize;
			}

			vscode.postMessage({ type: 'updateMemorySettings', settings });
		}

		// Close memory modal when clicking outside
		document.getElementById('memoryModal')?.addEventListener('click', (e) => {
			if (e.target === document.getElementById('memoryModal')) {
				hideMemoryModal();
			}
		});

		function loadMemoryStats() {
			// Show loading state
			document.getElementById('memoryTotalEntities').textContent = '...';
			document.getElementById('memoryTotalRelations').textContent = '...';
			document.getElementById('memoryTotalObservations').textContent = '...';
			document.getElementById('memoryLastUpdated').textContent = 'Loading...';
			document.getElementById('memoryEntityTypes').innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading entities...</p>';

			vscode.postMessage({ type: 'getMemoryStats' });
		}

		let memoryRetryCount = 0;
		const maxMemoryRetries = 3;

		function renderMemoryStats(data) {
			if (!data.initialized) {
				// Retry loading memory stats if initialization is in progress
				if (memoryRetryCount < maxMemoryRetries) {
					memoryRetryCount++;
					document.getElementById('memoryTotalEntities').textContent = '-';
					document.getElementById('memoryTotalRelations').textContent = '-';
					document.getElementById('memoryTotalObservations').textContent = '-';
					document.getElementById('memoryLastUpdated').textContent = 'Initializing... (attempt ' + memoryRetryCount + '/' + maxMemoryRetries + ')';
					document.getElementById('memoryEntityTypes').innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading memory system...</p>';
					// Retry after a delay
					setTimeout(() => {
						loadMemoryStats();
					}, 1500);
					return;
				}
				document.getElementById('memoryTotalEntities').textContent = '-';
				document.getElementById('memoryTotalRelations').textContent = '-';
				document.getElementById('memoryTotalObservations').textContent = '-';
				document.getElementById('memoryLastUpdated').textContent = 'Memory not initialized';
				document.getElementById('memoryEntityTypes').innerHTML = '<p style="text-align: center; color: var(--text-muted);">Memory not available. Please reload the extension.</p>';
				return;
			}

			// Reset retry count on success
			memoryRetryCount = 0;

			document.getElementById('memoryTotalEntities').textContent = data.totalEntities || 0;
			document.getElementById('memoryTotalRelations').textContent = data.totalRelations || 0;
			document.getElementById('memoryTotalObservations').textContent = data.totalObservations || 0;

			if (data.lastUpdated) {
				const date = new Date(data.lastUpdated);
				document.getElementById('memoryLastUpdated').textContent = 'Last updated: ' + date.toLocaleString();
			}

			// Render entity type breakdown
			if (data.entitiesByType) {
				let html = '';
				for (const [type, count] of Object.entries(data.entitiesByType)) {
					if (count > 0) {
						const icon = entityTypeIcons[type] || '📌';
						html += \`
							<div class="memory-entity-type">
								<span class="memory-entity-type-name">
									<span class="memory-entity-type-icon">\${icon}</span>
									\${type}
								</span>
								<span class="memory-entity-type-count">\${count}</span>
							</div>
						\`;
					}
				}
				document.getElementById('memoryEntityTypes').innerHTML = html || '<p style="text-align: center; color: var(--text-muted);">No entities recorded yet</p>';
			}
		}

		function debounceMemorySearch(query) {
			clearTimeout(memorySearchTimeout);
			if (query.length < 2) {
				document.getElementById('memorySearchResults').style.display = 'none';
				document.getElementById('memoryEntitiesSection').style.display = 'block';
				return;
			}
			memorySearchTimeout = setTimeout(() => {
				searchMemory(query);
			}, 300);
		}

		function searchMemory(query) {
			vscode.postMessage({ type: 'searchMemory', query });
		}

		function renderMemorySearchResults(data) {
			const container = document.getElementById('memoryResultsList');
			document.getElementById('memorySearchResults').style.display = 'block';
			document.getElementById('memoryEntitiesSection').style.display = 'none';

			if (!data.results || data.results.length === 0) {
				container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No results found for "' + escapeHtml(data.query) + '"</p>';
				return;
			}

			let html = '';
			for (const result of data.results) {
				const icon = entityTypeIcons[result.type] || '📌';
				const observations = result.observations.map(o => '<li>' + escapeHtml(o.substring(0, 100)) + '</li>').join('');
				html += \`
					<div class="memory-result-item">
						<div class="memory-result-header">
							<span class="memory-result-name">\${icon} \${escapeHtml(result.name.substring(0, 50))}</span>
							<span class="memory-result-type">\${result.type}</span>
						</div>
						\${observations ? '<ul class="memory-result-observations">' + observations + '</ul>' : ''}
					</div>
				\`;
			}
			container.innerHTML = html;
		}

		function generateMemoryContext() {
			// Show loading state
			const preview = document.getElementById('memoryContextPreview');
			const btn = document.querySelector('.memory-context-section .btn.outlined');
			if (preview) {
				preview.innerHTML = '<p class="memory-context-hint">⏳ Generating context...</p>';
			}
			if (btn) {
				btn.textContent = 'Generating...';
				btn.disabled = true;
			}
			vscode.postMessage({ type: 'getMemoryContext' });
		}

		function renderMemoryContext(data) {
			const preview = document.getElementById('memoryContextPreview');
			const btn = document.querySelector('.memory-context-section .btn.outlined');

			// Reset button state
			if (btn) {
				btn.textContent = 'Generate Context';
				btn.disabled = false;
			}

			if (data.context && data.context.length > 100) {
				// Show character count
				const charCount = data.context.length;
				preview.innerHTML = '<div class="memory-context-stats">📊 ' + charCount.toLocaleString() + ' characters</div><pre>' + escapeHtml(data.context) + '</pre>';
			} else {
				preview.innerHTML = '<p class="memory-context-hint">No memory context available yet. Start chatting with Claude to build project memory.</p>';
			}
		}

		function exportProjectMemory() {
			vscode.postMessage({ type: 'exportMemory' });
			// Show feedback
			const btn = document.querySelector('.memory-actions .btn.outlined:first-child');
			if (btn) {
				const originalText = btn.textContent;
				btn.textContent = 'Exporting...';
				btn.disabled = true;
				setTimeout(() => {
					btn.textContent = originalText;
					btn.disabled = false;
				}, 2000);
			}
		}

		let clearMemoryConfirmationShown = false;

		function confirmClearMemory() {
			if (clearMemoryConfirmationShown) {
				return;
			}
			clearMemoryConfirmationShown = true;

			// Try both old and new class names for compatibility
			const actionsDiv = document.querySelector('.memory-actions-row') || document.querySelector('.memory-actions');
			if (!actionsDiv) {
				// If no container found, just clear directly with confirmation
				if (confirm('Are you sure you want to clear all project memory? This cannot be undone.')) {
					clearProjectMemory();
					loadMemoryStats();
				}
				clearMemoryConfirmationShown = false;
				return;
			}

			// Store original buttons
			const originalButtons = actionsDiv.innerHTML;

			// Create confirmation UI
			actionsDiv.innerHTML = '';

			const confirmSpan = document.createElement('span');
			confirmSpan.style.cssText = 'color: var(--accent-red); margin-right: 12px;';
			confirmSpan.textContent = 'Clear all memory?';

			const yesBtn = document.createElement('button');
			yesBtn.className = 'btn outlined danger';
			yesBtn.textContent = 'Yes, Clear';
			yesBtn.onclick = function() {
				clearProjectMemory();
				restoreButtons();
				loadMemoryStats();
			};

			const cancelBtn = document.createElement('button');
			cancelBtn.className = 'btn outlined';
			cancelBtn.style.marginLeft = '8px';
			cancelBtn.textContent = 'Cancel';
			cancelBtn.onclick = function() {
				restoreButtons();
			};

			actionsDiv.appendChild(confirmSpan);
			actionsDiv.appendChild(yesBtn);
			actionsDiv.appendChild(cancelBtn);

			function restoreButtons() {
				actionsDiv.innerHTML = originalButtons;
				clearMemoryConfirmationShown = false;
			}
		}

		function clearProjectMemory() {
			vscode.postMessage({ type: 'clearMemory' });
		}

		// ===== Task Manager Functions =====
		let currentTaskFilter = 'all';
		let allTasksData = [];
		let currentViewingTaskId = null;

		function showTaskManagerModal() {
			document.getElementById('taskManagerModal').style.display = 'flex';
			refreshTaskList();
			loadSessionHealth();
		}

		function hideTaskManagerModal() {
			document.getElementById('taskManagerModal').style.display = 'none';
			hideTaskDetails();
		}

		// Close task manager modal when clicking outside
		document.getElementById('taskManagerModal')?.addEventListener('click', (e) => {
			if (e.target === document.getElementById('taskManagerModal')) {
				hideTaskManagerModal();
			}
		});

		function loadSessionHealth() {
			vscode.postMessage({ type: 'getSessionHealth' });
		}

		function renderSessionHealth(data) {
			const icon = document.getElementById('sessionHealthIcon');
			const progress = document.getElementById('sessionHealthProgress');
			const percent = document.getElementById('sessionHealthPercent');
			const tokens = document.getElementById('sessionTokenCount');
			const recommendation = document.getElementById('sessionHealthRecommendation');
			const recommendationText = document.getElementById('sessionRecommendationText');

			if (icon) {
				icon.textContent = data.status === 'healthy' ? '🟢' : data.status === 'warning' ? '🟡' : '🔴';
			}

			if (progress) {
				progress.style.width = Math.min(data.usagePercent, 100) + '%';
				progress.className = 'session-health-progress ' + data.status;
			}

			if (percent) {
				percent.textContent = data.usagePercent.toFixed(1) + '%';
			}

			if (tokens) {
				tokens.textContent = (data.sessionTokens || 0).toLocaleString();
			}

			if (recommendation && recommendationText) {
				if (data.status !== 'healthy') {
					recommendation.style.display = 'flex';
					recommendationText.textContent = data.recommendation;
				} else {
					recommendation.style.display = 'none';
				}
			}
		}

		function forceNewSession() {
			if (confirm('Start a new session? This will clear the current conversation history.')) {
				vscode.postMessage({ type: 'forceNewSession' });
				setTimeout(() => {
					loadSessionHealth();
				}, 500);
			}
		}

		function refreshTaskList() {
			const taskList = document.getElementById('taskList');
			if (taskList) {
				taskList.innerHTML = '<p class="task-list-loading">Loading tasks...</p>';
			}
			vscode.postMessage({ type: 'getAllTasks' });
		}

		let taskRetryCount = 0;
		const maxTaskRetries = 3;

		function renderTaskList(data) {
			const taskList = document.getElementById('taskList');
			if (!taskList) return;

			// Check if we got an error about manager not initialized
			if (data.error && data.error.includes('not initialized')) {
				if (taskRetryCount < maxTaskRetries) {
					taskRetryCount++;
					taskList.innerHTML = \`
						<div class="task-list-empty">
							<div class="task-list-empty-icon">⏳</div>
							<div class="task-list-empty-text">Initializing task manager...</div>
							<div class="task-list-empty-hint">Attempt \${taskRetryCount}/\${maxTaskRetries}</div>
						</div>
					\`;
					// Retry after a delay
					setTimeout(() => {
						refreshTaskList();
					}, 1500);
					return;
				}
			}

			// Reset retry count on success or after max retries
			taskRetryCount = 0;

			allTasksData = data.tasks || [];

			// Apply filter
			const filteredTasks = filterTaskData(allTasksData, currentTaskFilter);

			if (filteredTasks.length === 0) {
				taskList.innerHTML = \`
					<div class="task-list-empty">
						<div class="task-list-empty-icon">📋</div>
						<div class="task-list-empty-text">No tasks found</div>
						<div class="task-list-empty-hint">Tasks are automatically extracted from your conversations</div>
					</div>
				\`;
				return;
			}

			let html = '';
			for (const task of filteredTasks) {
				const importanceIcon = {
					critical: '🔴',
					high: '🟠',
					medium: '🔵',
					low: '⚪'
				}[task.importance] || '⚪';

				html += \`
					<div class="task-item" onclick="viewTaskDetails('\${escapeHtml(task.id)}')">
						<div class="task-item-header">
							<span class="task-item-name">\${escapeHtml(task.name)}</span>
							<span class="task-item-status \${task.status}">\${task.status}</span>
						</div>
						<div class="task-item-description">\${escapeHtml(task.description)}</div>
						<div class="task-item-meta">
							<span class="task-item-importance \${task.importance}">
								\${importanceIcon} \${task.importance}
							</span>
							<span class="task-item-progress">
								<div class="task-progress-bar">
									<div class="task-progress-fill" style="width: \${task.progress}%"></div>
								</div>
								\${task.progress}%
							</span>
						</div>
					</div>
				\`;
			}

			taskList.innerHTML = html;
		}

		function filterTaskData(tasks, filter) {
			if (filter === 'all') return tasks;
			return tasks.filter(t => t.status === filter);
		}

		function filterTasks(filter) {
			currentTaskFilter = filter;

			// Update button states
			document.querySelectorAll('.task-filter-btn').forEach(btn => {
				btn.classList.toggle('active', btn.dataset.filter === filter);
			});

			// Re-render with filter
			renderTaskList({ tasks: allTasksData });
		}

		function viewTaskDetails(taskId) {
			currentViewingTaskId = taskId;
			vscode.postMessage({ type: 'getTaskDetails', taskId });

			// Show loading state
			document.getElementById('taskDetailsContent').innerHTML = '<p style="color: var(--text-muted);">Loading task details...</p>';
			document.getElementById('taskDetailsPanel').style.display = 'block';
			document.querySelector('.task-list-section').style.display = 'none';
			document.querySelector('.create-task-section').style.display = 'none';
		}

		function renderTaskDetails(data) {
			const panel = document.getElementById('taskDetailsPanel');
			const content = document.getElementById('taskDetailsContent');
			const title = document.getElementById('taskDetailsTitle');

			if (!panel || !content || !data.task) {
				if (content) {
					content.innerHTML = '<p style="color: var(--text-muted);">Task not found</p>';
				}
				return;
			}

			const task = data.task;
			title.textContent = task.name;

			const importanceIcon = {
				critical: '🔴',
				high: '🟠',
				medium: '🔵',
				low: '⚪'
			}[task.importance] || '⚪';

			let observationsHtml = '';
			if (task.observations && task.observations.length > 0) {
				observationsHtml = '<ul class="task-observations-list">';
				for (const obs of task.observations) {
					observationsHtml += '<li>' + escapeHtml(obs) + '</li>';
				}
				observationsHtml += '</ul>';
			} else {
				observationsHtml = '<p style="color: var(--text-muted);">No observations yet</p>';
			}

			let filesHtml = '';
			if (task.relatedFiles && task.relatedFiles.length > 0) {
				filesHtml = '<div class="task-related-files">';
				for (const file of task.relatedFiles) {
					filesHtml += '<span class="task-file-tag">' + escapeHtml(file) + '</span>';
				}
				filesHtml += '</div>';
			} else {
				filesHtml = '<span style="color: var(--text-muted);">None</span>';
			}

			content.innerHTML = \`
				<div class="task-detail-row">
					<span class="task-detail-label">Status:</span>
					<span class="task-detail-value">
						<span class="task-item-status \${task.status}">\${task.status}</span>
					</span>
				</div>
				<div class="task-detail-row">
					<span class="task-detail-label">Priority:</span>
					<span class="task-detail-value">\${importanceIcon} \${task.importance}</span>
				</div>
				<div class="task-detail-row">
					<span class="task-detail-label">Progress:</span>
					<span class="task-detail-value">
						<div class="task-progress-bar" style="width: 100px;">
							<div class="task-progress-fill" style="width: \${task.progress}%"></div>
						</div>
						<span style="margin-left: 8px;">\${task.progress}%</span>
					</span>
				</div>
				<div class="task-detail-row">
					<span class="task-detail-label">Created:</span>
					<span class="task-detail-value">\${new Date(task.createdAt).toLocaleString()}</span>
				</div>
				<div class="task-detail-row">
					<span class="task-detail-label">Updated:</span>
					<span class="task-detail-value">\${new Date(task.updatedAt).toLocaleString()}</span>
				</div>
				<div class="task-detail-row">
					<span class="task-detail-label">Related Files:</span>
					<span class="task-detail-value">\${filesHtml}</span>
				</div>
				<div style="margin-top: 16px;">
					<h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--vscode-foreground);">Observations:</h5>
					\${observationsHtml}
				</div>
				<div class="add-observation-section">
					<input type="text" id="newObservationInput" class="add-observation-input" placeholder="Add observation...">
					<button class="btn small outlined" onclick="addObservation()">Add</button>
				</div>
				<div class="task-actions">
					\${task.status !== 'completed' ? '<button class="btn small primary" onclick="markTaskComplete()">Mark Complete</button>' : ''}
					\${task.status !== 'active' ? '<button class="btn small outlined" onclick="markTaskActive()">Mark Active</button>' : ''}
					\${task.status !== 'deprecated' ? '<button class="btn small outlined" onclick="markTaskDeprecated()">Deprecate</button>' : ''}
				</div>
			\`;
		}

		function hideTaskDetails() {
			document.getElementById('taskDetailsPanel').style.display = 'none';
			document.querySelector('.task-list-section').style.display = 'block';
			document.querySelector('.create-task-section').style.display = 'block';
			currentViewingTaskId = null;
		}

		function addObservation() {
			const input = document.getElementById('newObservationInput');
			if (!input || !input.value.trim() || !currentViewingTaskId) return;

			vscode.postMessage({
				type: 'addTaskObservation',
				taskId: currentViewingTaskId,
				observation: input.value.trim()
			});

			input.value = '';
		}

		function markTaskComplete() {
			if (!currentViewingTaskId) return;
			vscode.postMessage({
				type: 'updateTaskStatus',
				taskId: currentViewingTaskId,
				status: 'completed'
			});
		}

		function markTaskActive() {
			if (!currentViewingTaskId) return;
			vscode.postMessage({
				type: 'updateTaskStatus',
				taskId: currentViewingTaskId,
				status: 'active'
			});
		}

		function markTaskDeprecated() {
			if (!currentViewingTaskId) return;
			vscode.postMessage({
				type: 'updateTaskStatus',
				taskId: currentViewingTaskId,
				status: 'deprecated'
			});
		}

		function createNewTask() {
			const nameInput = document.getElementById('newTaskName');
			const descInput = document.getElementById('newTaskDescription');
			const importanceSelect = document.getElementById('newTaskImportance');

			if (!nameInput || !nameInput.value.trim()) {
				// Show inline error instead of alert
				showNotification('Please enter a task name', 'error');
				return;
			}

			const taskName = nameInput.value.trim();
			const taskDescription = descInput?.value?.trim() || taskName;
			const taskImportance = importanceSelect?.value || 'medium';

			vscode.postMessage({
				type: 'createTask',
				name: taskName,
				description: taskDescription,
				importance: taskImportance
			});

			// Clear form
			nameInput.value = '';
			if (descInput) descInput.value = '';
			if (importanceSelect) importanceSelect.value = 'medium';

			// Collapse the create section
			const createSection = document.getElementById('createTaskSection');
			if (createSection) {
				createSection.classList.add('collapsed');
			}

			// Show success notification
			showNotification('Task created: ' + taskName, 'success');

			// Refresh task list after a short delay
			setTimeout(() => {
				refreshTaskList();
			}, 300);
		}

		// Helper function to show notifications
		function showNotification(message, type = 'info') {
			const notification = document.createElement('div');
			notification.className = 'notification notification-' + type;
			notification.textContent = message;
			notification.style.cssText = \`
				position: fixed;
				top: 20px;
				right: 20px;
				padding: 10px 16px;
				border-radius: 8px;
				font-size: 13px;
				z-index: 10000;
				animation: slideIn 0.3s ease;
				background: \${type === 'success' ? 'var(--accent-green)' : type === 'error' ? 'var(--accent-red)' : 'var(--accent-blue)'};
				color: white;
				box-shadow: 0 4px 12px rgba(0,0,0,0.2);
			\`;
			document.body.appendChild(notification);
			setTimeout(() => {
				notification.style.opacity = '0';
				notification.style.transition = 'opacity 0.3s';
				setTimeout(() => notification.remove(), 300);
			}, 3000);
		}

		// ===== Unified Context Manager Functions =====
		let currentContextTab = 'overview';
		let scratchpadItems = [];
		let contextActivityLog = [];

		function showContextManagerModal() {
			document.getElementById('contextManagerModal').style.display = 'flex';
			switchContextTab('overview');
			refreshContextOverview();
			loadMemorySettings();
		}

		function hideContextManagerModal() {
			document.getElementById('contextManagerModal').style.display = 'none';
		}

		// Close context manager modal when clicking outside
		document.getElementById('contextManagerModal')?.addEventListener('click', (e) => {
			if (e.target === document.getElementById('contextManagerModal')) {
				hideContextManagerModal();
			}
		});

		function switchContextTab(tabName) {
			currentContextTab = tabName;

			// Update tab buttons
			document.querySelectorAll('.context-tab').forEach(tab => {
				tab.classList.toggle('active', tab.dataset.tab === tabName);
			});

			// Update tab content
			document.querySelectorAll('.context-tab-content').forEach(content => {
				content.classList.toggle('active', content.id === 'tab-' + tabName);
			});

			// Load tab-specific data
			if (tabName === 'overview') {
				refreshContextOverview();
			} else if (tabName === 'memory') {
				loadMemoryStats();
			} else if (tabName === 'tasks') {
				refreshTaskList();
			} else if (tabName === 'scratchpad') {
				// Load scratchpad items from extension (persisted to file)
				vscode.postMessage({ type: 'getScratchpadItems' });
				renderScratchpadList();
			} else if (tabName === 'settings') {
				loadMemorySettings();
			}
		}

		function refreshContextOverview() {
			// Load session health
			loadSessionHealth();

			// Load memory stats for quick stats
			vscode.postMessage({ type: 'getMemoryStats' });

			// Load task count for quick stats
			vscode.postMessage({ type: 'getAllTasks' });

			// Load activity log
			loadActivityLog();
		}

		function loadActivityLog() {
			vscode.postMessage({ type: 'getActivityLog' });
		}

		function renderActivityLog(data) {
			const timeline = document.getElementById('ctxActivityTimeline');
			if (!timeline) return;

			contextActivityLog = data.activities || [];

			if (contextActivityLog.length === 0) {
				timeline.innerHTML = '<div class="activity-empty">No recent activity. Start chatting to build memory.</div>';
				return;
			}

			let html = '';
			for (const activity of contextActivityLog.slice(0, 10)) {
				const icon = {
					'memory_add': '🧠',
					'task_create': '📋',
					'task_complete': '✅',
					'scratchpad_add': '📝',
					'context_inject': '⚡',
					'session_start': '🚀'
				}[activity.type] || '📌';

				const timeAgo = formatTimeAgo(new Date(activity.timestamp));

				html += \`
					<div class="activity-timeline-item">
						<div class="activity-timeline-icon">\${icon}</div>
						<div class="activity-timeline-content">
							<div class="activity-timeline-text">\${escapeHtml(activity.description)}</div>
							<div class="activity-timeline-time">\${timeAgo}</div>
						</div>
					</div>
				\`;
			}
			timeline.innerHTML = html;
		}

		function formatTimeAgo(date) {
			const seconds = Math.floor((new Date() - date) / 1000);
			if (seconds < 60) return 'Just now';
			if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
			if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
			return Math.floor(seconds / 86400) + 'd ago';
		}

		function renderContextOverviewStats(data) {
			// Update quick stats
			const totalEntities = document.getElementById('ctxTotalEntities');
			if (totalEntities) {
				totalEntities.textContent = data.totalEntities || 0;
			}

			// Update scratchpad count
			const scratchpadCount = document.getElementById('ctxScratchpadItems');
			if (scratchpadCount) {
				scratchpadCount.textContent = scratchpadItems.length;
			}

			// Update Context Priority Allocation based on real data
			updateContextPriorityAllocation(data);
		}

		// Dynamic Context Priority Allocation updater
		function updateContextPriorityAllocation(data) {
			// Calculate real priority distribution based on memory data
			const totalEntities = data.totalEntities || 0;
			const totalObservations = data.totalObservations || 0;
			const totalRelations = data.totalRelations || 0;
			const entitiesByType = data.entitiesByType || {};

			// Calculate percentages based on actual content types
			let criticalItems = 0;  // System rules, decisions
			let highItems = 0;      // Active files, recent entities
			let mediumItems = 0;    // Related context
			let lowItems = 0;       // Background info

			// Count by entity type
			for (const [type, count] of Object.entries(entitiesByType)) {
				const numCount = Number(count) || 0;
				switch(type) {
					case 'decision':
					case 'architecture':
					case 'pattern':
						criticalItems += numCount;
						break;
					case 'file':
					case 'task':
					case 'bug':
					case 'feature':
						highItems += numCount;
						break;
					case 'dependency':
					case 'conversation':
						mediumItems += numCount;
						break;
					default:
						lowItems += numCount;
				}
			}

			// Add scratchpad items to critical (they boost attention)
			criticalItems += scratchpadItems.length;

			// Calculate total for percentages
			const totalItems = criticalItems + highItems + mediumItems + lowItems;

			// Calculate percentages (with minimums to show something)
			let criticalPercent, highPercent, mediumPercent, lowPercent;

			if (totalItems > 0) {
				criticalPercent = Math.max(5, Math.round((criticalItems / totalItems) * 100));
				highPercent = Math.max(10, Math.round((highItems / totalItems) * 100));
				mediumPercent = Math.max(10, Math.round((mediumItems / totalItems) * 100));
				lowPercent = Math.max(5, Math.round((lowItems / totalItems) * 100));

				// Normalize to 100%
				const sum = criticalPercent + highPercent + mediumPercent + lowPercent;
				if (sum !== 100) {
					const factor = 100 / sum;
					criticalPercent = Math.round(criticalPercent * factor);
					highPercent = Math.round(highPercent * factor);
					mediumPercent = Math.round(mediumPercent * factor);
					lowPercent = 100 - criticalPercent - highPercent - mediumPercent;
				}
			} else {
				// Default distribution when no data
				criticalPercent = 15;
				highPercent = 35;
				mediumPercent = 30;
				lowPercent = 20;
			}

			// Update the UI elements
			const priorityCritical = document.getElementById('priorityCritical');
			const priorityHigh = document.getElementById('priorityHigh');
			const priorityMedium = document.getElementById('priorityMedium');
			const priorityLow = document.getElementById('priorityLow');

			const criticalPercentLabel = document.getElementById('priorityCriticalPercent');
			const highPercentLabel = document.getElementById('priorityHighPercent');
			const mediumPercentLabel = document.getElementById('priorityMediumPercent');
			const lowPercentLabel = document.getElementById('priorityLowPercent');

			if (priorityCritical) {
				priorityCritical.style.width = criticalPercent + '%';
			}
			if (priorityHigh) {
				priorityHigh.style.width = highPercent + '%';
			}
			if (priorityMedium) {
				priorityMedium.style.width = mediumPercent + '%';
			}
			if (priorityLow) {
				priorityLow.style.width = lowPercent + '%';
			}

			if (criticalPercentLabel) {
				criticalPercentLabel.textContent = criticalPercent + '%';
			}
			if (highPercentLabel) {
				highPercentLabel.textContent = highPercent + '%';
			}
			if (mediumPercentLabel) {
				mediumPercentLabel.textContent = mediumPercent + '%';
			}
			if (lowPercentLabel) {
				lowPercentLabel.textContent = lowPercent + '%';
			}
		}

		function renderContextSessionHealth(data) {
			const icon = document.getElementById('ctxSessionHealthIcon');
			const badge = document.getElementById('ctxSessionHealthBadge');
			const progress = document.getElementById('ctxSessionHealthProgress');
			const percent = document.getElementById('ctxSessionHealthPercent');
			const tokensUsed = document.getElementById('ctxTokensUsed');
			const messageCount = document.getElementById('ctxMessageCount');
			const avgTokens = document.getElementById('ctxAvgTokens');
			const recommendation = document.getElementById('ctxSessionRecommendation');
			const recommendationText = document.getElementById('ctxRecommendationText');

			if (icon) {
				icon.textContent = data.status === 'healthy' ? '🟢' : data.status === 'warning' ? '🟡' : '🔴';
			}

			if (badge) {
				badge.textContent = data.status === 'healthy' ? 'Healthy' : data.status === 'warning' ? 'Warning' : 'Critical';
				badge.className = 'session-health-badge ' + data.status;
			}

			if (progress) {
				const percentage = Math.min(data.usagePercent, 100);
				progress.style.width = percentage + '%';
				progress.className = 'session-health-progress ' + data.status;
			}

			if (percent) {
				percent.textContent = data.usagePercent.toFixed(1) + '%';
			}

			if (tokensUsed) {
				tokensUsed.textContent = (data.sessionTokens || 0).toLocaleString();
			}

			if (messageCount) {
				messageCount.textContent = data.messageCount || 0;
			}

			if (avgTokens) {
				const avg = data.messageCount > 0 ? Math.round((data.sessionTokens || 0) / data.messageCount) : 0;
				avgTokens.textContent = avg.toLocaleString();
			}

			if (recommendation && recommendationText) {
				if (data.status !== 'healthy') {
					recommendation.style.display = 'flex';
					recommendationText.textContent = data.recommendation || 'Consider starting a new session to maintain performance.';
				} else {
					recommendation.style.display = 'none';
				}
			}
		}

		function renderContextActiveTaskCount(data) {
			const activeTasks = document.getElementById('ctxActiveTasks');
			if (activeTasks && data.tasks) {
				const activeCount = data.tasks.filter(t => t.status === 'active').length;
				activeTasks.textContent = activeCount;
			}
		}

		// Scratchpad Functions
		function addScratchpadItem() {
			const typeSelect = document.getElementById('scratchpadType');
			const contentInput = document.getElementById('scratchpadContent');

			if (!contentInput || !contentInput.value.trim()) return;

			const item = {
				id: Date.now().toString(),
				type: typeSelect ? typeSelect.value : 'note',
				content: contentInput.value.trim(),
				createdAt: new Date().toISOString()
			};

			scratchpadItems.unshift(item);
			contentInput.value = '';

			// Save to storage
			vscode.postMessage({ type: 'saveScratchpadItems', items: scratchpadItems });

			renderScratchpadList();
			updateScratchpadCount();
		}

		function removeScratchpadItem(itemId) {
			scratchpadItems = scratchpadItems.filter(item => item.id !== itemId);
			vscode.postMessage({ type: 'saveScratchpadItems', items: scratchpadItems });
			renderScratchpadList();
			updateScratchpadCount();
		}

		function updateScratchpadCount() {
			const count = document.getElementById('ctxScratchpadItems');
			if (count) {
				count.textContent = scratchpadItems.length;
			}
		}

		function renderScratchpadList() {
			const list = document.getElementById('scratchpadList');
			if (!list) return;

			if (scratchpadItems.length === 0) {
				list.innerHTML = \`
					<div class="scratchpad-empty">
						<span class="empty-icon">📝</span>
						<p>No scratchpad items</p>
						<span class="empty-hint">Add goals or notes to boost their priority in context</span>
					</div>
				\`;
				return;
			}

			const typeIcons = {
				'goal': '🎯',
				'todo': '📌',
				'note': '📝',
				'decision': '✅'
			};

			let html = '';
			for (const item of scratchpadItems) {
				html += \`
					<div class="scratchpad-item" data-id="\${item.id}">
						<span class="scratchpad-item-type">\${typeIcons[item.type] || '📝'}</span>
						<span class="scratchpad-item-content">\${escapeHtml(item.content)}</span>
						<div class="scratchpad-item-actions">
							<button class="scratchpad-item-btn delete" onclick="removeScratchpadItem('\${item.id}')" title="Remove">✕</button>
						</div>
					</div>
				\`;
			}
			list.innerHTML = html;
		}

		function loadScratchpadItems(data) {
			scratchpadItems = data.items || [];
			renderScratchpadList();
			updateScratchpadCount();
		}

		// Toggle Create Task Section
		function toggleCreateTask() {
			const section = document.getElementById('createTaskSection');
			if (section) {
				section.classList.toggle('collapsed');
			}
		}

		// Close Context Preview
		function closeContextPreview() {
			const section = document.getElementById('memoryContextSection');
			const entities = document.getElementById('memoryEntitiesSection');
			if (section) section.style.display = 'none';
			if (entities) entities.style.display = 'block';
		}

		// Advanced Engine Settings
		function updateAdvancedEngineSettings() {
			const useAdvanced = document.getElementById('useAdvancedEngine');
			if (useAdvanced) {
				vscode.postMessage({
					type: 'updateAdvancedEngineSettings',
					enabled: useAdvanced.checked
				});
			}
		}

		// Decay Settings
		function updateDecaySettings() {
			const halfLife = document.getElementById('decayHalfLife');
			if (halfLife) {
				vscode.postMessage({
					type: 'updateDecaySettings',
					halfLifeHours: parseInt(halfLife.value, 10) || 24
				});
			}
		}

		// MCP Server management functions
		function loadMCPServers() {
			vscode.postMessage({ type: 'loadMCPServers' });
		}

		function showAddServerForm() {
			document.getElementById('addServerBtn').style.display = 'none';
			document.getElementById('popularServers').style.display = 'none';
			document.getElementById('addServerForm').style.display = 'block';
		}

		function hideAddServerForm() {
			document.getElementById('addServerBtn').style.display = 'block';
			document.getElementById('popularServers').style.display = 'block';
			document.getElementById('addServerForm').style.display = 'none';
			
			// Reset editing state
			editingServerName = null;
			
			// Reset form title and button
			const formTitle = document.querySelector('#addServerForm h5');
			if (formTitle) formTitle.remove();
			
			const saveBtn = document.querySelector('#addServerForm .btn:not(.outlined)');
			if (saveBtn) saveBtn.textContent = 'Add Server';
			
			// Clear form
			document.getElementById('serverName').value = '';
			document.getElementById('serverName').disabled = false;
			document.getElementById('serverCommand').value = '';
			document.getElementById('serverUrl').value = '';
			document.getElementById('serverArgs').value = '';
			document.getElementById('serverEnv').value = '';
			document.getElementById('serverHeaders').value = '';
			document.getElementById('serverType').value = 'http';
			updateServerForm();
		}

		function updateServerForm() {
			const serverType = document.getElementById('serverType').value;
			const commandGroup = document.getElementById('commandGroup');
			const urlGroup = document.getElementById('urlGroup');
			const argsGroup = document.getElementById('argsGroup');
			const envGroup = document.getElementById('envGroup');
			const headersGroup = document.getElementById('headersGroup');

			if (serverType === 'stdio') {
				commandGroup.style.display = 'block';
				urlGroup.style.display = 'none';
				argsGroup.style.display = 'block';
				envGroup.style.display = 'block';
				headersGroup.style.display = 'none';
			} else if (serverType === 'http' || serverType === 'sse') {
				commandGroup.style.display = 'none';
				urlGroup.style.display = 'block';
				argsGroup.style.display = 'none';
				envGroup.style.display = 'none';
				headersGroup.style.display = 'block';
			}
		}

		function saveMCPServer() {
			sendStats('MCP server added');
			
			const name = document.getElementById('serverName').value.trim();
			const type = document.getElementById('serverType').value;
			
			if (!name) {
				// Use a simple notification instead of alert which is blocked
				const notification = document.createElement('div');
				notification.textContent = 'Server name is required';
				notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); padding: 8px 12px; border-radius: 4px; z-index: 9999;';
				document.body.appendChild(notification);
				setTimeout(() => notification.remove(), 3000);
				return;
			}

			// If editing, we can use the same name; if adding, check for duplicates
			if (!editingServerName) {
				const serversList = document.getElementById('mcpServersList');
				const existingServers = serversList.querySelectorAll('.server-name');
				for (let server of existingServers) {
					if (server.textContent === name) {
						const notification = document.createElement('div');
						notification.textContent = \`Server "\${name}" already exists\`;
						notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); padding: 8px 12px; border-radius: 4px; z-index: 9999;';
						document.body.appendChild(notification);
						setTimeout(() => notification.remove(), 3000);
						return;
					}
				}
			}

			const serverConfig = { type };

			if (type === 'stdio') {
				const command = document.getElementById('serverCommand').value.trim();
				if (!command) {
					const notification = document.createElement('div');
					notification.textContent = 'Command is required for stdio servers';
					notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); padding: 8px 12px; border-radius: 4px; z-index: 9999;';
					document.body.appendChild(notification);
					setTimeout(() => notification.remove(), 3000);
					return;
				}
				serverConfig.command = command;

				const argsText = document.getElementById('serverArgs').value.trim();
				if (argsText) {
					serverConfig.args = argsText.split('\\n').filter(line => line.trim());
				}

				const envText = document.getElementById('serverEnv').value.trim();
				if (envText) {
					serverConfig.env = {};
					envText.split('\\n').forEach(line => {
						const [key, ...valueParts] = line.split('=');
						if (key && valueParts.length > 0) {
							serverConfig.env[key.trim()] = valueParts.join('=').trim();
						}
					});
				}
			} else if (type === 'http' || type === 'sse') {
				const url = document.getElementById('serverUrl').value.trim();
				if (!url) {
					const notification = document.createElement('div');
					notification.textContent = 'URL is required for HTTP/SSE servers';
					notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); padding: 8px 12px; border-radius: 4px; z-index: 9999;';
					document.body.appendChild(notification);
					setTimeout(() => notification.remove(), 3000);
					return;
				}
				serverConfig.url = url;

				const headersText = document.getElementById('serverHeaders').value.trim();
				if (headersText) {
					serverConfig.headers = {};
					headersText.split('\\n').forEach(line => {
						const [key, ...valueParts] = line.split('=');
						if (key && valueParts.length > 0) {
							serverConfig.headers[key.trim()] = valueParts.join('=').trim();
						}
					});
				}
			}

			vscode.postMessage({ 
				type: 'saveMCPServer', 
				name: name,
				config: serverConfig 
			});
			
			hideAddServerForm();
		}

		function deleteMCPServer(serverName) {
			// Just delete without confirmation
			vscode.postMessage({ 
				type: 'deleteMCPServer', 
				name: serverName 
			});
		}

		let editingServerName = null;

		function editMCPServer(name, config) {
			editingServerName = name;
			
			// Hide add button and popular servers
			document.getElementById('addServerBtn').style.display = 'none';
			document.getElementById('popularServers').style.display = 'none';
			
			// Show form
			document.getElementById('addServerForm').style.display = 'block';
			
			// Update form title and button
			const formTitle = document.querySelector('#addServerForm h5') || 
				document.querySelector('#addServerForm').insertAdjacentHTML('afterbegin', '<h5>Edit MCP Server</h5>') ||
				document.querySelector('#addServerForm h5');
			if (!document.querySelector('#addServerForm h5')) {
				document.getElementById('addServerForm').insertAdjacentHTML('afterbegin', '<h5 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 600;">Edit MCP Server</h5>');
			} else {
				document.querySelector('#addServerForm h5').textContent = 'Edit MCP Server';
			}
			
			// Update save button text
			const saveBtn = document.querySelector('#addServerForm .btn:not(.outlined)');
			if (saveBtn) saveBtn.textContent = 'Update Server';
			
			// Populate form with existing values
			document.getElementById('serverName').value = name;
			document.getElementById('serverName').disabled = true; // Don't allow name changes when editing
			
			document.getElementById('serverType').value = config.type || 'stdio';
			
			if (config.command) {
				document.getElementById('serverCommand').value = config.command;
			}
			if (config.url) {
				document.getElementById('serverUrl').value = config.url;
			}
			if (config.args && Array.isArray(config.args)) {
				document.getElementById('serverArgs').value = config.args.join('\\n');
			}
			if (config.env) {
				const envLines = Object.entries(config.env).map(([key, value]) => \`\${key}=\${value}\`);
				document.getElementById('serverEnv').value = envLines.join('\\n');
			}
			if (config.headers) {
				const headerLines = Object.entries(config.headers).map(([key, value]) => \`\${key}=\${value}\`);
				document.getElementById('serverHeaders').value = headerLines.join('\\n');
			}
			
			// Update form field visibility
			updateServerForm();

			const toolsList = document.querySelector('.tools-list');
			if (toolsList) {
			  toolsList.scrollTop = toolsList.scrollHeight;
			}
		}

		function addPopularServer(name, config) {
			// Check if server already exists
			const serversList = document.getElementById('mcpServersList');
			const existingServers = serversList.querySelectorAll('.server-name');
			for (let server of existingServers) {
				if (server.textContent === name) {
					const notification = document.createElement('div');
					notification.textContent = \`Server "\${name}" already exists\`;
					notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); padding: 8px 12px; border-radius: 4px; z-index: 9999;';
					document.body.appendChild(notification);
					setTimeout(() => notification.remove(), 3000);
					return;
				}
			}
			
			sendStats('MCP server added');
			
			// Add the server
			vscode.postMessage({ 
				type: 'saveMCPServer', 
				name: name,
				config: config 
			});
		}

		function displayMCPServers(servers) {
			const serversList = document.getElementById('mcpServersList');
			serversList.innerHTML = '';

			if (Object.keys(servers).length === 0) {
				serversList.innerHTML = '<div class="no-servers">No MCP servers configured</div>';
				return;
			}

			for (const [name, config] of Object.entries(servers)) {				
				const serverItem = document.createElement('div');
				serverItem.className = 'mcp-server-item';
				
				// Defensive check for config structure
				if (!config || typeof config !== 'object') {
					console.error('Invalid config for server:', name, config);
					continue;
				}
				
				const serverType = config.type || 'stdio';
				let configDisplay = '';
				
				if (serverType === 'stdio') {
					configDisplay = \`Command: \${config.command || 'Not specified'}\`;
					if (config.args && Array.isArray(config.args)) {
						configDisplay += \`<br>Args: \${config.args.join(' ')}\`;
					}
				} else if (serverType === 'http' || serverType === 'sse') {
					configDisplay = \`URL: \${config.url || 'Not specified'}\`;
				} else {
					configDisplay = \`Type: \${serverType}\`;
				}

				serverItem.innerHTML = \`
					<div class="server-info">
						<div class="server-name">\${name}</div>
						<div class="server-type">\${serverType.toUpperCase()}</div>
						<div class="server-config">\${configDisplay}</div>
					</div>
					<div class="server-actions">
						<button class="btn outlined server-edit-btn" onclick="editMCPServer('\${name}', \${JSON.stringify(config).replace(/"/g, '&quot;')})">Edit</button>
						<button class="btn outlined server-delete-btn" onclick="deleteMCPServer('\${name}')">Delete</button>
					</div>
				\`;
				
				serversList.appendChild(serverItem);
			}
		}

		// Model selector functions
		let currentModel = 'opus'; // Default model

		function showModelSelector() {
			document.getElementById('modelModal').style.display = 'flex';
			// Select the current model radio button
			const radioButton = document.getElementById('model-' + currentModel);
			if (radioButton) {
				radioButton.checked = true;
			}
		}

		function hideModelModal() {
			document.getElementById('modelModal').style.display = 'none';
		}

		// Slash commands modal functions
		function showSlashCommandsModal() {
			document.getElementById('slashCommandsModal').style.display = 'flex';
			// Auto-focus the search input
			setTimeout(() => {
				document.getElementById('slashCommandsSearch').focus();
			}, 100);
		}

		function hideSlashCommandsModal() {
			document.getElementById('slashCommandsModal').style.display = 'none';
		}

		// Thinking intensity modal functions
		function showThinkingIntensityModal() {
			// Request current settings from VS Code first
			vscode.postMessage({
				type: 'getSettings'
			});
			document.getElementById('thinkingIntensityModal').style.display = 'flex';
		}

		function hideThinkingIntensityModal() {
			document.getElementById('thinkingIntensityModal').style.display = 'none';
		}

		function saveThinkingIntensity() {
			const thinkingSlider = document.getElementById('thinkingIntensitySlider');
			const intensityValues = ['think', 'think-hard', 'think-harder', 'ultrathink'];
			const thinkingIntensity = intensityValues[thinkingSlider.value] || 'think';
			
			// Send settings to VS Code
			vscode.postMessage({
				type: 'updateSettings',
				settings: {
					'thinking.intensity': thinkingIntensity
				}
			});
		}

		function updateThinkingModeToggleName(intensityValue) {
			const intensityNames = ['Thinking', 'Think Hard', 'Think Harder', 'Ultrathink'];
			const modeName = intensityNames[intensityValue] || 'Thinking';
			const toggleLabel = document.getElementById('thinkingModeLabel');
			if (toggleLabel) {
				toggleLabel.textContent = modeName + ' Mode';
			}
		}

		function updateThinkingIntensityDisplay(value) {
			// Update label highlighting for thinking intensity modal
			for (let i = 0; i < 4; i++) {
				const label = document.getElementById('thinking-label-' + i);
				if (i == value) {
					label.classList.add('active');
				} else {
					label.classList.remove('active');
				}
			}
			
			// Don't update toggle name until user confirms
		}

		function setThinkingIntensityValue(value) {
			// Set slider value for thinking intensity modal
			document.getElementById('thinkingIntensitySlider').value = value;
			
			// Update visual state
			updateThinkingIntensityDisplay(value);
		}

		function confirmThinkingIntensity() {
			// Get the current slider value
			const currentValue = document.getElementById('thinkingIntensitySlider').value;
			
			// Update the toggle name with confirmed selection
			updateThinkingModeToggleName(currentValue);
			
			// Save the current intensity setting
			saveThinkingIntensity();
			
			// Close the modal
			hideThinkingIntensityModal();
		}

		// WSL Alert functions
		function showWSLAlert() {
			const alert = document.getElementById('wslAlert');
			if (alert) {
				alert.style.display = 'block';
			}
		}

		function dismissWSLAlert() {
			const alert = document.getElementById('wslAlert');
			if (alert) {
				alert.style.display = 'none';
			}
			// Send dismiss message to extension to store in globalState
			vscode.postMessage({
				type: 'dismissWSLAlert'
			});
		}

		function openWSLSettings() {
			// Dismiss the alert
			dismissWSLAlert();
			
			// Open settings modal
			toggleSettings();
		}

		function executeSlashCommand(command) {
			// Hide the modal
			hideSlashCommandsModal();
			
			// Clear the input since user selected a command
			messageInput.value = '';
			
			// Send command to VS Code to execute in terminal
			vscode.postMessage({
				type: 'executeSlashCommand',
				command: command
			});
			
			// Show user feedback
			addMessage('user', \`Executing /\${command} command in terminal. Check the terminal output and return when ready.\`, 'assistant');
		}

		function handleCustomCommandKeydown(event) {
			if (event.key === 'Enter') {
				event.preventDefault();
				const customCommand = event.target.value.trim();
				if (customCommand) {
					executeSlashCommand(customCommand);
					// Clear the input for next use
					event.target.value = '';
				}
			}
		}

		// Store custom snippets data globally
		let customSnippetsData = {};

		function usePromptSnippet(snippetType) {
			const builtInSnippets = {
				'performance-analysis': 'Analyze this code for performance issues and suggest optimizations',
				'security-review': 'Review this code for security vulnerabilities',
				'implementation-review': 'Review the implementation in this code',
				'code-explanation': 'Explain how this code works in detail',
				'bug-fix': 'Help me fix this bug in my code',
				'refactor': 'Refactor this code to improve readability and maintainability',
				'test-generation': 'Generate comprehensive tests for this code',
				'documentation': 'Generate documentation for this code'
			};

			// Check built-in snippets first
			let promptText = builtInSnippets[snippetType];

			// If not found in built-in, check custom snippets
			if (!promptText && customSnippetsData[snippetType]) {
				promptText = customSnippetsData[snippetType].prompt;
			}

			if (promptText) {
				// Hide the modal
				hideSlashCommandsModal();

				// Insert the prompt into the message input
				messageInput.value = promptText;
				messageInput.focus();

				// Auto-resize the textarea
				autoResizeTextarea();
			}
		}

		// Insert context reference into message input (@ syntax for file references)
		function insertContextReference(reference) {
			// Hide the modal
			hideSlashCommandsModal();

			// Get current cursor position or end of text
			const currentText = messageInput.value;
			const cursorPos = messageInput.selectionStart || currentText.length;

			// Insert reference at cursor position with a space if needed
			const beforeText = currentText.substring(0, cursorPos);
			const afterText = currentText.substring(cursorPos);
			const needsSpaceBefore = beforeText.length > 0 && !beforeText.endsWith(' ') && !beforeText.endsWith('\\n');
			const needsSpaceAfter = afterText.length > 0 && !afterText.startsWith(' ') && !afterText.startsWith('\\n');

			const insertText = (needsSpaceBefore ? ' ' : '') + reference + (needsSpaceAfter ? ' ' : '');
			messageInput.value = beforeText + insertText + afterText;

			// Set cursor position after the inserted reference
			const newCursorPos = cursorPos + insertText.length;
			messageInput.setSelectionRange(newCursorPos, newCursorPos);

			// Focus and resize
			messageInput.focus();
			autoResizeTextarea();
		}

		function showAddSnippetForm() {
			document.getElementById('addSnippetForm').style.display = 'block';
			document.getElementById('snippetName').focus();
		}

		function hideAddSnippetForm() {
			document.getElementById('addSnippetForm').style.display = 'none';
			// Clear form fields
			document.getElementById('snippetName').value = '';
			document.getElementById('snippetPrompt').value = '';
		}

		function saveCustomSnippet() {
			const name = document.getElementById('snippetName').value.trim();
			const prompt = document.getElementById('snippetPrompt').value.trim();
			
			if (!name || !prompt) {
				alert('Please fill in both name and prompt text.');
				return;
			}
			
			// Generate a unique ID for the snippet
			const snippetId = 'custom-' + Date.now();
			
			// Save the snippet using VS Code global storage
			const snippetData = {
				name: name,
				prompt: prompt,
				id: snippetId
			};
			
			vscode.postMessage({
				type: 'saveCustomSnippet',
				snippet: snippetData
			});
			
			// Hide the form
			hideAddSnippetForm();
		}

		function loadCustomSnippets(snippetsData = {}) {
			const snippetsList = document.getElementById('promptSnippetsList');
			
			// Remove existing custom snippets
			const existingCustom = snippetsList.querySelectorAll('.custom-snippet-item');
			existingCustom.forEach(item => item.remove());
			
			// Add custom snippets after the add button and form
			const addForm = document.getElementById('addSnippetForm');
			
			Object.values(snippetsData).forEach(snippet => {
				const snippetElement = document.createElement('div');
				snippetElement.className = 'slash-command-item prompt-snippet-item custom-snippet-item';
				snippetElement.onclick = () => usePromptSnippet(snippet.id);
				
				snippetElement.innerHTML = \`
					<div class="slash-command-icon">📝</div>
					<div class="slash-command-content">
						<div class="slash-command-title">/\${snippet.name}</div>
						<div class="slash-command-description">\${snippet.prompt}</div>
					</div>
					<div class="snippet-actions">
						<button class="snippet-delete-btn" onclick="event.stopPropagation(); deleteCustomSnippet('\${snippet.id}')" title="Delete snippet">🗑️</button>
					</div>
				\`;
				
				// Insert after the form
				addForm.parentNode.insertBefore(snippetElement, addForm.nextSibling);
			});
		}

		function deleteCustomSnippet(snippetId) {
			vscode.postMessage({
				type: 'deleteCustomSnippet',
				snippetId: snippetId
			});
		}

		function filterSlashCommands() {
			const searchTerm = document.getElementById('slashCommandsSearch').value.toLowerCase();
			const allItems = document.querySelectorAll('.slash-command-item');
			
			allItems.forEach(item => {
				const title = item.querySelector('.slash-command-title').textContent.toLowerCase();
				const description = item.querySelector('.slash-command-description').textContent.toLowerCase();
				
				if (title.includes(searchTerm) || description.includes(searchTerm)) {
					item.style.display = 'flex';
				} else {
					item.style.display = 'none';
				}
			});
		}

		function openModelTerminal() {
			vscode.postMessage({
				type: 'openModelTerminal'
			});
			hideModelModal();
		}

		function selectModel(model, fromBackend = false) {
			currentModel = model;

			// Update the display text with model names
			const displayNames = {
				'opus': 'Opus 4.5',
				'sonnet': 'Sonnet 4.5',
				'haiku': 'Haiku 4.5',
				'default': 'Default'
			};
			document.getElementById('selectedModel').textContent = displayNames[model] || model;

			// Only send model selection to VS Code extension if not from backend
			if (!fromBackend) {
				vscode.postMessage({
					type: 'selectModel',
					model: model
				});

				// Save preference
				localStorage.setItem('selectedModel', model);
			}

			// Update radio button if modal is open
			const radioId = 'model-' + model;
			const radioButton = document.getElementById(radioId);
			if (radioButton) {
				radioButton.checked = true;
			}

			hideModelModal();
		}

		// Initialize model display - default to Sonnet 4.5 (recommended)
		currentModel = 'sonnet';
		const displayNames = {
			'opus': 'Opus 4.5',
			'sonnet': 'Sonnet 4.5',
			'haiku': 'Haiku 4.5',
			'default': 'Default'
		};
		document.getElementById('selectedModel').textContent = displayNames[currentModel];

		// Close model modal when clicking outside
		document.getElementById('modelModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('modelModal')) {
				hideModelModal();
			}
		});

		// Handle Send or Stop button click based on processing state
		function handleSendOrStop() {
			if (isProcessing) {
				stopRequest();
			} else {
				sendMessage();
			}
		}

		// Stop button functions - now transforms Send button into Stop button
		function showStopButton() {
			// Show the old stop button in status bar (keep for compatibility)
			document.getElementById('stopBtn').style.display = 'flex';

			// Transform Send button to Stop mode
			const sendBtn = document.getElementById('sendBtn');
			if (sendBtn) {
				const sendState = sendBtn.querySelector('.send-state');
				const stopState = sendBtn.querySelector('.stop-state');
				if (sendState) sendState.style.display = 'none';
				if (stopState) stopState.style.display = 'flex';
				sendBtn.classList.add('stop-mode');
			}

			// Add shimmer wave animation to drag bar
			const resizeHandle = document.getElementById('inputResizeHandle');
			if (resizeHandle) {
				resizeHandle.classList.add('processing');
			}
		}

		function hideStopButton() {
			// Don't hide if we're in AutoMode (planning or executing phase)
			// This prevents timing issues during Phase 2 auto-trigger
			if (autoModePhase === 'planning' || autoModePhase === 'executing') {
				return; // Skip hiding - AutoMode needs stop button visible
			}

			// Hide the old stop button in status bar
			document.getElementById('stopBtn').style.display = 'none';

			// Transform Stop button back to Send mode
			const sendBtn = document.getElementById('sendBtn');
			if (sendBtn) {
				const sendState = sendBtn.querySelector('.send-state');
				const stopState = sendBtn.querySelector('.stop-state');
				if (sendState) sendState.style.display = 'flex';
				if (stopState) stopState.style.display = 'none';
				sendBtn.classList.remove('stop-mode');
			}

			// Remove shimmer wave animation from drag bar
			const resizeHandle = document.getElementById('inputResizeHandle');
			if (resizeHandle) {
				resizeHandle.classList.remove('processing');
			}
		}

		// Force show stop button - used by AutoMode to guarantee UI state
		function forceShowStopButton() {
			document.getElementById('stopBtn').style.display = 'flex';

			const sendBtn = document.getElementById('sendBtn');
			if (sendBtn) {
				const sendState = sendBtn.querySelector('.send-state');
				const stopState = sendBtn.querySelector('.stop-state');
				if (sendState) sendState.style.display = 'none';
				if (stopState) stopState.style.display = 'flex';
				sendBtn.classList.add('stop-mode');
			}

			const resizeHandle = document.getElementById('inputResizeHandle');
			if (resizeHandle) {
				resizeHandle.classList.add('processing');
			}
		}

		function stopRequest() {
			sendStats('Stop request');

			vscode.postMessage({
				type: 'stopRequest'
			});
			hideStopButton();

			// Reset AutoMode state on manual stop
			autoModePhase = 'idle';
			autoModeOriginalMessage = '';
		}

		// Disable/enable buttons during processing
		function disableButtons() {
			const sendBtn = document.getElementById('sendBtn');
			// Don't disable in stop mode - user needs to click to stop
			if (sendBtn && !sendBtn.classList.contains('stop-mode')) {
				sendBtn.disabled = true;
			}
		}

		function enableButtons() {
			const sendBtn = document.getElementById('sendBtn');
			if (sendBtn) sendBtn.disabled = false;
		}

		// Copy message content function
		function copyMessageContent(messageDiv) {
			const contentDiv = messageDiv.querySelector('.message-content');
			if (contentDiv) {
				// Get text content, preserving line breaks
				const text = contentDiv.innerText || contentDiv.textContent;

				// Copy to clipboard
				navigator.clipboard.writeText(text).then(() => {
					// Show brief feedback
					const copyBtn = messageDiv.querySelector('.copy-btn');
					const originalHtml = copyBtn.innerHTML;
					copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
					copyBtn.style.color = '#4caf50';

					setTimeout(() => {
						copyBtn.innerHTML = originalHtml;
						copyBtn.style.color = '';
					}, 1000);
				}).catch(err => {
					console.error('Failed to copy message:', err);
				});
			}
		}

		// Scroll to prompt input - scrolls to show the message at the top with input visible at bottom
		function scrollToPromptInput(messageDiv) {
			const messagesContainer = document.getElementById('messages');
			const inputContainer = document.getElementById('inputContainer');

			if (messageDiv && messagesContainer && inputContainer) {
				// Scroll to position the message near the input
				messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

				// Visual feedback on the scroll button
				const scrollBtn = messageDiv.querySelector('.scroll-to-prompt-btn');
				if (scrollBtn) {
					scrollBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
					scrollBtn.style.color = '#4caf50';

					setTimeout(() => {
						scrollBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
						scrollBtn.style.color = '';
					}, 800);
				}

				// Focus input after scrolling
				setTimeout(() => {
					const messageInput = document.getElementById('messageInput');
					if (messageInput) {
						messageInput.focus();
					}
				}, 400);
			}
		}
		
		function copyCodeBlock(codeId) {
			const codeElement = document.getElementById(codeId);
			if (codeElement) {
				const rawCode = codeElement.getAttribute('data-raw-code');
				if (rawCode) {
					// Decode HTML entities
					const decodedCode = rawCode.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
					navigator.clipboard.writeText(decodedCode).then(() => {
						// Show temporary feedback
						const copyBtn = codeElement.closest('.code-block-container').querySelector('.code-copy-btn');
						if (copyBtn) {
							const originalInnerHTML = copyBtn.innerHTML;
							copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
							copyBtn.style.color = '#4caf50';
							setTimeout(() => {
								copyBtn.innerHTML = originalInnerHTML;
								copyBtn.style.color = '';
							}, 1000);
						}
					}).catch(err => {
						console.error('Failed to copy code:', err);
					});
				}
			}
		}

		// ===== Activity Panel Management =====
		let activeActivities = [];

		function updateActivityPanel(activities) {
			const panel = document.getElementById('activityPanel');
			const list = document.getElementById('activityList');
			const count = document.getElementById('activityCount');

			activeActivities = activities || [];

			if (activeActivities.length === 0) {
				panel.classList.remove('active');
				return;
			}

			panel.classList.add('active');
			count.textContent = activeActivities.length;

			list.innerHTML = activeActivities.map(activity => {
				const typeClass = activity.type || 'task';
				const statusIcon = activity.status === 'completed' ? '✓' : activity.status === 'running' ? '⟳' : '○';
				const treeItems = activity.children ? activity.children.map(child =>
					\`<div class="activity-tree-item">
						<span class="status-dot \${child.status === 'running' ? 'running' : ''}"></span>
						<span>\${child.name}</span>
						\${child.details ? \`<span style="color: var(--text-muted); font-size: 10px;">\${child.details}</span>\` : ''}
					</div>\`
				).join('') : '';

				return \`
					<div class="activity-item \${typeClass} \${activity.status === 'completed' ? 'completed' : ''}">
						<div class="activity-icon">\${statusIcon}</div>
						<div class="activity-content">
							<div class="activity-title">\${activity.name}</div>
							<div class="activity-details">
								\${activity.toolUses ? \`<span class="activity-detail">🔧 \${activity.toolUses} tools</span>\` : ''}
								\${activity.tokens ? \`<span class="activity-detail">📊 \${formatTokens(activity.tokens)}</span>\` : ''}
								\${activity.duration ? \`<span class="activity-detail">⏱ \${activity.duration}</span>\` : ''}
							</div>
							\${treeItems ? \`<div class="activity-tree">\${treeItems}</div>\` : ''}
						</div>
					</div>
				\`;
			}).join('');
		}

		function formatTokens(tokens) {
			if (tokens >= 1000) {
				return (tokens / 1000).toFixed(1) + 'k';
			}
			return tokens.toString();
		}

		function addActivity(activity) {
			activeActivities.push(activity);
			updateActivityPanel(activeActivities);
		}

		function removeActivity(activityId) {
			activeActivities = activeActivities.filter(a => a.id !== activityId);
			updateActivityPanel(activeActivities);
		}

		function clearActivities() {
			activeActivities = [];
			updateActivityPanel([]);
		}

		// ===== Todo Panel Management =====
		let todoItems = [];

		function updateTodoPanel(todos) {
			const panel = document.getElementById('todoPanel');
			const list = document.getElementById('todoList');
			const progress = document.getElementById('todoProgress');

			todoItems = todos || [];

			if (todoItems.length === 0) {
				panel.classList.remove('active');
				return;
			}

			panel.classList.add('active');

			const completed = todoItems.filter(t => t.status === 'completed').length;
			progress.textContent = \`\${completed}/\${todoItems.length}\`;

			list.innerHTML = todoItems.map(todo => {
				const statusClass = todo.status === 'completed' ? 'completed' :
					todo.status === 'in_progress' ? 'in-progress' : '';
				const checkmark = todo.status === 'completed' ? '✓' : '';

				return \`
					<div class="todo-item \${statusClass}">
						<div class="todo-checkbox">\${checkmark}</div>
						<span>\${todo.status === 'in_progress' ? todo.activeForm : todo.content}</span>
					</div>
				\`;
			}).join('');
		}

		window.addEventListener('message', event => {
			const message = event.data;

			switch (message.type) {
				case 'ready':
					addMessage(message.data, 'system');
					updateStatusWithTotals();
					break;
					
				case 'restoreInputText':
					const inputField = document.getElementById('messageInput');
					if (inputField && message.data) {
						inputField.value = message.data;
						// Auto-resize the textarea
						inputField.style.height = 'auto';
						inputField.style.height = Math.min(inputField.scrollHeight, 200) + 'px';
					}
					break;
					
				case 'output':
					if (message.data.trim()) {
						let displayData = message.data;
						
						// Check if this is a usage limit message with Unix timestamp
						const usageLimitMatch = displayData.match(/Claude AI usage limit reached\\|(\\d+)/);
						if (usageLimitMatch) {
							const timestamp = parseInt(usageLimitMatch[1]);
							const date = new Date(timestamp * 1000);
							const readableDate = date.toLocaleString(
								undefined,
								{
									weekday: 'short',
									month: 'short',
									day: 'numeric',
									hour: 'numeric',
									minute: '2-digit',
									second: '2-digit',
									hour12: true,
									timeZoneName: 'short',
									year: 'numeric'
								}
							);
							displayData = displayData.replace(usageLimitMatch[0], \`Claude AI usage limit reached: \${readableDate}\`);
						}
						
						addMessage(parseSimpleMarkdown(displayData), 'claude');
					}
					updateStatusWithTotals();
					break;
					
				case 'userInput':
					if (message.data.trim()) {
						addMessage(parseSimpleMarkdown(message.data), 'user');
					}
					break;
					
				case 'loading':
					addMessage(message.data, 'system');
					updateStatusWithTotals();
					break;
					
				case 'setProcessing':
					isProcessing = message.data.isProcessing;
					if (isProcessing) {
						startRequestTimer(message.data.requestStartTime);
						showStopButton();
						disableButtons();
					} else {
						stopRequestTimer();

						// AutoMode: Check FIRST before hiding stop button
						if (autoModePhase === 'planning') {
							// Phase 1 complete - trigger Phase 2
							// DON'T hide stop button - keep it visible for Phase 2
							autoModePhase = 'executing';
							triggerAutoModeExecution();
						} else if (autoModePhase === 'executing') {
							// Phase 2 complete - NOW hide everything
							hideStopButton();
							enableButtons();
							autoModePhase = 'idle';
							autoModeOriginalMessage = '';
						} else {
							// Normal (non-AutoMode) completion
							hideStopButton();
							enableButtons();
						}
					}
					updateStatusWithTotals();
					break;
					
				case 'clearLoading':
					// Remove the last loading message
					const messages = messagesDiv.children;
					if (messages.length > 0) {
						const lastMessage = messages[messages.length - 1];
						if (lastMessage.classList.contains('system')) {
							lastMessage.remove();
						}
					}
					updateStatusWithTotals();
					break;
					
				case 'error':
					// Clear AutoMode state on error
					autoModePhase = 'idle';
					autoModeOriginalMessage = '';

					if (message.data.trim()) {
						// Check if this is an install required error
						if (message.data.includes('Install claude code first') ||
							message.data.includes('command not found') ||
							message.data.includes('ENOENT')) {
							sendStats('Install required');
						}
						addMessage(message.data, 'error');
					}
					updateStatusWithTotals();
					break;
					
				case 'toolUse':
					if (typeof message.data === 'object') {
						addToolUseMessage(message.data);
					} else if (message.data.trim()) {
						addMessage(message.data, 'tool');
					}
					break;
					
				case 'toolResult':
							addToolResultMessage(message.data);
					break;
					
				case 'thinking':
					if (message.data.trim()) {
						addMessage('💭 Thinking...' + parseSimpleMarkdown(message.data), 'thinking');
					}
					break;
					
				case 'sessionInfo':
					if (message.data.sessionId) {
						showSessionInfo(message.data.sessionId);
						// Show detailed session information
						const sessionDetails = [
							\`🆔 Session ID: \${message.data.sessionId}\`,
							\`🔧 Tools Available: \${message.data.tools.length}\`,
							\`🖥️ MCP Servers: \${message.data.mcpServers ? message.data.mcpServers.length : 0}\`
						];
						//addMessage(sessionDetails.join('\\n'), 'system');
					}
					break;
					
				case 'imagePath':
					// Handle image file path response
					if (message.data.filePath) {
						// Get current cursor position and content
						const cursorPosition = messageInput.selectionStart || messageInput.value.length;
						const currentValue = messageInput.value || '';
						
						// Insert the file path at the current cursor position
						const textBefore = currentValue.substring(0, cursorPosition);
						const textAfter = currentValue.substring(cursorPosition);
						
						// Add a space before the path if there's text before and it doesn't end with whitespace
						const separator = (textBefore && !textBefore.endsWith(' ') && !textBefore.endsWith('\\n')) ? ' ' : '';
						
						messageInput.value = textBefore + separator + message.data.filePath + textAfter;
						
						// Move cursor to end of inserted path
						const newCursorPosition = cursorPosition + separator.length + message.data.filePath.length;
						messageInput.setSelectionRange(newCursorPosition, newCursorPosition);
						
						// Focus back on textarea and adjust height
						messageInput.focus();
						adjustTextareaHeight();
						
						console.log('Inserted image path:', message.data.filePath);
						console.log('Full textarea value:', messageInput.value);
					}
					break;
					
				case 'updateTokens':
					// Update token totals in real-time
					totalTokensInput = message.data.totalTokensInput || 0;
					totalTokensOutput = message.data.totalTokensOutput || 0;
					
					// Update status bar immediately
					updateStatusWithTotals();
					
					// Show detailed token breakdown for current message
					const currentTotal = (message.data.currentInputTokens || 0) + (message.data.currentOutputTokens || 0);
					if (currentTotal > 0) {
						let tokenBreakdown = \`📊 Tokens: \${currentTotal.toLocaleString()}\`;
						
						if (message.data.cacheCreationTokens || message.data.cacheReadTokens) {
							const cacheInfo = [];
							if (message.data.cacheCreationTokens) cacheInfo.push(\`\${message.data.cacheCreationTokens.toLocaleString()} cache created\`);
							if (message.data.cacheReadTokens) cacheInfo.push(\`\${message.data.cacheReadTokens.toLocaleString()} cache read\`);
							tokenBreakdown += \` • \${cacheInfo.join(' • ')}\`;
						}
						
						addMessage(tokenBreakdown, 'system');
					}
					break;
					
				case 'updateTotals':
					// Update local tracking variables
					totalCost = message.data.totalCost || 0;
					totalTokensInput = message.data.totalTokensInput || 0;
					totalTokensOutput = message.data.totalTokensOutput || 0;
					requestCount = message.data.requestCount || 0;
					
					// Update status bar with new totals
					updateStatusWithTotals();
					
					// Show current request info if available
					if (message.data.currentCost || message.data.currentDuration) {
						const currentCostStr = message.data.currentCost ? \`$\${message.data.currentCost.toFixed(4)}\` : 'N/A';
						const currentDurationStr = message.data.currentDuration ? \`\${message.data.currentDuration}ms\` : 'N/A';
						addMessage(\`Request completed - Cost: \${currentCostStr}, Duration: \${currentDurationStr}\`, 'system');
					}
					break;
					
				case 'sessionResumed':
					console.log('Session resumed:', message.data);
					showSessionInfo(message.data.sessionId);
					addMessage(\`📝 Resumed previous session\\n🆔 Session ID: \${message.data.sessionId}\\n💡 Your conversation history is preserved\`, 'system');
					break;
					
				case 'sessionCleared':
					console.log('Session cleared');
					// Clear all messages from UI
					messagesDiv.innerHTML = '';
					hideSessionInfo();
					addMessage('🆕 Started new session', 'system');
					// Reset totals
					totalCost = 0;
					totalTokensInput = 0;
					totalTokensOutput = 0;
					requestCount = 0;
					updateStatusWithTotals();
					break;
					
				case 'loginRequired':
					sendStats('Login required');
					addMessage('🔐 Login Required\\n\\nYour Claude API key is invalid or expired.\\nA terminal has been opened - please run the login process there.\\n\\nAfter logging in, come back to this chat to continue.', 'error');
					updateStatus('Login Required', 'error');
					break;
					
				case 'showRestoreOption':
					showRestoreContainer(message.data);
					break;
					
				case 'restoreProgress':
					addMessage('🔄 ' + message.data, 'system');
					break;
					
				case 'restoreSuccess':
					//hideRestoreContainer(message.data.commitSha);
					addMessage('✅ ' + message.data.message, 'system');
					break;

				case 'updateActivities':
					// Update the activity panel with running tasks/agents
					updateActivityPanel(message.data.activities || []);
					break;

				case 'updateTodos':
					// Update the todo panel with current task progress
					updateTodoPanel(message.data.todos || []);
					break;

				case 'addActivity':
					// Add a single activity to the panel
					addActivity(message.data);
					break;

				case 'removeActivity':
					// Remove a completed activity
					removeActivity(message.data.id);
					break;

				case 'clearActivities':
					// Clear all activities (e.g., when session ends)
					clearActivities();
					break;
					
				case 'restoreError':
					addMessage('❌ ' + message.data, 'error');
					break;

				case 'restorePreview':
					// Enhanced: Show preview modal for checkpoint restore
					showCheckpointPreviewModal(message.data);
					break;

				case 'restorePreviewError':
					addMessage('❌ Preview failed: ' + message.data, 'error');
					break;

				case 'checkpointsList':
					// Handle checkpoints list if needed for UI
					console.log('Checkpoints list received:', message.data);
					break;

				case 'checkpointStats':
					// Handle checkpoint stats display
					console.log('Checkpoint stats:', message.data);
					break;

				case 'checkpointsCleared':
					addMessage('🗑️ All checkpoints have been cleared', 'system');
					restoreBackupAvailable = false;
					restoreBackupInfo = null;
					updateRestoreFromBackupButton();
					dismissRestoreFromBackupNotification();
					break;

				case 'restoreBackupStatus':
					// Update restore backup availability
					restoreBackupAvailable = message.data.available;
					restoreBackupInfo = message.data.backup;
					updateRestoreFromBackupButton();
					if (restoreBackupAvailable && restoreBackupInfo) {
						showRestoreFromBackupNotification();
					} else {
						dismissRestoreFromBackupNotification();
					}
					break;

				case 'restoreFromBackupResult':
					if (message.data.success) {
						addMessage('✅ ' + message.data.message, 'system');
						addMessage('↩️ Your code has been restored from backup.', 'system');
					} else {
						addMessage('❌ ' + message.data.message, 'error');
					}
					break;

				// Context Window Management
				case 'contextStats':
					updateContextUsageUI(message.data);
					break;

				case 'contextCompacted':
					hideContextCompactNotification();
					const ratio = message.data.compressionRatio ? message.data.compressionRatio.toFixed(1) : '1.0';
					showContextCompactNotification(
						'Context compacted successfully',
						\`\${message.data.messagesCompressed || 0} messages summarized • \${ratio}x compression\`
					);
					// Update UI with new stats
					if (message.data.stats) {
						updateContextUsageUI(message.data.stats);
					}
					break;

				case 'contextCompactError':
					hideContextCompactNotification();
					addMessage('⚠️ Context compaction failed: ' + message.data, 'error');
					break;

				case 'contextAutoCompacting':
					showContextCompactNotification('Auto-compacting context...', 'Context usage exceeded 95%');
					break;

				// Project Context Management
				case 'projectContextBackupSuccess':
					showBackupSuccess(message.data);
					break;

				case 'projectContextBackupError':
					showBackupError(message.data);
					break;

				case 'projectContextRestorePrompt':
					showContextRestorePrompt(message.data);
					break;

				case 'projectContextRestored':
					showContextRestored(message.data);
					break;

				case 'projectSnapshotsList':
					// Handle displaying the snapshots list (for view all backups)
					displayProjectSnapshots(message.data);
					break;

				// Edit Prompt Restore
				case 'editRestoreComplete':
					handleEditRestoreComplete(message.data);
					break;

				case 'workspaceFiles':
					filteredFiles = message.data;
					selectedFileIndex = -1;
					renderFileList();
					break;
					
				case 'imagePath':
					// Add the image path to the textarea
					const currentText = messageInput.value;
					const pathIndicator = \`@\${message.path} \`;
					messageInput.value = currentText + pathIndicator;
					messageInput.focus();
					adjustTextareaHeight();
					break;
					
				case 'conversationList':
					displayConversationList(message.data);
					break;
				case 'clipboardText':
					handleClipboardText(message.data);
					break;
				case 'modelSelected':
					// Update the UI with the current model
					currentModel = message.model;
					selectModel(message.model, true);
					break;
				case 'terminalOpened':
					// Display notification about checking the terminal
					addMessage(message.data, 'system');
					break;
				case 'permissionRequest':
					addPermissionRequestMessage(message.data);
					break;
				case 'mcpServers':
					displayMCPServers(message.data);
					break;
				case 'mcpServerSaved':
					loadMCPServers(); // Reload the servers list
					addMessage('✅ MCP server "' + message.data.name + '" saved successfully', 'system');
					break;
				case 'mcpServerDeleted':
					loadMCPServers(); // Reload the servers list
					addMessage('✅ MCP server "' + message.data.name + '" deleted successfully', 'system');
					break;
				case 'mcpServerError':
					addMessage('❌ Error with MCP server: ' + message.data.error, 'error');
					break;

				// Documentation Manager messages
				case 'docsList':
					renderDocsList(message.data.docs);
					updateDocsStats(message.data.stats);
					break;
				case 'docAdded':
					loadDocs(); // Reload the docs list
					addMessage('📚 Starting to index "' + message.data.name + '"...', 'system');
					break;
				case 'docProgress':
					updateDocProgress(message.data.docId, message.data.current, message.data.total, message.data.status);
					break;
				case 'docIndexed':
					loadDocs(); // Reload the docs list
					addMessage('✅ Documentation "' + message.data.name + '" indexed successfully (' + message.data.pageCount + ' pages)', 'system');
					break;
				case 'docDeleted':
					loadDocs(); // Reload the docs list
					addMessage('🗑️ Documentation "' + message.data.name + '" deleted', 'system');
					break;
				case 'docError':
					loadDocs(); // Reload to show error state
					addMessage('❌ Error indexing documentation: ' + message.data.error, 'error');
					break;

				// Memory Management responses
				case 'memoryStats':
					renderMemoryStats(message.data);
					renderContextOverviewStats(message.data);
					break;
				case 'memorySearchResults':
					renderMemorySearchResults(message.data);
					break;
				case 'memoryContext':
					renderMemoryContext(message.data);
					break;
				case 'memorySettings':
					renderMemorySettings(message.data);
					break;
				case 'memorySettingsUpdated':
					if (message.data.success) {
						// Show brief feedback
						const settingsSection = document.querySelector('.memory-settings-section h4');
						if (settingsSection) {
							const originalText = settingsSection.textContent;
							settingsSection.textContent = '⚙️ Settings Saved ✓';
							setTimeout(() => {
								settingsSection.textContent = originalText;
							}, 1500);
						}
					}
					break;
				case 'memoryCleared':
					if (message.data.success) {
						addMessage('🧠 Project memory cleared successfully', 'system');
						loadMemoryStats();
					} else {
						addMessage('❌ Failed to clear memory: ' + (message.data.error || 'Unknown error'), 'error');
					}
					break;
				case 'memoryExported':
					if (message.data.success) {
						if (message.data.cancelled) {
							// User cancelled the save dialog
							addMessage('📊 Memory stats: ' + message.data.entities + ' entities, ' + message.data.relations + ' relations (export cancelled)', 'system');
						} else if (message.data.filePath) {
							addMessage('📤 Memory exported to file: ' + message.data.entities + ' entities, ' + message.data.relations + ' relations saved', 'system');
						} else {
							addMessage('📤 Memory exported: ' + message.data.entities + ' entities, ' + message.data.relations + ' relations', 'system');
						}
					} else {
						addMessage('❌ Failed to export memory: ' + (message.data.error || 'Unknown error'), 'error');
					}
					break;
				case 'memoryError':
					addMessage('❌ Memory error: ' + message.data.error, 'error');
					break;
				case 'memoryInjected':
					// Show a subtle indicator that memory was used
					showMemoryIndicator(message.data);
					break;
				case 'memorySystemsReady':
					// Memory systems just finished initializing - reload data
					console.log('Memory systems ready, reloading data...');
					loadMemoryStats();
					refreshTaskList();
					break;

				// Task Manager responses
				case 'allTasks':
					renderTaskList(message.data);
					renderContextActiveTaskCount(message.data);
					break;
				case 'taskDetails':
					renderTaskDetails(message.data);
					break;
				case 'taskUpdated':
					if (message.data.success) {
						refreshTaskList();
						if (currentViewingTaskId === message.data.taskId) {
							viewTaskDetails(message.data.taskId);
						}
					}
					break;
				case 'taskCreated':
					if (message.data.success) {
						refreshTaskList();
						addMessage('✅ Task created successfully', 'system');
					} else {
						addMessage('❌ Failed to create task', 'error');
					}
					break;
				case 'observationAdded':
					if (message.data.success && currentViewingTaskId) {
						viewTaskDetails(currentViewingTaskId);
					}
					break;
				case 'taskError':
					addMessage('❌ Task error: ' + message.data.error, 'error');
					break;

				// Session Health responses
				case 'sessionHealth':
					renderSessionHealth(message.data);
					renderContextSessionHealth(message.data);
					break;
				case 'sessionHealthWarning':
					// Show warning when session is getting too long
					if (message.data.status === 'critical') {
						addMessage('⚠️ Session context is nearly full (' + message.data.usagePercent.toFixed(0) + '%). ' + message.data.recommendation, 'system');
					}
					break;
				case 'sessionForceCleared':
					addMessage('🔄 Started new session: ' + message.data.reason, 'system');
					break;

				// Context Manager responses
				case 'activityLog':
					renderActivityLog(message.data);
					break;
				case 'scratchpadItems':
					loadScratchpadItems(message.data);
					break;
			}
		});

		// Show memory injection indicator
		function showMemoryIndicator(data) {
			// Update the memory button to show it's active
			const memoryBtn = document.querySelector('.memory-btn');
			if (memoryBtn) {
				memoryBtn.classList.add('memory-active');
				memoryBtn.title = \`Project Memory Active: \${data.entities} entities, \${data.observations} observations (\${Math.round(data.contextSize/1000)}KB)\`;

				// Remove the active class after 3 seconds
				setTimeout(() => {
					memoryBtn.classList.remove('memory-active');
					memoryBtn.title = 'Project Memory';
				}, 3000);
			}
		}

		// Permission request functions
		function addPermissionRequestMessage(data) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			const messageDiv = document.createElement('div');
			messageDiv.className = 'message permission-request';
			
			const toolName = data.tool || 'Unknown Tool';
			
			// Create always allow button text with command styling for Bash
			let alwaysAllowText = \`Always allow \${toolName}\`;
			let alwaysAllowTooltip = '';
			if (toolName === 'Bash' && data.pattern) {
				const pattern = data.pattern;
				// Remove the asterisk for display - show "npm i" instead of "npm i *"
				const displayPattern = pattern.replace(' *', '');
				const truncatedPattern = displayPattern.length > 30 ? displayPattern.substring(0, 30) + '...' : displayPattern;
				alwaysAllowText = \`Always allow <code>\${truncatedPattern}</code>\`;
				alwaysAllowTooltip = displayPattern.length > 30 ? \`title="\${displayPattern}"\` : '';
			}
			
			messageDiv.innerHTML = \`
				<div class="permission-header">
					<span class="icon">🔐</span>
					<span>Permission Required</span>
					<div class="permission-menu">
						<button class="permission-menu-btn" onclick="togglePermissionMenu('\${data.id}')" title="More options">⋮</button>
						<div class="permission-menu-dropdown" id="permissionMenu-\${data.id}" style="display: none;">
							<button class="permission-menu-item" onclick="enableYoloMode('\${data.id}')">
								<span class="menu-icon">⚡</span>
								<div class="menu-content">
									<span class="menu-title">Enable YOLO Mode</span>
									<span class="menu-subtitle">Auto-allow all permissions</span>
								</div>
							</button>
						</div>
					</div>
				</div>
				<div class="permission-content">
					<p>Allow <strong>\${toolName}</strong> to execute the tool call above?</p>
					<div class="permission-buttons">
						<button class="btn deny" onclick="respondToPermission('\${data.id}', false)">Deny</button>
						<button class="btn always-allow" onclick="respondToPermission('\${data.id}', true, true)" \${alwaysAllowTooltip}>\${alwaysAllowText}</button>
						<button class="btn allow" onclick="respondToPermission('\${data.id}', true)">Allow</button>
					</div>
				</div>
			\`;
			
			messagesDiv.appendChild(messageDiv);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}
		
		function respondToPermission(id, approved, alwaysAllow = false) {
			// Send response back to extension
			vscode.postMessage({
				type: 'permissionResponse',
				id: id,
				approved: approved,
				alwaysAllow: alwaysAllow
			});
			
			// Update the UI to show the decision
			const permissionMsg = document.querySelector(\`.permission-request:has([onclick*="\${id}"])\`);
			if (permissionMsg) {
				const buttons = permissionMsg.querySelector('.permission-buttons');
				const permissionContent = permissionMsg.querySelector('.permission-content');
				let decision = approved ? 'You allowed this' : 'You denied this';
				
				if (alwaysAllow && approved) {
					decision = 'You allowed this and set it to always allow';
				}
				
				const emoji = approved ? '✅' : '❌';
				const decisionClass = approved ? 'allowed' : 'denied';
				
				// Hide buttons
				buttons.style.display = 'none';
				
				// Add decision div to permission-content
				const decisionDiv = document.createElement('div');
				decisionDiv.className = \`permission-decision \${decisionClass}\`;
				decisionDiv.innerHTML = \`\${emoji} \${decision}\`;
				permissionContent.appendChild(decisionDiv);
				
				permissionMsg.classList.add('permission-decided', decisionClass);
			}
		}

		function togglePermissionMenu(permissionId) {
			const menu = document.getElementById(\`permissionMenu-\${permissionId}\`);
			const isVisible = menu.style.display !== 'none';
			
			// Close all other permission menus
			document.querySelectorAll('.permission-menu-dropdown').forEach(dropdown => {
				dropdown.style.display = 'none';
			});
			
			// Toggle this menu
			menu.style.display = isVisible ? 'none' : 'block';
		}

		function enableYoloMode(permissionId) {
			sendStats('YOLO mode enabled');
			
			// Hide the menu
			document.getElementById(\`permissionMenu-\${permissionId}\`).style.display = 'none';
			
			// Send message to enable YOLO mode
			vscode.postMessage({
				type: 'enableYoloMode'
			});
			
			// Auto-approve this permission
			respondToPermission(permissionId, true);
			
			// Show notification
			addMessage('⚡ YOLO Mode enabled! All future permissions will be automatically allowed.', 'system');
		}

		// Close permission menus when clicking outside
		document.addEventListener('click', function(event) {
			if (!event.target.closest('.permission-menu')) {
				document.querySelectorAll('.permission-menu-dropdown').forEach(dropdown => {
					dropdown.style.display = 'none';
				});
			}
		});

		// Input container resize functionality
		(function initInputResize() {
			const resizeHandle = document.getElementById('inputResizeHandle');
			const inputContainer = document.getElementById('inputContainer');
			const messageInput = document.getElementById('messageInput');

			if (!resizeHandle || !inputContainer || !messageInput) return;

			let isResizing = false;
			let startY = 0;
			let startHeight = 0;
			const minHeight = 68;
			const maxHeight = 400;

			// Load saved height from localStorage
			const savedHeight = localStorage.getItem('inputContainerHeight');
			if (savedHeight) {
				const height = parseInt(savedHeight, 10);
				if (height >= minHeight && height <= maxHeight) {
					messageInput.style.minHeight = height + 'px';
					messageInput.style.height = height + 'px';
				}
			}

			resizeHandle.addEventListener('mousedown', function(e) {
				isResizing = true;
				startY = e.clientY;
				startHeight = messageInput.offsetHeight;
				resizeHandle.classList.add('dragging');
				document.body.style.cursor = 'ns-resize';
				document.body.style.userSelect = 'none';
				e.preventDefault();
			});

			document.addEventListener('mousemove', function(e) {
				if (!isResizing) return;

				const deltaY = startY - e.clientY;
				let newHeight = startHeight + deltaY;

				// Clamp height between min and max
				newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

				messageInput.style.minHeight = newHeight + 'px';
				messageInput.style.height = newHeight + 'px';
			});

			document.addEventListener('mouseup', function() {
				if (isResizing) {
					isResizing = false;
					resizeHandle.classList.remove('dragging');
					document.body.style.cursor = '';
					document.body.style.userSelect = '';

					// Save height to localStorage
					const currentHeight = messageInput.offsetHeight;
					localStorage.setItem('inputContainerHeight', currentHeight.toString());
				}
			});
		})();

		// Session management functions
		function newSession() {
			console.log('newSession function called');
			sendStats('New chat');

			vscode.postMessage({
				type: 'newSession'
			});
		}

		// Attach event listener for New Chat button
		document.addEventListener('DOMContentLoaded', function() {
			const newSessionBtn = document.getElementById('newSessionBtn');
			if (newSessionBtn) {
				newSessionBtn.addEventListener('click', function(e) {
					e.preventDefault();
					console.log('New Session button clicked via addEventListener');
					newSession();
				});
			}
		});

		// Also attach immediately in case DOMContentLoaded already fired
		(function attachNewSessionHandler() {
			const newSessionBtn = document.getElementById('newSessionBtn');
			if (newSessionBtn) {
				newSessionBtn.onclick = function(e) {
					e.preventDefault();
					console.log('New Session button clicked via onclick');
					newSession();
				};
			}
		})();

		// Enhanced Checkpoint Variables
		let currentRestorePreview = null;

		function restoreToCommit(commitSha) {
			console.log('Restore button clicked for commit:', commitSha);
			vscode.postMessage({
				type: 'restoreCommit',
				commitSha: commitSha
			});
		}

		// Enhanced: Preview restore before executing
		function previewRestore(checkpointId) {
			console.log('Preview restore for checkpoint:', checkpointId);
			vscode.postMessage({
				type: 'previewRestore',
				checkpointId: checkpointId
			});
		}

		// Enhanced: Confirm restore with options
		function confirmRestore(checkpointId, createBackup = false) {
			console.log('Confirm restore for checkpoint:', checkpointId, 'createBackup:', createBackup);
			hideCheckpointPreviewModal();
			vscode.postMessage({
				type: 'confirmRestore',
				checkpointId: checkpointId,
				options: {
					createBackupBeforeRestore: createBackup
				}
			});
		}

		function showRestoreContainer(data) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			const restoreContainer = document.createElement('div');
			const isEnhanced = data.enhanced === true;
			restoreContainer.className = isEnhanced ? 'restore-container enhanced' : 'restore-container';
			restoreContainer.id = \`restore-\${data.sha}\`;

			const timeAgo = new Date(data.timestamp).toLocaleTimeString();
			const shortSha = data.sha ? data.sha.substring(0, 8) : 'unknown';

			// Enhanced checkpoint display with file count
			if (isEnhanced && data.fileCount !== undefined) {
				const fileCountText = data.changedFiles && data.changedFiles.length > 0
					? \`\${data.changedFiles.length} files tracked\`
					: 'No file changes';

				restoreContainer.innerHTML = \`
					<button class="restore-btn dark" onclick="previewRestore('\${data.id || data.sha}')">
						<span class="restore-btn-icon">⏪</span>
						Restore checkpoint
					</button>
					<div class="restore-info">
						<span class="restore-date">\${timeAgo}</span>
						<span class="restore-file-count">\${fileCountText}</span>
					</div>
					<button class="restore-preview-btn" onclick="previewRestore('\${data.id || data.sha}')" title="Preview changes">
						👁️ Preview
					</button>
				\`;
			} else {
				// Legacy checkpoint display
				restoreContainer.innerHTML = \`
					<button class="restore-btn dark" onclick="restoreToCommit('\${data.sha}')">
						Restore checkpoint
					</button>
					<span class="restore-date">\${timeAgo}</span>
				\`;
			}

			messagesDiv.appendChild(restoreContainer);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}

		// Enhanced: Show checkpoint preview modal
		function showCheckpointPreviewModal(data) {
			currentRestorePreview = data;

			// Create modal if it doesn't exist
			let modal = document.getElementById('checkpointPreviewModal');
			if (!modal) {
				modal = document.createElement('div');
				modal.id = 'checkpointPreviewModal';
				modal.className = 'checkpoint-preview-modal';
				document.body.appendChild(modal);
			}

			const checkpoint = data.checkpoint || {};
			const filesToRestore = data.filesToRestore || [];
			const filesToDelete = data.filesToDelete || [];
			const currentChanges = data.currentChanges || [];
			const totalChanges = data.totalChanges || 0;
			const isLegacy = data.legacyMode === true;

			// Count changes by type
			const addedCount = currentChanges.filter(c => c.type === 'added').length;
			const modifiedCount = currentChanges.filter(c => c.type === 'modified').length;
			const deletedCount = currentChanges.filter(c => c.type === 'deleted').length;

			// Build file list HTML
			let filesListHtml = '';
			if (currentChanges.length > 0) {
				filesListHtml = currentChanges.slice(0, 50).map(change => {
					const statusClass = change.type;
					const statusLabel = change.type.charAt(0).toUpperCase() + change.type.slice(1);
					return \`
						<div class="checkpoint-file-item \${statusClass}">
							<span class="checkpoint-file-status \${statusClass}">\${statusLabel}</span>
							<span class="checkpoint-file-path">\${change.path}</span>
						</div>
					\`;
				}).join('');

				if (currentChanges.length > 50) {
					filesListHtml += \`<div class="checkpoint-file-item">... and \${currentChanges.length - 50} more files</div>\`;
				}
			} else if (isLegacy) {
				filesListHtml = '<div class="checkpoint-file-item">Preview not available in legacy mode</div>';
			} else {
				filesListHtml = '<div class="checkpoint-file-item">No changes to revert</div>';
			}

			modal.innerHTML = \`
				<div class="checkpoint-preview-content">
					<div class="checkpoint-preview-header">
						<h3>Restore Checkpoint</h3>
						<button class="tools-close-btn" onclick="hideCheckpointPreviewModal()">✕</button>
					</div>
					<div class="checkpoint-preview-body">
						<div class="checkpoint-message-label">Checkpoint Message</div>
						<div class="checkpoint-message">\${checkpoint.message || 'No message'}</div>

						<div class="checkpoint-changes-summary">
							<div class="checkpoint-change-stat restore">
								<div class="checkpoint-stat-number">\${filesToRestore.length}</div>
								<div class="checkpoint-stat-label">Files to Restore</div>
							</div>
							<div class="checkpoint-change-stat delete">
								<div class="checkpoint-stat-number">\${filesToDelete.length}</div>
								<div class="checkpoint-stat-label">Files to Remove</div>
							</div>
							<div class="checkpoint-change-stat modify">
								<div class="checkpoint-stat-number">\${totalChanges}</div>
								<div class="checkpoint-stat-label">Total Changes</div>
							</div>
						</div>

						\${totalChanges > 0 ? \`
						<div class="checkpoint-files-list">
							<div class="checkpoint-files-header">
								📁 Files that will be affected
							</div>
							\${filesListHtml}
						</div>
						\` : ''}

						<div class="checkpoint-warning">
							<span class="checkpoint-warning-icon">⚠️</span>
							<span class="checkpoint-warning-text">
								This will revert all changes made after this checkpoint.
								\${isLegacy ? 'This is a legacy checkpoint - detailed preview is not available.' : 'Your current work will be backed up automatically.'}
							</span>
						</div>
					</div>
					<div class="checkpoint-preview-actions">
						<button class="checkpoint-btn cancel" onclick="hideCheckpointPreviewModal()">Cancel</button>
						<button class="checkpoint-btn restore-backup" onclick="confirmRestore('\${checkpoint.id || checkpoint.sha}', true)">
							💾 Restore (Keep Backup)
						</button>
						<button class="checkpoint-btn restore" onclick="confirmRestore('\${checkpoint.id || checkpoint.sha}', false)">
							⏪ Restore Now
						</button>
					</div>
				</div>
			\`;

			modal.style.display = 'flex';
		}

		function hideCheckpointPreviewModal() {
			const modal = document.getElementById('checkpointPreviewModal');
			if (modal) {
				modal.style.display = 'none';
			}
			currentRestorePreview = null;
		}

		// Restore From Backup - undo a restore operation
		function restoreFromBackup() {
			if (!restoreBackupAvailable) {
				addMessage('No restore backup available. Use "Restore (Keep Backup)" first to create a backup.', 'error');
				return;
			}

			console.log('Restoring from backup...');
			vscode.postMessage({
				type: 'restoreFromBackup'
			});
		}

		// Check if restore backup is available
		function checkRestoreBackupAvailable() {
			vscode.postMessage({
				type: 'checkRestoreBackupAvailable'
			});
		}

		// Update the restore from backup button visibility
		function updateRestoreFromBackupButton() {
			const btn = document.getElementById('restoreFromBackupBtn');
			if (btn) {
				if (restoreBackupAvailable && restoreBackupInfo) {
					btn.style.display = 'inline-flex';
					btn.title = 'Restore to: ' + (restoreBackupInfo.message || 'Previous backup');
				} else {
					btn.style.display = 'none';
				}
			}
		}

		// Show restore from backup notification
		function showRestoreFromBackupNotification() {
			if (!restoreBackupAvailable || !restoreBackupInfo) return;

			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// Check if notification already exists
			let notification = document.getElementById('restoreFromBackupNotification');
			if (!notification) {
				notification = document.createElement('div');
				notification.id = 'restoreFromBackupNotification';
				notification.className = 'restore-from-backup-notification';
				messagesDiv.appendChild(notification);
			}

			const timestamp = new Date(restoreBackupInfo.timestamp).toLocaleTimeString();
			notification.innerHTML = \`
				<div class="restore-from-backup-content">
					<span class="restore-from-backup-icon">💾</span>
					<div class="restore-from-backup-text">
						<strong>Backup Available</strong>
						<span>Your code before restore was saved at \${timestamp}</span>
					</div>
					<button class="restore-from-backup-btn" onclick="restoreFromBackup()">
						↩️ Restore From Backup
					</button>
					<button class="restore-from-backup-dismiss" onclick="dismissRestoreFromBackupNotification()">✕</button>
				</div>
			\`;
			notification.style.display = 'block';

			scrollToBottomIfNeeded(messagesDiv, shouldScroll);
		}

		function dismissRestoreFromBackupNotification() {
			const notification = document.getElementById('restoreFromBackupNotification');
			if (notification) {
				notification.style.display = 'none';
			}
		}

		function hideRestoreContainer(commitSha) {
			const container = document.getElementById(\`restore-\${commitSha}\`);
			if (container) {
				container.remove();
			}
		}

		// ==================== Context Window Management Functions ====================

		function updateContextUsageUI(stats) {
			contextStats = stats;
			contextUsagePercent = Math.round(stats.usagePercent * 100);

			const circle = document.getElementById('contextCircleProgress');
			const text = document.getElementById('contextUsageText');
			const remainingText = document.getElementById('contextRemainingText');
			const autoCompactText = document.getElementById('contextAutoCompactText');

			if (!circle || !text) return;

			// Update circle progress (stroke-dasharray: progress, remaining)
			const progress = Math.min(contextUsagePercent, 100);
			circle.setAttribute('stroke-dasharray', \`\${progress}, 100\`);

			// Update text
			text.textContent = \`\${contextUsagePercent}%\`;

			// Update color based on usage level
			circle.classList.remove('warning', 'critical');
			if (contextUsagePercent >= 95) {
				circle.classList.add('critical');
			} else if (contextUsagePercent >= 85) {
				circle.classList.add('warning');
			}

			// Update tooltip
			const remainingPercent = Math.max(0, 100 - contextUsagePercent);
			const untilAutoCompact = Math.max(0, 95 - contextUsagePercent);

			if (remainingText) {
				remainingText.textContent = \`\${remainingPercent}% remaining\`;
			}

			if (autoCompactText) {
				if (contextUsagePercent >= 95) {
					autoCompactText.textContent = 'Auto-compact active';
				} else {
					autoCompactText.textContent = \`\${untilAutoCompact}% until auto-compact\`;
				}
			}
		}

		function showContextInfo() {
			// Toggle tooltip visibility or show modal with more details
			const tooltip = document.getElementById('contextUsageTooltip');
			if (tooltip) {
				const isVisible = tooltip.style.display === 'block';
				tooltip.style.display = isVisible ? 'none' : 'block';
			}
		}

		function manualCompactContext() {
			console.log('Manual context compaction requested');

			// Show compacting notification
			showContextCompactNotification('Compacting conversation context...');

			vscode.postMessage({
				type: 'compactContext',
				manual: true
			});
		}

		function showContextCompactNotification(message, details) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// Remove any existing notification
			const existing = document.getElementById('contextCompactNotification');
			if (existing) {
				existing.remove();
			}

			const notification = document.createElement('div');
			notification.id = 'contextCompactNotification';
			notification.className = 'context-compact-notification';
			notification.innerHTML = \`
				<div class="compact-icon">📦</div>
				<div class="compact-text">
					<strong>\${message}</strong>
					\${details ? \`<span>\${details}</span>\` : ''}
				</div>
			\`;

			messagesDiv.appendChild(notification);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);

			// Auto-hide after 5 seconds
			setTimeout(() => {
				if (notification.parentNode) {
					notification.style.opacity = '0';
					notification.style.transition = 'opacity 0.3s ease';
					setTimeout(() => notification.remove(), 300);
				}
			}, 5000);
		}

		function hideContextCompactNotification() {
			const notification = document.getElementById('contextCompactNotification');
			if (notification) {
				notification.remove();
			}
		}

		// Request initial context stats
		function requestContextStats() {
			vscode.postMessage({
				type: 'getContextStats'
			});
		}

		// ===== Project Context Backup Functions =====

		function backupProjectContext() {
			console.log('Backup project context requested');

			const btn = document.getElementById('backupContextBtn');
			if (btn) {
				btn.classList.add('saving');
				btn.setAttribute('title', 'Saving context...');
			}

			vscode.postMessage({
				type: 'backupProjectContext',
				manual: true
			});
		}

		function showBackupSuccess(snapshot) {
			const btn = document.getElementById('backupContextBtn');
			if (btn) {
				btn.classList.remove('saving');
				btn.classList.add('success');
				btn.setAttribute('title', 'Context saved!');

				setTimeout(() => {
					btn.classList.remove('success');
					btn.setAttribute('title', 'Backup Project Context');
				}, 2000);
			}

			// Show notification in chat
			showContextBackupNotification(
				'Project context saved!',
				snapshot ? \`Saved \${snapshot.messageCount || 0} messages from this session.\` : 'Your conversation has been backed up.',
				snapshot?.id
			);
		}

		function showBackupError(error) {
			const btn = document.getElementById('backupContextBtn');
			if (btn) {
				btn.classList.remove('saving');
				btn.setAttribute('title', 'Backup Project Context');
			}

			// Show error notification
			showContextBackupNotification(
				'Failed to backup context',
				error || 'An error occurred while saving the context.',
				null,
				true
			);
		}

		function showContextBackupNotification(title, message, snapshotId, isError = false) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			// Remove any existing notification
			const existing = document.getElementById('contextBackupNotification');
			if (existing) {
				existing.remove();
			}

			const notification = document.createElement('div');
			notification.id = 'contextBackupNotification';
			notification.className = 'context-backup-notification';
			if (isError) {
				notification.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)';
				notification.style.borderColor = 'rgba(239, 68, 68, 0.4)';
			}

			notification.innerHTML = \`
				<div class="backup-icon">\${isError ? '❌' : '💾'}</div>
				<div class="backup-text">
					<strong style="color: \${isError ? '#ef4444' : '#22c55e'}">\${title}</strong>
					<span>\${message}</span>
					\${snapshotId ? \`<div class="backup-actions">
						<button onclick="viewProjectSnapshots()">View All Backups</button>
					</div>\` : ''}
				</div>
			\`;

			messagesDiv.appendChild(notification);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);

			// Auto-hide after 6 seconds
			setTimeout(() => {
				if (notification.parentNode) {
					notification.style.opacity = '0';
					notification.style.transition = 'opacity 0.3s ease';
					setTimeout(() => notification.remove(), 300);
				}
			}, 6000);
		}

		function viewProjectSnapshots() {
			vscode.postMessage({
				type: 'viewProjectSnapshots'
			});
		}

		function showContextRestorePrompt(snapshot) {
			const messagesDiv = document.getElementById('messages');
			if (!messagesDiv) return;

			// Remove any existing prompt
			const existing = document.getElementById('contextRestorePrompt');
			if (existing) {
				existing.remove();
			}

			const formattedDate = new Date(snapshot.timestamp).toLocaleString();
			const prompt = document.createElement('div');
			prompt.id = 'contextRestorePrompt';
			prompt.className = 'context-restore-prompt';
			prompt.innerHTML = \`
				<div class="restore-header">
					<span class="restore-icon">🔄</span>
					<h4>Previous Context Available</h4>
				</div>
				<div class="restore-body">
					A saved context was found from your previous session. Would you like to restore it?
					<div class="snapshot-info">
						<div>
							<span>Saved:</span>
							<span>\${formattedDate}</span>
						</div>
						<div>
							<span>Messages:</span>
							<span>\${snapshot.messageCount || 0}</span>
						</div>
						<div>
							<span>Type:</span>
							<span>\${snapshot.type === 'auto' ? 'Auto-saved' : 'Manual backup'}</span>
						</div>
					</div>
				</div>
				<div class="restore-actions">
					<button class="btn-restore" onclick="restoreProjectContext('\${snapshot.id}')">
						Restore Context
					</button>
					<button class="btn-skip" onclick="skipContextRestore()">
						Start Fresh
					</button>
				</div>
			\`;

			// Insert at the beginning of messages
			messagesDiv.insertBefore(prompt, messagesDiv.firstChild);
		}

		function restoreProjectContext(snapshotId) {
			// Remove the prompt
			const prompt = document.getElementById('contextRestorePrompt');
			if (prompt) {
				prompt.remove();
			}

			// Show restoring message
			const messagesDiv = document.getElementById('messages');
			const restoringMsg = document.createElement('div');
			restoringMsg.className = 'context-backup-notification';
			restoringMsg.innerHTML = \`
				<div class="backup-icon">⏳</div>
				<div class="backup-text">
					<strong>Restoring context...</strong>
					<span>Loading your previous conversation.</span>
				</div>
			\`;
			messagesDiv.appendChild(restoringMsg);

			vscode.postMessage({
				type: 'restoreProjectContext',
				snapshotId: snapshotId
			});

			// Remove restoring message after a short delay
			setTimeout(() => {
				if (restoringMsg.parentNode) {
					restoringMsg.remove();
				}
			}, 2000);
		}

		function skipContextRestore() {
			const prompt = document.getElementById('contextRestorePrompt');
			if (prompt) {
				prompt.style.opacity = '0';
				prompt.style.transition = 'opacity 0.3s ease';
				setTimeout(() => prompt.remove(), 300);
			}

			vscode.postMessage({
				type: 'skipContextRestore'
			});
		}

		function showContextRestored(result) {
			const notification = document.createElement('div');
			notification.className = 'context-backup-notification';
			notification.innerHTML = \`
				<div class="backup-icon">✅</div>
				<div class="backup-text">
					<strong style="color: #22c55e">Context restored!</strong>
					<span>\${result.messageCount || 0} messages loaded from your previous session.</span>
				</div>
			\`;

			const messagesDiv = document.getElementById('messages');
			messagesDiv.appendChild(notification);

			setTimeout(() => {
				if (notification.parentNode) {
					notification.style.opacity = '0';
					notification.style.transition = 'opacity 0.3s ease';
					setTimeout(() => notification.remove(), 300);
				}
			}, 4000);
		}

		function displayProjectSnapshots(snapshots) {
			// Show list of backups (could open a quick pick or modal)
			if (!snapshots || snapshots.length === 0) {
				addMessage('📭 No project context backups found.', 'info');
				return;
			}

			// For now, show a simple list in the chat
			let listHtml = '<div class="context-backup-notification" style="flex-direction: column; align-items: stretch;">';
			listHtml += '<div class="backup-text" style="margin-bottom: 10px;"><strong>📚 Available Context Backups</strong></div>';
			listHtml += '<div style="max-height: 200px; overflow-y: auto;">';

			snapshots.forEach((snapshot, index) => {
				const date = new Date(snapshot.timestamp).toLocaleString();
				const typeLabel = snapshot.type === 'auto' ? '🔄 Auto' : '💾 Manual';
				listHtml += \`
					<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: var(--vscode-editor-background); border-radius: 4px; margin-bottom: 4px;">
						<div>
							<div style="font-size: 11px; color: var(--vscode-foreground);">\${typeLabel} - \${date}</div>
							<div style="font-size: 10px; color: var(--vscode-descriptionForeground);">\${snapshot.messageCount || 0} messages</div>
						</div>
						<button onclick="restoreProjectContext('\${snapshot.id}')" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">
							Restore
						</button>
					</div>
				\`;
			});

			listHtml += '</div></div>';

			const messagesDiv = document.getElementById('messages');
			const listDiv = document.createElement('div');
			listDiv.innerHTML = listHtml;
			messagesDiv.appendChild(listDiv.firstChild);
		}

		// ===== Edit Prompt Functions =====

		function enterEditPromptMode(messageDiv) {
			// Don't allow edit if already processing
			if (isProcessRunning) {
				return;
			}

			// Exit any existing edit mode
			if (editingMessageDiv) {
				exitEditPromptMode(false);
			}

			editingMessageDiv = messageDiv;
			const contentDiv = messageDiv.querySelector('.message-content');
			if (!contentDiv) return;

			// Store original content (get text content, not HTML)
			originalMessageContent = contentDiv.textContent || contentDiv.innerText || '';

			// Get the message index for this message
			const msgIndex = messageDiv.getAttribute('data-message-index');

			// Hide the original content and show edit UI
			contentDiv.style.display = 'none';

			// Create edit container
			const editContainer = document.createElement('div');
			editContainer.className = 'edit-prompt-container';
			editContainer.id = 'editPromptContainer';

			// Create textarea with original content
			const textarea = document.createElement('textarea');
			textarea.className = 'edit-prompt-textarea';
			textarea.id = 'editPromptTextarea';
			textarea.value = originalMessageContent;
			textarea.placeholder = 'Edit your prompt...';

			// Create button container
			const buttonContainer = document.createElement('div');
			buttonContainer.className = 'edit-prompt-buttons';

			// Cancel button
			const cancelBtn = document.createElement('button');
			cancelBtn.className = 'edit-prompt-cancel-btn';
			cancelBtn.textContent = 'Cancel';
			cancelBtn.onclick = () => exitEditPromptMode(false);

			// Submit & Restore button
			const submitBtn = document.createElement('button');
			submitBtn.className = 'edit-prompt-submit-btn';
			submitBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit & Restore';
			submitBtn.onclick = () => submitEditedPrompt(msgIndex);

			// Warning text
			const warningText = document.createElement('div');
			warningText.className = 'edit-prompt-warning';
			warningText.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> This will restore all files and remove messages after this prompt';

			buttonContainer.appendChild(cancelBtn);
			buttonContainer.appendChild(submitBtn);

			editContainer.appendChild(textarea);
			editContainer.appendChild(warningText);
			editContainer.appendChild(buttonContainer);

			// Insert after the header
			const headerDiv = messageDiv.querySelector('.message-header');
			if (headerDiv) {
				headerDiv.after(editContainer);
			} else {
				messageDiv.appendChild(editContainer);
			}

			// Focus the textarea and put cursor at end
			textarea.focus();
			textarea.setSelectionRange(textarea.value.length, textarea.value.length);

			// Auto-resize textarea
			autoResizeEditTextarea(textarea);
			textarea.addEventListener('input', () => autoResizeEditTextarea(textarea));

			// Add escape key handler
			textarea.addEventListener('keydown', (e) => {
				if (e.key === 'Escape') {
					exitEditPromptMode(false);
				}
				// Ctrl/Cmd + Enter to submit
				if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
					submitEditedPrompt(msgIndex);
				}
			});

			// Add editing class to message for styling
			messageDiv.classList.add('editing');

			console.log('Entered edit mode for message index:', msgIndex);
		}

		function autoResizeEditTextarea(textarea) {
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
		}

		function exitEditPromptMode(keepChanges = false) {
			if (!editingMessageDiv) return;

			const editContainer = document.getElementById('editPromptContainer');
			const contentDiv = editingMessageDiv.querySelector('.message-content');

			if (editContainer) {
				editContainer.remove();
			}

			if (contentDiv) {
				contentDiv.style.display = '';
			}

			editingMessageDiv.classList.remove('editing');
			editingMessageDiv = null;
			originalMessageContent = '';

			console.log('Exited edit mode');
		}

		function submitEditedPrompt(msgIndex) {
			if (!editingMessageDiv) return;

			const textarea = document.getElementById('editPromptTextarea');
			if (!textarea) return;

			const editedContent = textarea.value.trim();
			if (!editedContent) {
				// Don't submit empty prompt
				return;
			}

			console.log('Submitting edited prompt for message index:', msgIndex);
			console.log('Edited content:', editedContent.substring(0, 100) + '...');

			// Show loading state on submit button
			const submitBtn = editingMessageDiv.querySelector('.edit-prompt-submit-btn');
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" class="spin" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Restoring...';
			}

			// Send message to extension to handle the edit & restore
			vscode.postMessage({
				type: 'editAndRestorePrompt',
				messageIndex: parseInt(msgIndex),
				editedContent: editedContent,
				originalContent: originalMessageContent
			});
		}

		function handleEditRestoreComplete(data) {
			console.log('Edit restore complete:', data);

			if (!data.success) {
				// Show error
				const submitBtn = editingMessageDiv?.querySelector('.edit-prompt-submit-btn');
				if (submitBtn) {
					submitBtn.disabled = false;
					submitBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit & Restore';
				}
				addMessage('Failed to restore: ' + (data.error || 'Unknown error'), 'error');
				exitEditPromptMode(false);
				return;
			}

			// Get the message index that was edited
			const editedMsgIndex = data.messageIndex;
			const editedContent = data.editedContent;

			// Exit edit mode first
			exitEditPromptMode(false);

			// Remove all messages starting from the edited message (including it)
			removeMessagesFromIndex(editedMsgIndex);

			// Reset message index counter to one less than the edited message
			// so when the new message is sent, it gets the correct index
			messageIndex = editedMsgIndex - 1;

			// Show success notification
			showEditRestoreNotification(data);

			// Now send the edited message after a short delay to allow UI to update
			setTimeout(() => {
				console.log('Auto-submitting edited message...');
				sendEditedMessage(editedContent);
			}, 600);
		}

		function removeMessagesFromIndex(msgIndex) {
			const messagesDiv = document.getElementById('messages');
			if (!messagesDiv) return;

			// Get all direct children of messages div
			const allElements = Array.from(messagesDiv.children);
			let targetElement = null;
			let targetElementIndex = -1;

			// First, find the target user message by data-message-index
			for (let i = 0; i < allElements.length; i++) {
				const el = allElements[i];
				const index = el.getAttribute('data-message-index');
				if (index && parseInt(index) === msgIndex) {
					targetElement = el;
					targetElementIndex = i;
					break;
				}
			}

			if (targetElementIndex === -1) {
				console.log('Target message not found, nothing to remove');
				return;
			}

			// Remove all elements from the target onwards
			const toRemove = allElements.slice(targetElementIndex);

			console.log(\`Found target at index \${targetElementIndex}, removing \${toRemove.length} elements\`);

			// Remove the elements with animation
			toRemove.forEach((el, i) => {
				el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
				el.style.opacity = '0';
				el.style.transform = 'translateX(20px)';
				setTimeout(() => {
					if (el.parentNode) {
						el.remove();
					}
				}, 200);
			});

			console.log(\`Removed \${toRemove.length} messages/elements from index \${msgIndex}\`);
		}

		function sendEditedMessage(content) {
			console.log('Sending edited message:', content.substring(0, 50) + '...');

			// Use the existing send message flow
			const messageInput = document.getElementById('messageInput');
			if (messageInput) {
				messageInput.value = content;
				// Adjust textarea height
				adjustTextareaHeight();
				// Trigger send using the correct function name
				sendMessage();
			}
		}

		function showEditRestoreNotification(data) {
			const messagesDiv = document.getElementById('messages');
			const shouldScroll = shouldAutoScroll(messagesDiv);

			const notification = document.createElement('div');
			notification.className = 'edit-restore-notification';
			notification.innerHTML = \`
				<div class="restore-icon">🔄</div>
				<div class="restore-text">
					<strong>Files restored & messages cleared</strong>
					<span>\${data.filesRestored || 0} files restored to previous state</span>
				</div>
			\`;

			messagesDiv.appendChild(notification);
			scrollToBottomIfNeeded(messagesDiv, shouldScroll);

			// Auto-hide after 4 seconds
			setTimeout(() => {
				if (notification.parentNode) {
					notification.style.opacity = '0';
					notification.style.transition = 'opacity 0.3s ease';
					setTimeout(() => notification.remove(), 300);
				}
			}, 4000);
		}

		function showSessionInfo(sessionId) {
			// const sessionInfo = document.getElementById('sessionInfo');
			// const sessionIdSpan = document.getElementById('sessionId');
			const sessionStatus = document.getElementById('sessionStatus');
			const newSessionBtn = document.getElementById('newSessionBtn');
			const historyBtn = document.getElementById('historyBtn');
			
			if (sessionStatus && newSessionBtn) {
				// sessionIdSpan.textContent = sessionId.substring(0, 8);
				// sessionIdSpan.title = \`Full session ID: \${sessionId} (click to copy)\`;
				// sessionIdSpan.style.cursor = 'pointer';
				// sessionIdSpan.onclick = () => copySessionId(sessionId);
				// sessionInfo.style.display = 'flex';
				sessionStatus.style.display = 'none';
				newSessionBtn.style.display = 'block';
				if (historyBtn) historyBtn.style.display = 'block';
			}
		}
		
		function copySessionId(sessionId) {
			navigator.clipboard.writeText(sessionId).then(() => {
				// Show temporary feedback
				const sessionIdSpan = document.getElementById('sessionId');
				if (sessionIdSpan) {
					const originalText = sessionIdSpan.textContent;
					sessionIdSpan.textContent = 'Copied!';
					setTimeout(() => {
						sessionIdSpan.textContent = originalText;
					}, 1000);
				}
			}).catch(err => {
				console.error('Failed to copy session ID:', err);
			});
		}
		
		function hideSessionInfo() {
			// const sessionInfo = document.getElementById('sessionInfo');
			const sessionStatus = document.getElementById('sessionStatus');
			const newSessionBtn = document.getElementById('newSessionBtn');
			const historyBtn = document.getElementById('historyBtn');
			
			if (sessionStatus && newSessionBtn) {
				// sessionInfo.style.display = 'none';
				sessionStatus.style.display = 'none';

				// Always show new session
				newSessionBtn.style.display = 'block';
				// Keep history button visible - don't hide it
				if (historyBtn) historyBtn.style.display = 'block';
			}
		}

		updateStatus('Initializing...', 'disconnected');
		

		function parseSimpleMarkdown(markdown) {
			// First, handle code blocks before line-by-line processing
			let processedMarkdown = markdown;
			
			// Store code blocks temporarily to protect them from further processing
			const codeBlockPlaceholders = [];
			
			// Handle multi-line code blocks with triple backticks
			// Using RegExp constructor to avoid backtick conflicts in template literal
			const codeBlockRegex = new RegExp('\\\`\\\`\\\`(\\\\w*)\\n([\\\\s\\\\S]*?)\\\`\\\`\\\`', 'g');
			processedMarkdown = processedMarkdown.replace(codeBlockRegex, function(match, lang, code) {
				const language = lang || 'plaintext';
				// Process code line by line to preserve formatting like diff implementation
				const codeLines = code.split('\\n');
				let codeHtml = '';
				
				for (const line of codeLines) {
					const escapedLine = escapeHtml(line);
					codeHtml += '<div class="code-line">' + escapedLine + '</div>';
				}
				
				// Create unique ID for this code block
				const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
				const escapedCode = escapeHtml(code);
				
				const codeBlockHtml = '<div class="code-block-container"><div class="code-block-header"><span class="code-block-language">' + language + '</span><button class="code-copy-btn" onclick="copyCodeBlock(\\\'' + codeId + '\\\')" title="Copy code"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></div><pre class="code-block"><code class="language-' + language + '" id="' + codeId + '" data-raw-code="' + escapedCode.replace(/"/g, '&quot;') + '">' + codeHtml + '</code></pre></div>';
				
				// Store the code block and return a placeholder
				const placeholder = '__CODEBLOCK_' + codeBlockPlaceholders.length + '__';
				codeBlockPlaceholders.push(codeBlockHtml);
				return placeholder;
			});
			
			// Handle inline code with single backticks
			const inlineCodeRegex = new RegExp('\\\`([^\\\`]+)\\\`', 'g');
			processedMarkdown = processedMarkdown.replace(inlineCodeRegex, '<code>$1</code>');
			
			const lines = processedMarkdown.split('\\n');
			let html = '';
			let inUnorderedList = false;
			let inOrderedList = false;

			for (let line of lines) {
				line = line.trim();
				
				// Check if this is a code block placeholder
				if (line.startsWith('__CODEBLOCK_') && line.endsWith('__')) {
					// This is a code block placeholder, don't process it
					html += line;
					continue;
				}

				// Bold
				line = line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');

				// Italic - only apply when underscores are surrounded by whitespace or at beginning/end
				line = line.replace(/(?<!\\*)\\*(?!\\*)(.*?)\\*(?!\\*)/g, '<em>$1</em>');
				line = line.replace(/(^|\\s)_([^_\\s][^_]*[^_\\s]|[^_\\s])_(?=\\s|$)/g, '$1<em>$2</em>');

				// Headers
				if (/^####\\s+/.test(line)) {
				html += '<h4>' + line.replace(/^####\\s+/, '') + '</h4>';
				continue;
				} else if (/^###\\s+/.test(line)) {
				html += '<h3>' + line.replace(/^###\\s+/, '') + '</h3>';
				continue;
				} else if (/^##\\s+/.test(line)) {
				html += '<h2>' + line.replace(/^##\\s+/, '') + '</h2>';
				continue;
				} else if (/^#\\s+/.test(line)) {
				html += '<h1>' + line.replace(/^#\\s+/, '') + '</h1>';
				continue;
				}

				// Ordered list
				if (/^\\d+\\.\\s+/.test(line)) {
				if (!inOrderedList) {
					html += '<ol>';
					inOrderedList = true;
				}
				const item = line.replace(/^\\d+\\.\\s+/, '');
				html += '<li>' + item + '</li>';
				continue;
				}

				// Unordered list
				if (line.startsWith('- ')) {
				if (!inUnorderedList) {
					html += '<ul>';
					inUnorderedList = true;
				}
				html += '<li>' + line.slice(2) + '</li>';
				continue;
				}

				// Close lists
				if (inUnorderedList) {
				html += '</ul>';
				inUnorderedList = false;
				}
				if (inOrderedList) {
				html += '</ol>';
				inOrderedList = false;
				}

				// Paragraph or break
				if (line !== '') {
				html += '<p>' + line + '</p>';
				} else {
				html += '<br>';
				}
			}

			if (inUnorderedList) html += '</ul>';
			if (inOrderedList) html += '</ol>';

			// Restore code block placeholders
			for (let i = 0; i < codeBlockPlaceholders.length; i++) {
				const placeholder = '__CODEBLOCK_' + i + '__';
				html = html.replace(placeholder, codeBlockPlaceholders[i]);
			}

			return html;
		}

		// Conversation history functions
		function toggleConversationHistory() {
			const historyDiv = document.getElementById('conversationHistory');
			const chatContainer = document.getElementById('chatContainer');
			
			if (historyDiv.style.display === 'none') {
				sendStats('History opened');
				// Show conversation history
				requestConversationList();
				historyDiv.style.display = 'block';
				chatContainer.style.display = 'none';
			} else {
				// Hide conversation history
				historyDiv.style.display = 'none';
				chatContainer.style.display = 'flex';
			}
		}

		function requestConversationList() {
			vscode.postMessage({
				type: 'getConversationList'
			});
		}

		function loadConversation(filename) {
			console.log('loadConversation called with filename:', filename);
			vscode.postMessage({
				type: 'loadConversation',
				filename: filename
			});

			// Hide conversation history and show chat
			toggleConversationHistory();
		}

		// File picker functions
		function showFilePicker() {
			// Request initial file list from VS Code
			vscode.postMessage({
				type: 'getWorkspaceFiles',
				searchTerm: ''
			});
			
			// Show modal
			filePickerModal.style.display = 'flex';
			fileSearchInput.focus();
			selectedFileIndex = -1;
		}

		function hideFilePicker() {
			filePickerModal.style.display = 'none';
			fileSearchInput.value = '';
			selectedFileIndex = -1;
		}

		function getFileIcon(filename) {
			const ext = filename.split('.').pop()?.toLowerCase();
			switch (ext) {
				case 'js': case 'jsx': case 'ts': case 'tsx': return '📄';
				case 'html': case 'htm': return '🌐';
				case 'css': case 'scss': case 'sass': return '🎨';
				case 'json': return '📋';
				case 'md': return '📝';
				case 'py': return '🐍';
				case 'java': return '☕';
				case 'cpp': case 'c': case 'h': return '⚙️';
				case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼️';
				case 'pdf': return '📄';
				case 'zip': case 'tar': case 'gz': return '📦';
				default: return '📄';
			}
		}

		function renderFileList() {
			fileList.innerHTML = '';
			
			filteredFiles.forEach((file, index) => {
				const fileItem = document.createElement('div');
				fileItem.className = 'file-item';
				if (index === selectedFileIndex) {
					fileItem.classList.add('selected');
				}
				
				fileItem.innerHTML = \`
					<span class="file-icon">\${getFileIcon(file.name)}</span>
					<div class="file-info">
						<div class="file-name">\${file.name}</div>
						<div class="file-path">\${file.path}</div>
					</div>
				\`;
				
				fileItem.addEventListener('click', () => {
					selectFile(file);
				});
				
				fileList.appendChild(fileItem);
			});
		}

		function selectFile(file) {
			// Insert file path at cursor position
			const cursorPos = messageInput.selectionStart;
			const textBefore = messageInput.value.substring(0, cursorPos);
			const textAfter = messageInput.value.substring(cursorPos);
			
			// Replace the @ symbol with the file path
			const beforeAt = textBefore.substring(0, textBefore.lastIndexOf('@'));
			const newText = beforeAt + '@' + file.path + ' ' + textAfter;
			
			messageInput.value = newText;
			messageInput.focus();
			
			// Set cursor position after the inserted path
			const newCursorPos = beforeAt.length + file.path.length + 2;
			messageInput.setSelectionRange(newCursorPos, newCursorPos);
			
			hideFilePicker();
			adjustTextareaHeight();
		}

		function filterFiles(searchTerm) {
			// Send search request to backend instead of filtering locally
			vscode.postMessage({
				type: 'getWorkspaceFiles',
				searchTerm: searchTerm
			});
			selectedFileIndex = -1;
		}

		// Image handling functions
		function selectImage() {
			// Use VS Code's native file picker instead of browser file picker
			vscode.postMessage({
				type: 'selectImageFile'
			});
		}


		function showImageAddedFeedback(fileName) {
			// Create temporary feedback element
			const feedback = document.createElement('div');
			feedback.textContent = \`Added: \${fileName}\`;
			feedback.style.cssText = \`
				position: fixed;
				top: 20px;
				right: 20px;
				background: var(--vscode-notifications-background);
				color: var(--vscode-notifications-foreground);
				padding: 8px 12px;
				border-radius: 4px;
				font-size: 12px;
				z-index: 1000;
				opacity: 0;
				transition: opacity 0.3s ease;
			\`;
			
			document.body.appendChild(feedback);
			
			// Animate in
			setTimeout(() => feedback.style.opacity = '1', 10);
			
			// Animate out and remove
			setTimeout(() => {
				feedback.style.opacity = '0';
				setTimeout(() => feedback.remove(), 300);
			}, 2000);
		}

		function displayConversationList(conversations) {
			const listDiv = document.getElementById('conversationList');
			listDiv.innerHTML = '';

			if (conversations.length === 0) {
				listDiv.innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No conversations found</p>';
				return;
			}

			conversations.forEach(conv => {
				const item = document.createElement('div');
				item.className = 'conversation-item';
				item.setAttribute('data-filename', conv.filename);
				item.style.cursor = 'pointer';

				const date = new Date(conv.startTime).toLocaleDateString();
				const time = new Date(conv.startTime).toLocaleTimeString();

				item.innerHTML = \`
					<div class="conversation-title">\${conv.firstUserMessage.substring(0, 60)}\${conv.firstUserMessage.length > 60 ? '...' : ''}</div>
					<div class="conversation-meta">\${date} at \${time} • \${conv.messageCount} messages • $\${conv.totalCost.toFixed(3)}</div>
					<div class="conversation-preview">Last: \${conv.lastUserMessage.substring(0, 80)}\${conv.lastUserMessage.length > 80 ? '...' : ''}</div>
				\`;

				// Use addEventListener for reliable click handling
				item.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					const filename = this.getAttribute('data-filename');
					console.log('Conversation item clicked, filename:', filename);
					loadConversation(filename);
				});

				listDiv.appendChild(item);
			});

			console.log('Displayed', conversations.length, 'conversations');
		}

		function handleClipboardText(text) {
			if (!text) return;
			
			// Insert text at cursor position
			const start = messageInput.selectionStart;
			const end = messageInput.selectionEnd;
			const currentValue = messageInput.value;
			
			const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
			messageInput.value = newValue;
			
			// Set cursor position after pasted text
			const newCursorPos = start + text.length;
			messageInput.setSelectionRange(newCursorPos, newCursorPos);
			
			// Trigger input event to adjust height
			messageInput.dispatchEvent(new Event('input', { bubbles: true }));
		}

		// Settings functions

		function toggleSettings() {
			const settingsModal = document.getElementById('settingsModal');
			if (settingsModal.style.display === 'none') {
				// Request current settings from VS Code
				vscode.postMessage({
					type: 'getSettings'
				});
				// Request current permissions
				vscode.postMessage({
					type: 'getPermissions'
				});
				settingsModal.style.display = 'flex';
			} else {
				hideSettingsModal();
			}
		}

		function hideSettingsModal() {
			document.getElementById('settingsModal').style.display = 'none';
		}

		function updateSettings() {
			// Note: thinking intensity is now handled separately in the thinking intensity modal
			
			const wslEnabled = document.getElementById('wsl-enabled').checked;
			const wslDistro = document.getElementById('wsl-distro').value;
			const wslNodePath = document.getElementById('wsl-node-path').value;
			const wslClaudePath = document.getElementById('wsl-claude-path').value;
			const yoloMode = document.getElementById('yolo-mode').checked;

			// Update WSL options visibility
			document.getElementById('wslOptions').style.display = wslEnabled ? 'block' : 'none';

			// Send settings to VS Code immediately
			vscode.postMessage({
				type: 'updateSettings',
				settings: {
					'wsl.enabled': wslEnabled,
					'wsl.distro': wslDistro || 'Ubuntu',
					'wsl.nodePath': wslNodePath || '/usr/bin/node',
					'wsl.claudePath': wslClaudePath || '/usr/local/bin/claude',
					'permissions.yoloMode': yoloMode
				}
			});
		}

		// Permissions management functions
		function renderPermissions(permissions) {
			const permissionsList = document.getElementById('permissionsList');
			
			if (!permissions || !permissions.alwaysAllow || Object.keys(permissions.alwaysAllow).length === 0) {
				permissionsList.innerHTML = \`
					<div class="permissions-empty">
						No always-allow permissions set
					</div>
				\`;
				return;
			}
			
			let html = '';
			
			for (const [toolName, permission] of Object.entries(permissions.alwaysAllow)) {
				if (permission === true) {
					// Tool is always allowed
					html += \`
						<div class="permission-item">
							<div class="permission-info">
								<span class="permission-tool">\${toolName}</span>
								<span class="permission-desc">All</span>
							</div>
							<button class="permission-remove-btn" onclick="removePermission('\${toolName}', null)">Remove</button>
						</div>
					\`;
				} else if (Array.isArray(permission)) {
					// Tool has specific commands/patterns
					for (const command of permission) {
						const displayCommand = command.replace(' *', ''); // Remove asterisk for display
						html += \`
							<div class="permission-item">
								<div class="permission-info">
									<span class="permission-tool">\${toolName}</span>
									<span class="permission-command"><code>\${displayCommand}</code></span>
								</div>
								<button class="permission-remove-btn" onclick="removePermission('\${toolName}', '\${escapeHtml(command)}')">Remove</button>
							</div>
						\`;
					}
				}
			}
			
			permissionsList.innerHTML = html;
		}
		
		function removePermission(toolName, command) {
			vscode.postMessage({
				type: 'removePermission',
				toolName: toolName,
				command: command
			});
		}
		
		function showAddPermissionForm() {
			document.getElementById('showAddPermissionBtn').style.display = 'none';
			document.getElementById('addPermissionForm').style.display = 'block';
			
			// Focus on the tool select dropdown
			setTimeout(() => {
				document.getElementById('addPermissionTool').focus();
			}, 100);
		}
		
		function hideAddPermissionForm() {
			document.getElementById('showAddPermissionBtn').style.display = 'flex';
			document.getElementById('addPermissionForm').style.display = 'none';
			
			// Clear form inputs
			document.getElementById('addPermissionTool').value = '';
			document.getElementById('addPermissionCommand').value = '';
			document.getElementById('addPermissionCommand').style.display = 'none';
		}
		
		function toggleCommandInput() {
			const toolSelect = document.getElementById('addPermissionTool');
			const commandInput = document.getElementById('addPermissionCommand');
			const hintDiv = document.getElementById('permissionsFormHint');
			
			if (toolSelect.value === 'Bash') {
				commandInput.style.display = 'block';
				hintDiv.textContent = 'Use patterns like "npm i *" or "git add *" for specific commands.';
			} else if (toolSelect.value === '') {
				commandInput.style.display = 'none';
				commandInput.value = '';
				hintDiv.textContent = 'Select a tool to add always-allow permission.';
			} else {
				commandInput.style.display = 'none';
				commandInput.value = '';
				hintDiv.textContent = 'This will allow all ' + toolSelect.value + ' commands without asking for permission.';
			}
		}
		
		function addPermission() {
			const toolSelect = document.getElementById('addPermissionTool');
			const commandInput = document.getElementById('addPermissionCommand');
			const addBtn = document.getElementById('addPermissionBtn');
			
			const toolName = toolSelect.value.trim();
			const command = commandInput.value.trim();
			
			if (!toolName) {
				return;
			}
			
			// Disable button during processing
			addBtn.disabled = true;
			addBtn.textContent = 'Adding...';
			
			vscode.postMessage({
				type: 'addPermission',
				toolName: toolName,
				command: command || null
			});
			
			// Clear form and hide it
			toolSelect.value = '';
			commandInput.value = '';
			hideAddPermissionForm();
			
			// Re-enable button
			setTimeout(() => {
				addBtn.disabled = false;
				addBtn.textContent = 'Add';
			}, 500);
		}

		// Close settings modal when clicking outside
		document.getElementById('settingsModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('settingsModal')) {
				hideSettingsModal();
			}
		});

		// Close thinking intensity modal when clicking outside
		document.getElementById('thinkingIntensityModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('thinkingIntensityModal')) {
				hideThinkingIntensityModal();
			}
		});

		// Close plan mode modal when clicking outside
		document.getElementById('planModeModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('planModeModal')) {
				hidePlanModeModal();
			}
		});

		// Close slash commands modal when clicking outside
		document.getElementById('slashCommandsModal').addEventListener('click', (e) => {
			if (e.target === document.getElementById('slashCommandsModal')) {
				hideSlashCommandsModal();
			}
		});

		// Request custom snippets from VS Code on page load
		vscode.postMessage({
			type: 'getCustomSnippets'
		});

		// Detect slash commands input
		messageInput.addEventListener('input', (e) => {
			const value = messageInput.value;
			// Only trigger when "/" is the very first and only character
			if (value === '/') {
				showSlashCommandsModal();
			}
		});

		// Add settings message handler to window message event
		const originalMessageHandler = window.onmessage;
		window.addEventListener('message', event => {
			const message = event.data;
			
			if (message.type === 'customSnippetsData') {
				// Update global custom snippets data
				customSnippetsData = message.data || {};
				// Refresh the snippets display
				loadCustomSnippets(customSnippetsData);
			} else if (message.type === 'customSnippetSaved') {
				// Refresh snippets after saving
				vscode.postMessage({
					type: 'getCustomSnippets'
				});
			} else if (message.type === 'customSnippetDeleted') {
				// Refresh snippets after deletion
				vscode.postMessage({
					type: 'getCustomSnippets'
				});
			} else if (message.type === 'settingsData') {
				// Update UI with current settings
				const thinkingIntensity = message.data['thinking.intensity'] || 'think';
				const intensityValues = ['think', 'think-hard', 'think-harder', 'ultrathink'];
				const sliderValue = intensityValues.indexOf(thinkingIntensity);
				
				// Update thinking intensity modal if it exists
				const thinkingIntensitySlider = document.getElementById('thinkingIntensitySlider');
				if (thinkingIntensitySlider) {
					thinkingIntensitySlider.value = sliderValue >= 0 ? sliderValue : 0;
					updateThinkingIntensityDisplay(thinkingIntensitySlider.value);
				} else {
					// Update toggle name even if modal isn't open
					updateThinkingModeToggleName(sliderValue >= 0 ? sliderValue : 0);
				}
				
				document.getElementById('wsl-enabled').checked = message.data['wsl.enabled'] || false;
				document.getElementById('wsl-distro').value = message.data['wsl.distro'] || 'Ubuntu';
				document.getElementById('wsl-node-path').value = message.data['wsl.nodePath'] || '/usr/bin/node';
				document.getElementById('wsl-claude-path').value = message.data['wsl.claudePath'] || '/usr/local/bin/claude';
				document.getElementById('yolo-mode').checked = message.data['permissions.yoloMode'] || false;
				
				// Update yolo warning visibility
				updateYoloWarning();
				
				// Show/hide WSL options
				document.getElementById('wslOptions').style.display = message.data['wsl.enabled'] ? 'block' : 'none';
			}

			if (message.type === 'platformInfo') {
				// Check if user is on Windows and show WSL alert if not dismissed and WSL not already enabled
				if (message.data.isWindows && !message.data.wslAlertDismissed && !message.data.wslEnabled) {
					// Small delay to ensure UI is ready
					setTimeout(() => {
						showWSLAlert();
					}, 1000);
				}
			}
			
			if (message.type === 'permissionsData') {
				// Update permissions UI
				renderPermissions(message.data);
			}
		});

	</script>`

export default getScript;