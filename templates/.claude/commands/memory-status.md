# /memory-status - Memory System Health Check

View the status, statistics, and health of the project memory system.

## Usage

```
/memory-status              # Overview
/memory-status --full       # Detailed report
/memory-status --security   # Security scan
/memory-status --cleanup    # Suggest cleanups
```

## Overview Output

```
📊 Memory System Status

Storage:
  ├─ memory.jsonl:       1,245 entries (2.3 MB)
  ├─ memory-index.json:  856 entities indexed
  ├─ memory-graph.json:  423 relations
  ├─ raw-events.jsonl:   5,678 events (4.1 MB)
  └─ scratchpad.json:    3 active goals, 8 tasks

Entities by Type:
  tasks:     234 (45 active, 189 completed)
  decisions: 89
  files:     312
  goals:     15 (3 active, 12 completed)
  urls:      67
  patterns:  28
  notes:     111

Health: ✓ Good
  ✓ All files readable
  ✓ Index synchronized
  ✓ No sensitive data detected
  ✓ Last backup: 2 hours ago

Last Activity: 5 minutes ago
Sessions Tracked: 42
```

## Detailed Report

```
/memory-status --full
```

Additional information:
```
📊 Detailed Memory Report

== Storage Analysis ==
memory.jsonl:
  Size: 2.3 MB
  Entries: 1,245
  Oldest: 2024-10-15
  Newest: 2024-12-02
  Growth rate: ~30 entries/day

raw-events.jsonl:
  Size: 4.1 MB
  Events: 5,678
  Ready for consolidation: 1,234 events

== Entity Statistics ==
Tasks:
  - Active: 45
  - Completed: 189
  - Blocked: 3
  - Avg completion time: 2.3 days
  - Most active file: src/auth/login.ts (23 tasks)

Goals:
  - Active: 3
  - Progress: avg 67%
  - At risk: 1 (goal_deadline_feature)

Decisions:
  - Total: 89
  - Most referenced: decision:use_typescript (15 refs)

== Session History ==
Today: 3 sessions, 156 events
This week: 18 sessions, 892 events
This month: 42 sessions, 2,345 events

== Performance ==
Index search: <10ms average
File read: <50ms average
Write latency: <20ms average

== Recommendations ==
1. Consider consolidating raw events (1,234 pending)
2. Archive completed tasks older than 30 days
3. Review 3 blocked tasks for resolution
```

## Security Scan

```
/memory-status --security
```

```
🔒 Security Scan Results

Files Scanned: 6
Records Checked: 7,923

Status: ✓ SECURE

Blocked Items Log:
  Total blocked: 12
  Last blocked: 2024-12-02 (github_token)

Recent Blocks:
  [Dec 02] github_token in user_prompt
  [Dec 01] api_key in tool:Bash
  [Nov 30] password in user_prompt

Pattern Coverage:
  ✓ API keys (8 patterns)
  ✓ Passwords (5 patterns)
  ✓ Tokens (7 patterns)
  ✓ Connection strings (5 patterns)
  ✓ Private keys (4 patterns)

Recommendations:
  ✓ No action needed - system secure
```

## Cleanup Suggestions

```
/memory-status --cleanup
```

```
🧹 Cleanup Recommendations

1. Consolidate Raw Events
   1,234 events ready for processing
   Estimated size reduction: 2.1 MB
   Command: /memory-consolidate

2. Archive Old Tasks
   189 completed tasks older than 30 days
   Suggested action: Move to archive
   Command: /memory-archive --tasks --older 30d

3. Remove Duplicate Entities
   Found 23 potential duplicates
   Command: /memory-dedupe --preview

4. Update Stale Relations
   15 relations reference deleted entities
   Command: /memory-cleanup --relations

5. Optimize Index
   Index has 12% fragmentation
   Command: /memory-reindex

Estimated cleanup impact:
  - Storage: -3.2 MB (40% reduction)
  - Entities: -45 (duplicates removed)
  - Performance: +15% faster searches
```

## Health Indicators

| Status | Meaning |
|--------|---------|
| ✓ Good | All systems healthy |
| ⚠️ Warning | Minor issues detected |
| ❌ Error | Action required |

Warning conditions:
- Raw events > 5,000 not consolidated
- Index > 10% fragmented
- No backup in 24 hours
- Blocked sensitive data > 50

Error conditions:
- Corrupted files
- Index out of sync
- Sensitive data detected in storage
- Disk space critical

## Maintenance Commands

Based on status, available actions:

```
/memory-consolidate    # Process raw events
/memory-archive        # Archive old data
/memory-reindex        # Rebuild search index
/memory-backup         # Create backup
/memory-cleanup        # Remove stale data
/memory-verify         # Verify integrity
```

## Monitoring

For continuous monitoring:
```
/memory-status --watch
```

Updates every 30 seconds with live stats.

## Integration

Status is also shown in:
- VS Code Extension Context Manager
- Session summary (via Stop hook)
- Daily goal tracker report
