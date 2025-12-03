# /recall - Search Project Memory

Search and retrieve information from the project memory system.

## Usage

```
/recall <query>
/recall --type <entity_type> <query>
/recall --recent [count]
/recall --all
```

## Examples

```
/recall database configuration
/recall --type decision authentication
/recall --recent 10
/recall --type goal
```

## Query Syntax

### Simple Search
```
/recall authentication
```
Searches all entity names, observations, and tags.

### Type Filter
```
/recall --type decision
```
Only search entities of a specific type:
- `task`: Tasks worked on
- `goal`: Project goals
- `decision`: Decisions made
- `file`: Files modified
- `url`: URLs referenced
- `pattern`: Code patterns
- `note`: General notes
- `error`: Errors encountered

### Combined Search
```
/recall --type decision database
```
Search for "database" only in decision entities.

### Recent Items
```
/recall --recent 20
```
Show the 20 most recently added items.

### All Items (by type)
```
/recall --all --type goal
```
List all goals in the system.

## Output Format

```
📝 Found 3 results for "database"

1. decision:use_postgresql (high importance)
   Created: 2024-12-02
   "We decided to use PostgreSQL for better relational support"
   Tags: database, postgresql
   Related: task:setup_database, file:src/db/config.ts

2. file:src/database/migrations/ (normal importance)
   Last modified: 2024-12-01
   "Database migration files"
   Related: decision:use_postgresql

3. note:database_schema (normal importance)
   Created: 2024-11-30
   "Initial schema design with users, posts, comments tables"
   Tags: schema, design
```

## Search Scoring

Results are ranked by:
1. **Exact matches**: Query found in entity name
2. **Tag matches**: Query matches a tag
3. **Observation matches**: Query found in observations
4. **Importance boost**: Higher importance = higher rank
5. **Recency boost**: Recent items slightly favored

## Context Retrieval

For tasks, /recall can provide context:
```
/recall --context task:implement_auth
```

Output includes:
- Task details
- Related goals
- Files involved
- Decisions made
- Errors encountered
- Timeline of activity

## Graph Navigation

Navigate related entities:
```
/recall --related decision:use_postgresql
```

Shows entities connected to the specified one.

## Export

Export results for external use:
```
/recall --export json database
/recall --export markdown --type decision
```

## Tips

1. **Be specific**: "postgresql config" better than "config"
2. **Use types**: Narrow search with --type
3. **Check related**: Found something? Check --related
4. **Recent first**: Use --recent for latest activity

## Integration

Results from /recall can be:
- Injected into Claude's context
- Used by other commands
- Displayed in VS Code extension

## Implementation

This command:
1. Parses query and options
2. Loads memory index
3. Performs search
4. Ranks and filters results
5. Formats output
6. Optionally injects into context
