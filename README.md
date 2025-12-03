# Claude CodeUI by NexaLance

> **An Enterprise-Grade VS Code Extension for Claude Code CLI**

Transform your VS Code into a powerful AI-assisted development environment with a beautiful, feature-rich chat interface.

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/developerjillur/claude-codeUI-by-nexalance)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.94.0+-green.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-orange.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Lines of Code](https://img.shields.io/badge/Lines%20of%20Code-30%2C000%2B-brightgreen.svg)](#architecture--code-quality)

---

## Acknowledgments & Credits

This extension is built upon the excellent foundation of **[claude-code-chat](https://github.com/andrepimenta/claude-code-chat)** by **[Andre Pimenta](https://github.com/andrepimenta)**.

We extend our sincere gratitude to Andre Pimenta for creating the original extension that inspired this enhanced version. The original project provided the core architecture and concept that made Claude CodeUI by NexaLance possible.

| | Original | Enhanced |
|---|---|---|
| **Project** | [claude-code-chat](https://github.com/andrepimenta/claude-code-chat) | [Claude CodeUI by NexaLance](https://github.com/developerjillur/claude-codeUI-by-nexalance) |
| **Author** | Andre Pimenta | Developer Jillur |
| **GitHub** | [@andrepimenta](https://github.com/andrepimenta) | [@developerjillur](https://github.com/developerjillur) |

---

## What's New in Claude CodeUI by NexaLance

### Major Enhancements Over Original

| Feature | Original | Claude CodeUI by NexaLance |
|---------|----------|---------------------------|
| **Memory System** | Basic | Advanced Knowledge Graph with Inverted Index (O(1) search) |
| **Checkpoint System** | Basic Git | SHA-256 Hashing, 20,000+ file support |
| **Context Management** | Manual | Auto-compression at 90%, Token Tracking |
| **Type Safety** | Partial | 50+ TypeScript Interfaces, Strict Mode |
| **Performance** | Standard | LRU Caching, Debouncing, Lazy Loading |
| **Verification** | None | Self-Verification Engine with Code Lint |
| **Documentation** | Manual | Auto-indexing Documentation Manager |
| **Code Size** | ~5,000 lines | 30,000+ lines |

### New Manager Systems (8 Modules)

1. **Advanced Context Engine** - Priompt-inspired priority-based context management
2. **Project Memory Manager** - Knowledge graph with 11 entity types
3. **Smart Memory Manager** - Intelligent token budgeting and injection
4. **Checkpoint Manager** - Enhanced with SHA-256 caching
5. **Context Window Manager** - Auto-compression and optimization
6. **Project Context Manager** - Session persistence with auto-save
7. **Self-Verification Engine** - Response validation and quality scoring
8. **Documentation Manager** - External docs indexing and search

---

## Overview

Claude CodeUI by NexaLance provides a beautiful, intuitive interface for Claude Code CLI right inside VS Code. No more terminal commands - chat with Claude through a modern, feature-rich interface.

### Key Highlights

- **30,000+ lines** of enterprise-grade TypeScript code
- **8 specialized manager systems** for different concerns
- **50+ TypeScript interfaces** for comprehensive type safety
- **Zero runtime dependencies** (only dev dependencies)
- **Persistent memory** that remembers your project across sessions
- **Intelligent context management** that prevents token overflow
- **Self-verification** that validates responses before delivery

---

## Prerequisites

Before using this extension, install **Claude Code CLI**:

```bash
npm install -g @anthropic-ai/claude-code
```

Or visit: [Claude Code Installation Guide](https://www.anthropic.com/claude-code)

---

## Installation

### From VSIX File
1. Download the latest `.vsix` file from [Releases](https://github.com/developerjillur/claude-codeUI-by-nexalance/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
4. Type "Install from VSIX" and select the downloaded file

### From Source
```bash
git clone https://github.com/developerjillur/claude-codeUI-by-nexalance.git
cd claude-codeUI-by-nexalance
npm install
npm run compile
npx vsce package --no-dependencies
```

---

## Features

### 1. Beautiful Chat Interface
- Clean, modern UI with dark theme optimized for VS Code
- Tree-style message formatting with bullet points
- Syntax highlighting for code blocks
- One-click code copy functionality
- Real-time streaming responses with typing indicators
- Message separation with subtle borders
- Activity panel showing running tasks
- Todo progress tracking panel

### 2. Model Selection

| Model | Description | Cost per 1M tokens |
|-------|-------------|-------------------|
| **Opus 4.5** | Most powerful for complex reasoning | $5 (input) / $25 (output) |
| **Sonnet 4.5** | Balanced performance (Recommended) | $3 / $15 |
| **Haiku 4.5** | Fast and cost-efficient | $0.80 / $4 |

### 3. Thinking Mode Intensity
Configure how deeply Claude thinks through problems:
- `think` - Standard reasoning
- `think-hard` - More detailed analysis
- `think-harder` - Comprehensive reasoning
- `ultrathink` - Maximum reasoning depth

### 4. Advanced Checkpoint System
Never lose your work with our enterprise-grade checkpoint system:

- **Automatic Checkpoints** - Saves project state during conversations
- **File Tracking** - Tracks 20,000+ files with SHA-256 hashing
- **One-Click Restore** - Restore to any previous checkpoint
- **Preview Changes** - See changes before restoring
- **Backup Protection** - Creates backup before any restore
- **Undo Restore** - Revert if needed
- **Git-based Storage** - Reliable version control
- **Incremental Mode** - Efficient change detection

### 5. Project Memory System
Claude remembers your project context across sessions:

- **Knowledge Graph** - Entities and relationships stored as graph
- **11 Entity Types** - project, task, file, decision, pattern, bug, feature, dependency, architecture, conversation, milestone
- **Inverted Index Search** - O(1) lookup performance
- **JSONL Storage** - Reliable append-only format
- **Auto-injection** - Relevant context automatically provided
- **Memory Export** - Backup and restore project memory
- **Observation Deduplication** - Efficient storage

### 6. Context Window Management
Intelligent context optimization:

- **Token Tracking** - Real-time usage monitoring
- **Auto-compression** - At 90% usage with 50-60% compression ratio
- **Smart Summarization** - Preserves critical information
- **Model-aware Limits** - Automatic adjustment based on model
- **Priority Preservation** - Critical context never lost

### 7. Project Context Persistence
Your conversations are never lost:

- **Session Persistence** - Saved to `.claude/context/`
- **Auto-save** - Every 30 seconds with race condition protection
- **Context Snapshots** - Manual backups anytime
- **Quick Restoration** - One-click restore
- **AI-generated Summaries** - Quick session overview

### 8. Documentation Manager
Manage external documentation for Claude:

- **URL Indexing** - Add documentation URLs
- **Smart Crawling** - Automatic indexing
- **Cross-doc Search** - Search all indexed docs
- **@Docs Reference** - Use in prompts

### 9. MCP Server Integration
Full Model Context Protocol support:

- **Server Management** - Add, edit, remove servers
- **Popular Servers** - One-click setup for common servers
- **Environment Variables** - Server-specific configuration
- **Connection Status** - Monitor server health

### 10. Permission Management

| Mode | Description |
|------|-------------|
| `Default` | Read-only, asks before modifications |
| `Plan Mode` | Analyze without modifying |
| `Accept Edits` | Auto-approve file edits |
| `Bypass Permissions` | Skip all prompts (use with caution) |

Additional options:
- **YOLO Mode** - Unrestricted operation
- **Granular Permissions** - Allow specific tools

### 11. Conversation History
- **History Browser** - Browse past conversations
- **Search** - Find specific conversations
- **Load & Continue** - Resume any conversation
- **Export** - Export for reference

### 12. File & Image Support
- **File References** - Use `@` to reference files
- **Image Attachments** - Attach images for context
- **Workspace Search** - Quick file search with LRU caching
- **Drag & Drop** - Drop files into chat
- **Clipboard Paste** - Paste images with Ctrl+V

### 13. Slash Commands
23+ built-in commands including:
- `/agents` - Manage AI agents
- `/cost` - Calculate API costs
- `/config` - Configuration management
- `/memory` - Memory system control
- `/review` - Code review
- `/add-dir` - Add working directories
- `/rewind` - Rewind conversation/code
- `/usage` - Show usage limits

### 14. WSL Integration
Full Windows Subsystem for Linux support:
- Configure WSL distribution
- Custom Node.js and Claude paths
- Seamless Linux environment integration

### 15. Enhanced UI/UX
- **Stop Button** - Properly terminates running prompts
- **Loading Indicators** - Clear operation feedback
- **Error Messages** - Helpful suggestions
- **Keyboard Shortcuts** - `Ctrl+Shift+C` / `Cmd+Shift+C`
- **Status Bar** - Shows current model
- **Touch Bar** - macOS support
- **Sidebar Integration** - Full chat in sidebar

---

## Advanced Features

### Advanced Context Engine
Inspired by research from Anthropic, Manus AI, LangChain, Mem0, and Cursor:

- **Priority-based Management** - Priompt-like priority system
- **Multi-tier Priorities** - Critical > High > Medium > Low > Disposable
- **Memory Decay** - Older context gradually deprioritized
- **Graph-based Memory** - Mem0-style with conflict detection
- **Semantic Chunking** - Intelligent content segmentation
- **KV-Cache Awareness** - Optimized for Claude's architecture
- **Self-verification Integration** - Validated responses

### Self-Verification Engine
- **Response Validation** - Checks for common issues
- **Code Lint Integration** - VS Code diagnostics integration
- **Consistency Checking** - Aligns with project context
- **Self-correction** - Proposes fixes for detected issues
- **Quality Scoring** - Rates response quality (0-100)

### Smart Memory Manager
- **Prompt Analysis** - Classifies intent (task, question, code, fix, review)
- **Keyword Extraction** - Identifies relevant keywords
- **Entity Linking** - Links to project entities
- **Token Budgeting** - Prevents "prompt too long" errors
- **Relevance Selection** - Injects only necessary context

---

## Configuration Options

Access via `File > Preferences > Settings > Claude CodeUI by NexaLance`

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeCodeChat.model.default` | `sonnet` | Default Claude model |
| `claudeCodeChat.model.maxTokens` | `16384` | Max output tokens (1024-128000) |
| `claudeCodeChat.thinking.intensity` | `think` | Thinking mode intensity |
| `claudeCodeChat.permissions.mode` | `default` | Permission mode |
| `claudeCodeChat.permissions.yoloMode` | `false` | Enable YOLO mode |
| `claudeCodeChat.memory.autoInject` | `true` | Auto-inject project memory |
| `claudeCodeChat.memory.maxContextSize` | `4000` | Max memory context chars |
| `claudeCodeChat.plan.mode` | `ask` | Planning mode |
| `claudeCodeChat.wsl.enabled` | `false` | Enable WSL integration |
| `claudeCodeChat.wsl.distro` | `Ubuntu` | WSL distribution |
| `claudeCodeChat.wsl.nodePath` | `/usr/bin/node` | Node.js path in WSL |
| `claudeCodeChat.wsl.claudePath` | `/usr/local/bin/claude` | Claude path in WSL |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Open Claude CodeUI |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `@` | Open file picker |
| `/` | Open slash commands |
| `Escape` | Close modals |

---

## Architecture & Code Quality

### Code Organization
```
src/
├── extension.ts              # Main entry point (4,961 lines)
├── types.ts                  # TypeScript definitions (828 lines, 50+ interfaces)
├── utils.ts                  # Utilities (663 lines)
├── ui.ts                     # Webview HTML (1,492 lines)
├── ui-styles.ts              # CSS styles (7,490 lines)
├── script.ts                 # Frontend JavaScript (6,337 lines)
├── checkpointManager.ts      # Checkpoint system (1,080 lines)
├── projectMemoryManager.ts   # Memory system (1,638 lines)
├── smartMemoryManager.ts     # Smart injection (813 lines)
├── projectContextManager.ts  # Context persistence (1,036 lines)
├── contextWindowManager.ts   # Token management (1,094 lines)
├── advancedContextEngine.ts  # Context engine (1,523 lines)
├── selfVerificationEngine.ts # Verification (850 lines)
└── docsManager.ts            # Documentation (851 lines)
```

### Storage Structure
```
.claude/
├── memory/
│   ├── memory.jsonl          # Entity store (append-only)
│   ├── memory-index.json     # Inverted search index
│   ├── memory-graph.json     # Relationship graph
│   └── scratchpad.json       # Active context
├── context/
│   ├── sessions/             # Conversation sessions
│   └── snapshots/            # Manual backups
├── checkpoints/
│   ├── index.json            # Checkpoint metadata
│   ├── hash-cache.json       # SHA-256 cache
│   └── backups/              # Checkpoint data
├── agents/                   # AI agent definitions
├── commands/                 # Slash commands
├── hooks/                    # Python lifecycle hooks
├── docs/                     # Indexed documentation
└── skills/                   # Skill definitions
```

### Type Safety
- Full TypeScript with strict mode
- 50+ typed interfaces
- No `any` types in critical paths
- Comprehensive type definitions

### Performance Optimizations
- **LRU Caching** - 30-second TTL for workspace files
- **Debouncing** - 150ms for search operations
- **Throttling** - Rate-limited async operations
- **Inverted Index** - O(1) memory search
- **Lazy Initialization** - On-demand resource loading
- **File Hash Caching** - SHA-256 change detection
- **Auto-save Locking** - Race condition prevention

### Error Handling
- Comprehensive error boundaries
- Safe async operation wrappers
- User-friendly error messages
- Automatic retry with exponential backoff
- Proper dispose patterns
- No memory leaks

---

## Usage Examples

### Code Review
```
You: @src/components/UserProfile.tsx Can you review this component?

Claude: I'll analyze your UserProfile component...
[Detailed analysis with suggestions]
```

### Safe Experimentation
```
You: Refactor this to use React hooks

Claude: I'll create a checkpoint first so you can restore if needed.
[Creates automatic checkpoint]
[Shows refactored implementation]

Click "Restore Checkpoint" to revert if needed.
```

### Project Analysis
```
You: Analyze the architecture of my project

Claude: I'll examine your project structure...
[Comprehensive architecture overview]
```

---

## Troubleshooting

### Claude not found
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### Stop button not working
The extension uses process group killing. If issues persist:
```bash
ps aux | grep claude
pkill -f claude
```

### Memory not persisting
Ensure `.claude/` directory is not in your `.gitignore`

### WSL Issues
```bash
wsl --list --verbose
```

---

## Development

### Building
```bash
npm install
npm run compile
npm run watch  # For development
```

### Testing
```bash
npm run lint
npm test
```

### Packaging
```bash
npx vsce package --no-dependencies
```

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Credits

### Original Project
- **[claude-code-chat](https://github.com/andrepimenta/claude-code-chat)** by **Andre Pimenta**
- Thank you for the excellent foundation that made this enhanced version possible!

### Enhanced Version
- **Claude CodeUI by NexaLance** by **Developer Jillur**
- Built with Claude by Anthropic

### Research Inspirations
- Anthropic's Context Engineering Guide
- Manus AI's context engineering lessons
- LangChain's agent patterns
- Mem0's graph-based memory architecture
- Cursor's Priompt and Shadow Workspace patterns

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/developerjillur/claude-codeUI-by-nexalance/issues)
- **Repository**: [GitHub](https://github.com/developerjillur/claude-codeUI-by-nexalance)

---

**Made with love by [Developer Jillur](https://github.com/developerjillur) | [NexaLance](https://nexalance.com)**

**Star us on GitHub if this project helped you!**
