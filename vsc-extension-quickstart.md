# Claude CodeUI by NexaLance - Developer Quick Start Guide

Welcome to the Claude CodeUI by NexaLance extension development guide. This document will help you understand the project structure, set up your development environment, and start contributing.

---

## Project Overview

Claude CodeUI by NexaLance is an enterprise-grade VS Code extension that provides a beautiful chat interface for Claude Code CLI. Built upon the foundation of [claude-code-chat](https://github.com/andrepimenta/claude-code-chat) by Andre Pimenta.

**Key Stats:**
- 30,000+ lines of TypeScript code
- 8 specialized manager systems
- 50+ TypeScript interfaces
- Zero runtime dependencies

---

## Project Structure

```
claude-codeUI-by-nexalance/
├── src/
│   ├── extension.ts              # Main entry point (4,961 lines)
│   │                             # - Extension activation/deactivation
│   │                             # - Command registration
│   │                             # - Webview panel management
│   │                             # - Claude CLI integration
│   │
│   ├── types.ts                  # TypeScript definitions (828 lines)
│   │                             # - 50+ interfaces
│   │                             # - Message types
│   │                             # - Entity types
│   │
│   ├── utils.ts                  # Utilities (663 lines)
│   │                             # - LRU Cache implementation
│   │                             # - Debounce/Throttle functions
│   │                             # - Safe async wrappers
│   │
│   ├── ui.ts                     # Webview HTML (1,492 lines)
│   │                             # - HTML template generation
│   │                             # - UI component structure
│   │
│   ├── ui-styles.ts              # CSS styles (7,490 lines)
│   │                             # - Theme support (light/dark)
│   │                             # - Responsive design
│   │                             # - Component styling
│   │
│   ├── script.ts                 # Frontend JavaScript (6,337 lines)
│   │                             # - Message handling
│   │                             # - UI interactions
│   │                             # - Streaming responses
│   │
│   ├── checkpointManager.ts      # Checkpoint system (1,080 lines)
│   │                             # - SHA-256 file hashing
│   │                             # - Git-based storage
│   │                             # - Restore with preview
│   │
│   ├── projectMemoryManager.ts   # Memory system (1,638 lines)
│   │                             # - Knowledge graph
│   │                             # - Inverted index search
│   │                             # - Entity/relation storage
│   │
│   ├── smartMemoryManager.ts     # Smart injection (813 lines)
│   │                             # - Prompt analysis
│   │                             # - Token budgeting
│   │                             # - Context selection
│   │
│   ├── projectContextManager.ts  # Context persistence (1,036 lines)
│   │                             # - Session auto-save
│   │                             # - Snapshot management
│   │                             # - History tracking
│   │
│   ├── contextWindowManager.ts   # Token management (1,094 lines)
│   │                             # - Token tracking
│   │                             # - Auto-compression
│   │                             # - Model-aware limits
│   │
│   ├── advancedContextEngine.ts  # Context engine (1,523 lines)
│   │                             # - Priority-based management
│   │                             # - Memory decay
│   │                             # - Graph-based memory
│   │
│   ├── selfVerificationEngine.ts # Verification (850 lines)
│   │                             # - Response validation
│   │                             # - Code lint integration
│   │                             # - Quality scoring
│   │
│   └── docsManager.ts            # Documentation (851 lines)
│                                 # - URL indexing
│                                 # - Documentation crawling
│                                 # - Search functionality
│
├── templates/                    # User templates
│   ├── agents/                   # AI agent definitions
│   ├── commands/                 # Slash commands
│   ├── hooks/                    # Python lifecycle hooks
│   └── skills/                   # Skill definitions
│
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
├── README.md                     # User documentation
├── CHANGELOG.md                  # Version history
└── LICENSE                       # MIT License
```

---

## Getting Started

### Prerequisites

1. **Node.js** (v18 or later)
2. **VS Code** (v1.94.0 or later)
3. **Claude Code CLI** installed globally:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/developerjillur/claude-codeUI-by-nexalance.git
   cd claude-codeUI-by-nexalance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Open in VS Code:
   ```bash
   code .
   ```

---

## Development Workflow

### Running the Extension

1. Press `F5` to launch a new VS Code window with the extension loaded
2. Open the Claude CodeUI:
   - Press `Ctrl+Shift+C` (or `Cmd+Shift+C` on macOS)
   - Or use Command Palette: "Open Claude CodeUI"
3. The extension will connect to Claude Code CLI

### Watch Mode

For continuous compilation during development:
```bash
npm run watch
```

### Debugging

1. Set breakpoints in `src/extension.ts` or other source files
2. Press `F5` to start debugging
3. Check the Debug Console for output
4. Use the debugger to step through code

### Reloading Changes

After making changes:
- **TypeScript changes**: Reload the Extension Development Host window (`Ctrl+R` or `Cmd+R`)
- **Webview changes**: Close and reopen the Claude CodeUI panel

---

## Key Components

### 1. Extension Entry Point (`extension.ts`)

The main file handles:
- Extension activation (`activate` function)
- Command registration (`claude-code-chat.openChat`)
- Webview panel creation and management
- Message handling between VS Code and webview
- Claude CLI process management

### 2. Manager Systems

Each manager is a separate class with specific responsibilities:

| Manager | Purpose |
|---------|---------|
| `CheckpointManager` | Git-based file checkpoints with SHA-256 hashing |
| `ProjectMemoryManager` | Knowledge graph with inverted index |
| `SmartMemoryManager` | Intelligent context injection |
| `ProjectContextManager` | Session persistence and auto-save |
| `ContextWindowManager` | Token tracking and compression |
| `AdvancedContextEngine` | Priority-based context management |
| `SelfVerificationEngine` | Response validation |
| `DocsManager` | External documentation indexing |

### 3. Webview Components

The webview is built with vanilla JavaScript and CSS:
- `ui.ts` - HTML template generation
- `ui-styles.ts` - CSS styling (7,490 lines)
- `script.ts` - Frontend JavaScript (6,337 lines)

---

## Testing

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Manual Testing

1. Test the chat interface:
   - Send messages
   - Check streaming responses
   - Verify code highlighting

2. Test checkpoints:
   - Create a checkpoint
   - Make changes
   - Restore checkpoint

3. Test memory system:
   - Add entities
   - Search memory
   - Verify persistence

4. Test context management:
   - Monitor token usage
   - Trigger auto-compression
   - Verify context preservation

---

## Building for Production

### Create VSIX Package

```bash
npx vsce package --no-dependencies
```

This creates a `.vsix` file that can be installed in VS Code.

### Pre-publish Check

```bash
npm run vscode:prepublish
```

---

## Code Style Guidelines

### TypeScript

- Use strict mode (`"strict": true` in tsconfig.json)
- Define interfaces in `types.ts`
- Avoid `any` types in critical paths
- Use meaningful variable names

### Error Handling

- Use try-catch for async operations
- Provide user-friendly error messages
- Log errors for debugging

### Performance

- Use LRU caching for repeated operations
- Debounce search operations
- Lazy-load resources

---

## Contributing

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Run tests and linting:
   ```bash
   npm run lint
   npm test
   ```
5. Commit your changes:
   ```bash
   git commit -m "Add your feature"
   ```
6. Push and create a Pull Request

---

## Useful Resources

### VS Code Extension API

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)

### Project Links

- **Original Project**: [claude-code-chat](https://github.com/andrepimenta/claude-code-chat)
- **Enhanced Version**: [Claude CodeUI by NexaLance](https://github.com/developerjillur/claude-codeUI-by-nexalance)
- **Claude Code CLI**: [Anthropic Claude Code](https://www.anthropic.com/claude-code)

---

## Troubleshooting Development Issues

### Extension not loading

1. Check the Debug Console for errors
2. Ensure TypeScript compiled successfully
3. Verify `out/extension.js` exists

### Webview not displaying

1. Check for JavaScript errors in the webview console (right-click > Inspect)
2. Verify HTML template generation in `ui.ts`
3. Check CSS for styling issues

### Claude CLI not connecting

1. Verify Claude Code CLI is installed: `claude --version`
2. Check Claude is authenticated: `claude login`
3. Review process spawn in `extension.ts`

### Memory not persisting

1. Verify `.claude/` directory exists
2. Check file permissions
3. Review JSONL format in memory files

---

## Credits

- **Original Author**: Andre Pimenta ([@andrepimenta](https://github.com/andrepimenta))
- **Enhanced By**: Developer Jillur ([@developerjillur](https://github.com/developerjillur))

---

**Happy Coding!**
