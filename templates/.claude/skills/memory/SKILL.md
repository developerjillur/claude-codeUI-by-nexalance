# Memory Skill

This skill enables Claude to autonomously access and manage project memory during conversations.

## Purpose

Allow Claude to:
- Store important information discovered during work
- Retrieve relevant context automatically
- Track tasks and goals
- Maintain continuity across sessions

## When to Use This Skill

Automatically activate when:
- Starting a new session (load relevant context)
- User mentions a topic that exists in memory
- Making decisions that should be remembered
- Completing tasks that relate to goals
- Encountering information worth preserving

## Available Operations

### Store Information
```
Store important context:
- Decisions made and their rationale
- Patterns discovered in the codebase
- Important URLs and resources
- Meeting notes and requirements
- Architecture decisions
```

### Retrieve Context
```
Search memory for:
- Related previous work
- Decisions affecting current task
- Patterns that might apply
- Goals the current work supports
```

### Track Progress
```
Update:
- Task completion status
- Goal progress
- Session activity
```

## Memory Files

| File | Purpose |
|------|---------|
| `.claude/memory.jsonl` | Structured entities |
| `.claude/memory-index.json` | Search index |
| `.claude/memory-graph.json` | Entity relations |
| `.claude/scratchpad.json` | Active context |

## Entity Types

- **task**: Work items being done
- **goal**: Project objectives
- **decision**: Choices made with rationale
- **file**: Important files tracked
- **url**: External resources
- **pattern**: Code patterns discovered
- **note**: General information
- **error**: Issues encountered

## Automatic Context Injection

At session start, automatically retrieve:
1. Active goals (from scratchpad)
2. Current tasks (from scratchpad)
3. Recent session summary
4. Related entities for files in context

## Store Operation

When encountering important information:

```python
# Example: Store a decision
memory.create_entity(
    name="decision_use_react_query",
    entity_type="decision",
    observations=[
        "Chose React Query over Redux for data fetching",
        "Better caching, simpler API, built-in loading states"
    ],
    metadata={
        "importance": "high",
        "tags": ["react", "data-fetching", "architecture"],
        "alternatives": ["redux", "swr"]
    }
)
```

## Retrieve Operation

Search for relevant context:

```python
# Example: Find related decisions
results = memory.search("authentication", entity_type="decision")
for result in results:
    print(f"Found: {result['name']} - Score: {result['score']}")
```

## Link Operation

Connect related entities:

```python
# Example: Link task to goal
memory.create_relation(
    from_entity="task_implement_login",
    to_entity="goal_authentication",
    relation_type="contributes_to"
)
```

## Progress Update

Track task/goal completion:

```python
# Example: Mark task complete
memory.add_observation(
    entity_name="task_implement_login",
    observation="Completed login implementation with OAuth support"
)

# Update goal progress
scratchpad = memory.get_scratchpad()
for goal in scratchpad['activeGoals']:
    if goal['name'] == 'goal_authentication':
        goal['progress'] = 60
memory.update_scratchpad(scratchpad)
```

## Security Considerations

**CRITICAL**: Always use secure_filter before storing:

```python
from utils.secure_filter import get_secure_filter

filter = get_secure_filter()
if filter.contains_sensitive(text):
    # Block storage, log incident
    memory.log_sensitive_blocked(...)
else:
    # Safe to store
    memory.create_entity(...)
```

## Best Practices

1. **Be proactive**: Store information before it's needed
2. **Be selective**: Not everything needs to be remembered
3. **Be precise**: Clear entity names and observations
4. **Be connected**: Link related entities
5. **Be secure**: Never store credentials

## Session Workflow

### Session Start
1. Load scratchpad
2. Get recent session summary
3. Retrieve entities for open files
4. Inject relevant context

### During Session
1. Monitor for important information
2. Extract and store entities
3. Track task progress
4. Update goal status

### Session End
1. Summarize session activity
2. Update task statuses
3. Calculate goal progress
4. Save session summary

## Integration Points

This skill integrates with:
- **Hooks**: Receive events from post_tool_use, user_prompt_submit
- **Agents**: memory-curator, goal-tracker, security-guardian
- **Commands**: /remember, /recall, /goals, /memory-status
- **VS Code Extension**: Context Manager UI

## Example Usage

Claude using this skill:

```
User: "Let's work on the authentication feature"

Claude: [Automatically retrieves context]
"I found relevant context in memory:
- Goal: goal_authentication (40% complete)
- Decision: Using Passport.js for OAuth
- Related files: src/auth/passport.ts, src/auth/login.ts
- Previous task: task_setup_oauth (completed)

Based on our previous decision to use Passport.js,
let me continue from where we left off..."

[During work]
Claude: [Stores decision]
"I've remembered that we're using JWT for session
tokens instead of cookies for better mobile support."

[At completion]
Claude: [Updates progress]
"I've updated the goal progress to 60% and marked
task_jwt_implementation as complete."
```
