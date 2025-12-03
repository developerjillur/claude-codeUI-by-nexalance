# /remember - Store Information in Project Memory

Store important information, decisions, notes, or context in the project memory system.

## Usage

```
/remember <information>
```

## Examples

```
/remember We decided to use PostgreSQL instead of MongoDB for better relational data support
/remember The API rate limit is 100 requests per minute
/remember Login page design approved by client on Dec 2, 2024
/remember Admin credentials are stored in 1Password vault "Project X"
```

## What to Remember

Good candidates for memory storage:
- **Decisions**: Why a particular approach was chosen
- **Architecture notes**: System design choices
- **Important URLs**: Documentation, admin panels, APIs
- **Credentials references**: Where passwords are stored (never the actual values!)
- **Meeting notes**: Key points from discussions
- **Requirements**: User stories, acceptance criteria
- **Blockers**: Issues that need attention
- **Patterns**: Coding conventions, design patterns used

## Automatic Processing

When you use /remember:
1. Information is checked for sensitive data (credentials blocked)
2. Entity type is automatically detected (decision, note, url, etc.)
3. Related entities are linked
4. Information is indexed for future search
5. Importance is assessed based on keywords

## Entity Types

Based on content, /remember creates:
- `decision`: Choices made, alternatives rejected
- `note`: General information
- `url`: Links to resources
- `requirement`: User requirements, acceptance criteria
- `blocker`: Issues blocking progress
- `pattern`: Code patterns, conventions

## Importance Detection

Keywords that increase importance:
- "critical", "important", "must", "required" → high
- "security", "credential", "password", "secret" → high (but values blocked)
- "nice to have", "optional", "later" → low

## Output

After remembering:
```
✓ Stored as: decision_use_postgresql
  Type: decision
  Importance: high
  Tags: database, postgresql, mongodb

  Related entities found:
  - file:src/database/config.ts
  - task:setup_database
```

## Retrieving

Use `/recall` to search stored memories:
```
/recall postgresql decision
```

## Security

**CRITICAL**: Never store actual credentials!

✅ Good: `/remember Admin credentials are in 1Password under "Project Secrets"`
❌ Bad: `/remember Admin password is abc123`

Sensitive data is automatically detected and blocked.

## Implementation

This command:
1. Parses the input text
2. Runs security filter
3. Extracts entities
4. Stores in `.claude/memory.jsonl`
5. Updates search index
6. Updates relation graph
7. Returns confirmation
