# Claude CodeUI by NexaLance - Test Plan

This document provides comprehensive testing instructions for all features of the Claude CodeUI by NexaLance extension.

---

## Overview

Claude CodeUI by NexaLance includes numerous settings and features that need thorough testing. This test plan covers all major components.

---

## 1. Basic Settings Interface

### WSL Configuration

**Changes Made (ui.ts / extension.ts)**:
- Settings button in header
- Settings modal with WSL options
- Message handlers for settings sync

**Testing Steps**:
1. Open VS Code with the extension
2. Open Claude CodeUI (`Ctrl+Shift+C`)
3. Click the settings button in the header
4. Verify settings modal appears
5. Test WSL settings:
   - Toggle "Enable WSL Integration"
   - Verify WSL options show/hide accordingly
   - Modify WSL Distribution name
   - Modify Node.js path
   - Modify Claude path
6. Verify settings persist after closing and reopening

**Configuration Properties (package.json)**:
- `claudeCodeChat.wsl.enabled` (boolean, default: false)
- `claudeCodeChat.wsl.distro` (string, default: "Ubuntu")
- `claudeCodeChat.wsl.nodePath` (string, default: "/usr/bin/node")
- `claudeCodeChat.wsl.claudePath` (string, default: "/usr/local/bin/claude")

---

## 2. Model Selection

### Model Configuration

**Testing Steps**:
1. Open Claude CodeUI
2. Find the model selector dropdown
3. Test each model option:
   - **Opus 4.5** - Most powerful ($5/$25 per 1M tokens)
   - **Sonnet 4.5** - Balanced ($3/$15 per 1M tokens)
   - **Haiku 4.5** - Fast ($0.80/$4 per 1M tokens)
   - **Default** - Uses CLI default
4. Verify model persists across sessions
5. Send a message and verify the selected model is used

**Configuration Properties**:
- `claudeCodeChat.model.default` (enum: opus/sonnet/haiku/default, default: sonnet)
- `claudeCodeChat.model.maxTokens` (number, 1024-128000, default: 16384)

---

## 3. Thinking Mode Intensity

### Intensity Levels

**Testing Steps**:
1. Open settings modal
2. Find the thinking intensity slider
3. Test each level:
   - `think` - Standard reasoning
   - `think-hard` - More detailed
   - `think-harder` - Comprehensive
   - `ultrathink` - Maximum depth
4. Verify the selected intensity affects prompts
5. Confirm settings persist

**Configuration Properties**:
- `claudeCodeChat.thinking.intensity` (enum, default: think)

---

## 4. Permission Management

### Permission Modes

**Testing Steps**:
1. Open settings
2. Test each permission mode:
   - **Default** - Read-only, asks before modifications
   - **Plan Mode** - Analyze without modifying
   - **Accept Edits** - Auto-approve file edits
   - **Bypass Permissions** - Skip all prompts (dangerous)
3. Test YOLO mode toggle
4. Verify permission dialogs appear appropriately

**Configuration Properties**:
- `claudeCodeChat.permissions.mode` (enum, default: default)
- `claudeCodeChat.permissions.yoloMode` (boolean, default: false)

---

## 5. Memory System

### Project Memory

**Testing Steps**:
1. Open Claude CodeUI
2. Click the Memory button
3. Test adding entities:
   - Create a new entity
   - Add observations
   - Verify entity appears in list
4. Test search:
   - Search for an entity
   - Verify O(1) performance
5. Test auto-injection:
   - Enable auto-inject in settings
   - Send a message and verify context is injected
6. Test memory export/import:
   - Export memory
   - Clear memory
   - Import memory
   - Verify restoration

**Configuration Properties**:
- `claudeCodeChat.memory.autoInject` (boolean, default: true)
- `claudeCodeChat.memory.maxContextSize` (number, 500-16000, default: 4000)

**Storage Locations**:
- `.claude/memory/memory.jsonl` - Entity store
- `.claude/memory/memory-index.json` - Inverted index
- `.claude/memory/memory-graph.json` - Relationships
- `.claude/memory/scratchpad.json` - Active context

---

## 6. Checkpoint System

### Checkpoint Management

**Testing Steps**:
1. Open Claude CodeUI
2. Make some file changes via Claude
3. Verify checkpoint is created automatically
4. Click "View Checkpoints"
5. Test checkpoint operations:
   - View checkpoint details
   - Preview changes before restore
   - Restore a checkpoint
   - Verify backup is created
   - Test undo restore

**Storage Locations**:
- `.claude/checkpoints/index.json` - Metadata
- `.claude/checkpoints/hash-cache.json` - SHA-256 cache
- `.claude/checkpoints/backups/` - Checkpoint data

---

## 7. Context Window Management

### Token Tracking

**Testing Steps**:
1. Open Claude CodeUI
2. Send several messages to build up context
3. Monitor token usage indicator
4. Verify auto-compression triggers at ~90% usage
5. Check that critical context is preserved
6. Verify compression ratio (target: 50-60%)

---

## 8. Project Context Persistence

### Session Management

**Testing Steps**:
1. Have a conversation with Claude
2. Wait for auto-save (30 seconds)
3. Close VS Code completely
4. Reopen VS Code and Claude CodeUI
5. Verify conversation is restored
6. Test manual snapshot:
   - Create a snapshot
   - Make more changes
   - Restore from snapshot
7. Test session history:
   - View past sessions
   - Load a previous session

**Storage Locations**:
- `.claude/context/sessions/` - Session files
- `.claude/context/snapshots/` - Manual backups
- `.claude/context/index.json` - Session index

---

## 9. Documentation Manager

### External Docs

**Testing Steps**:
1. Click the "Docs" button
2. Add a documentation URL
3. Wait for crawling to complete
4. Search the indexed documentation
5. Use `@Docs` in a prompt to reference docs
6. Verify docs are included in context

**Storage Locations**:
- `.claude/docs/_index.json` - Documentation index
- `.claude/docs/{docId}/` - Indexed documentation

---

## 10. MCP Server Integration

### Server Management

**Testing Steps**:
1. Open settings
2. Navigate to MCP section
3. Add a new MCP server:
   - Enter server name
   - Configure command
   - Set environment variables
4. Test server connection
5. Edit server configuration
6. Remove a server
7. Test popular servers gallery

---

## 11. Plan Mode

### Planning Modes

**Testing Steps**:
1. Open settings
2. Test each plan mode:
   - **planfast** - Quick plan, immediate implementation
   - **ask** - Detailed planning with approval
   - **agent** - Full autonomous agent
   - **auto** - AutoMode with comprehensive planning

**Configuration Properties**:
- `claudeCodeChat.plan.mode` (enum, default: ask)

---

## 12. Slash Commands

### Command Testing

**Testing Steps**:
1. Type `/` in the input field
2. Verify command modal appears
3. Test common commands:
   - `/agents` - Manage AI agents
   - `/cost` - View API costs
   - `/config` - Open settings
   - `/memory` - Memory operations
   - `/review` - Code review
   - `/add-dir` - Add directories
   - `/rewind` - Rewind conversation
   - `/usage` - Show usage limits
4. Test custom command input

---

## 13. File & Image Support

### File References

**Testing Steps**:
1. Type `@` in the input field
2. Verify file picker appears
3. Search for a file
4. Select file and verify it's referenced in prompt
5. Test image support:
   - Drag and drop an image
   - Paste from clipboard (Ctrl+V)
   - Use file picker for images
6. Verify images are stored in `.claude/claude-code-chat-images/`

---

## 14. UI/UX Features

### Interface Testing

**Testing Steps**:
1. Test keyboard shortcuts:
   - `Ctrl+Shift+C` - Open Claude CodeUI
   - `Enter` - Send message
   - `Shift+Enter` - New line
   - `Escape` - Close modals
2. Test stop button during long operations
3. Verify loading indicators appear
4. Check error messages are helpful
5. Test sidebar integration
6. Verify status bar shows current model
7. Test theme compatibility (light/dark)

---

## 15. Performance Testing

### Optimization Verification

**Testing Steps**:
1. Test with large codebase (20,000+ files)
2. Verify checkpoint system handles large projects
3. Test memory search performance (should be O(1))
4. Verify LRU cache is working:
   - Search for files repeatedly
   - Check response times
5. Test auto-save doesn't block UI
6. Verify no memory leaks after extended use

---

## 16. Cross-Platform Testing

### WSL Testing (Windows)

**Testing Steps**:
1. Enable WSL in settings
2. Configure WSL distribution
3. Set Node.js and Claude paths
4. Test Claude execution in WSL
5. Verify path conversion works

### macOS/Linux Testing

**Testing Steps**:
1. Test with default paths
2. Verify process termination (stop button)
3. Test keyboard shortcuts

---

## Test Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| WSL Settings | [ ] | |
| Model Selection | [ ] | |
| Thinking Intensity | [ ] | |
| Permission Modes | [ ] | |
| YOLO Mode | [ ] | |
| Memory System | [ ] | |
| Memory Search | [ ] | |
| Memory Auto-inject | [ ] | |
| Checkpoint Create | [ ] | |
| Checkpoint Restore | [ ] | |
| Checkpoint Undo | [ ] | |
| Token Tracking | [ ] | |
| Auto-compression | [ ] | |
| Session Persistence | [ ] | |
| Session Restore | [ ] | |
| Docs Indexing | [ ] | |
| Docs Search | [ ] | |
| MCP Servers | [ ] | |
| Plan Modes | [ ] | |
| Slash Commands | [ ] | |
| File References | [ ] | |
| Image Support | [ ] | |
| Stop Button | [ ] | |
| Keyboard Shortcuts | [ ] | |
| Theme Support | [ ] | |
| Performance | [ ] | |

---

## Known Issues

Document any issues found during testing:

1. _Issue description_
   - Steps to reproduce
   - Expected behavior
   - Actual behavior

---

## Credits

- **Original Project**: [claude-code-chat](https://github.com/andrepimenta/claude-code-chat) by Andre Pimenta
- **Enhanced Version**: Claude CodeUI by NexaLance by Developer Jillur

---

**Test Date**: _______________
**Tested By**: _______________
**Version**: 2.2.0
