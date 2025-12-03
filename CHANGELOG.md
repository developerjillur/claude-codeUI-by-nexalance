# Change Log

All notable changes to the "Claude CodeUI by NexaLance" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

---

## [2.2.0] - 2025-12-03

### Major Documentation & Release Update

This release represents the official public release of Claude CodeUI by NexaLance with comprehensive documentation and all enhancements clearly documented.

### Acknowledgments

This extension is built upon the excellent foundation of [claude-code-chat](https://github.com/andrepimenta/claude-code-chat) by **Andre Pimenta**. We extend our sincere gratitude for creating the original extension that inspired this enhanced version.

### New Manager Systems (8 Specialized Modules)

#### 1. Advanced Context Engine (`advancedContextEngine.ts` - 1,523 lines)
- **Priompt-inspired priority system** for intelligent context management
- Multi-tier priority levels: Critical > High > Medium > Low > Disposable
- Memory decay and consolidation algorithms
- Graph-based memory with conflict detection (Mem0-style)
- Semantic chunking and retrieval
- KV-Cache optimization awareness
- Self-verification loop integration

#### 2. Project Memory Manager (`projectMemoryManager.ts` - 1,638 lines)
- **Knowledge graph architecture** with entities and relations
- **11 entity types**: project, task, file, decision, pattern, bug, feature, dependency, architecture, conversation, milestone
- **Inverted index search** with O(1) lookup performance
- JSONL append-only storage for reliability
- Observation deduplication with Set-based O(1) efficiency
- Memory export and import functionality

#### 3. Smart Memory Manager (`smartMemoryManager.ts` - 813 lines)
- **Prompt analysis** with intent classification (task, question, code, fix, review, general)
- Keyword extraction and entity linking
- **Token budget management** to prevent "prompt too long" errors
- Relevance-based memory selection
- Intelligent context injection

#### 4. Checkpoint Manager (`checkpointManager.ts` - 1,080 lines)
- **SHA-256 file hash caching** for efficient change detection
- Support for **20,000+ files** in large projects
- Incremental and full checkpoint modes
- Git-based reliable storage
- One-click restore with preview
- Backup protection before any restore
- Undo restore capability

#### 5. Context Window Manager (`contextWindowManager.ts` - 1,094 lines)
- **Real-time token tracking**
- Auto-compression at 90% usage threshold
- Target compression ratio: 50-60%
- Smart summarization preserving critical information
- Model-aware token limits
- Priority-based message preservation

#### 6. Project Context Manager (`projectContextManager.ts` - 1,036 lines)
- **Session persistence** to `.claude/context/`
- Auto-save every 30 seconds with race condition protection
- Manual context snapshots
- AI-generated session summaries
- Quick session restoration

#### 7. Self-Verification Engine (`selfVerificationEngine.ts` - 850 lines)
- Response validation for common issues
- **Code lint integration** via VS Code diagnostics
- Consistency checking against project context
- Self-correction suggestions
- Quality scoring (0-100)

#### 8. Documentation Manager (`docsManager.ts` - 851 lines)
- External documentation URL indexing
- Smart documentation crawling
- Cross-documentation search
- `@Docs` reference in prompts

### Type Safety & Utilities

#### Types (`types.ts` - 828 lines)
- **50+ TypeScript interfaces** for comprehensive type safety
- Strict mode enabled
- No `any` types in critical paths

#### Utilities (`utils.ts` - 663 lines)
- **LRU Cache** implementation with TTL support
- Debounce and throttle functions
- Safe async operation wrappers
- Error boundary utilities

### Performance Optimizations
- LRU caching with 30-second TTL for workspace files
- Search operations debounced at 150ms
- Rate-limited async operations
- Lazy initialization of resources
- File hash caching with SHA-256
- Auto-save locking to prevent race conditions

### UI/UX Enhancements
- Tree-style message formatting with bullet points
- Message separation with subtle borders
- Improved syntax highlighting
- Enhanced error messages with suggestions
- Activity panel for running tasks
- Todo progress tracking panel

---

## [2.1.51] - 2025-11-28

### Bug Fixes
- Fixed icon and display name updates
- Code organization improvements

---

## [2.1.50] - 2025-11-25

### Features Added
- Added more built-in slash commands
- Enhanced command descriptions

---

## [1.0.7] - 2025-10-01

### Features Added
- **Slash Commands Update**: Added 4 new slash commands to the commands modal
  - `/add-dir` - Add additional working directories
  - `/agents` - Manage custom AI subagents for specialized tasks
  - `/rewind` - Rewind the conversation and/or code
  - `/usage` - Show plan usage limits and rate limit status (subscription plans only)

### Documentation Updates
- Updated slash commands count from 19+ to 23+ built-in commands
- Enhanced command descriptions for better clarity

---

## [1.0.6] - 2025-08-26

### Bug Fixes
- Fixed typo in codebase
- Removed priority settings that were no longer needed

### Technical Improvements
- Moved script to separate file for better code organization

---

## [1.0.5] - 2025-07-30

### Features Added
- **MCP Integration**: Added claude-code-chat-permissions-mcp folder for enhanced permission management
- **Message Persistence**: Save message in text box for better user experience
- **UI Improvements**: Always display history and new chat options
- **Input Enhancement**: Removed maxlength limit for custom command prompt textarea

### Bug Fixes
- Fixed new chat functionality
- Fixed request start time isProcessing issue
- Fixed close and open conversation behavior

---

## [1.0.4] - 2025-01-22

### Bug Fixes
- Fixed input text area overflow issue
- Fixed command parameter handling for different invocation contexts

### Technical Improvements
- Enhanced `show()` method with optional ViewColumn parameter
- Improved webview panel positioning

---

## [1.0.0] - 2025-01-15

### Major Features Added

#### Advanced Permissions Management System
- Complete permissions framework with MCP integration
- Interactive permission dialogs with command previews
- "Always Allow" functionality with smart pattern matching
- YOLO mode for power users
- Workspace-specific permission storage

#### MCP (Model Context Protocol) Server Management
- Complete MCP server configuration interface
- Popular MCP servers gallery with one-click installation
- Custom MCP server creation with validation
- WSL path conversion for cross-platform compatibility

#### Sidebar Integration & Multi-Panel Support
- Native VS Code sidebar view with full chat functionality
- Smart panel management
- Persistent session state across panel switches

#### Image & Clipboard Enhancements
- Drag-and-drop image support
- Clipboard image paste (Ctrl+V)
- Multiple image selection
- Automatic image organization in `.claude/claude-code-chat-images/`

#### Code Block & Syntax Improvements
- Enhanced markdown parsing
- Syntax highlighting for code blocks
- Copy-to-clipboard functionality

### UI/UX Improvements
- Comprehensive settings modal
- YOLO mode toggle with visual warnings
- Real-time settings synchronization
- Improved message spacing

### Technical Enhancements
- Persistent session state
- Enhanced WSL support
- Performance optimizations
- Better error handling

---

## [0.1.3] - 2025-06-24

### Features Added
- MultiEdit and Edit Tool Diff Display
- Enhanced Tool Result Management

### UI/UX Improvements
- Thinking Intensity Modal Enhancement
- Consistent Message Spacing
- Refined Visual Design

---

## [0.1.2] - 2025-06-20

### Bug Fixes
- Fixed markdown parsing for underscores in code identifiers
- Always show New Chat button

---

## [0.1.0] - 2025-06-20

### Major Features Added

#### Interactive Thinking Mode
- 4 intensity levels: Think, Think Hard, Think Harder, Ultrathink
- Beautiful slider interface
- Settings persist across sessions

#### Plan First Mode
- Toggle for "Plan First" mode
- Requires user approval before implementation

#### Slash Commands Modal System
- Type "/" to open commands modal with 19+ commands
- Custom command input
- Session-aware execution

#### Enhanced Model Configuration
- Updated model selection UI
- Configure button for terminal model setup

---

## [0.0.9] - 2025-06-19

### Added
- Model selector dropdown (Opus, Sonnet, Default)
- Model preference persistence

---

## [0.0.8] - 2025-06-19

### Added
- WSL (Windows Subsystem for Linux) configuration support
- Automatic detection of execution environment

---

## [0.0.7] - Previous Release

- Initial release based on claude-code-chat

---

## Credits

This extension is an enhanced version of [claude-code-chat](https://github.com/andrepimenta/claude-code-chat) by **Andre Pimenta**.

**Original Author**: Andre Pimenta ([@andrepimenta](https://github.com/andrepimenta))

**Enhanced By**: Developer Jillur ([@developerjillur](https://github.com/developerjillur))

We are deeply grateful for the original work that made this enhanced version possible.

---

**Made with love by [Developer Jillur](https://github.com/developerjillur) | [NexaLance](https://nexalance.com)**
