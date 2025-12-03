#!/usr/bin/env python3
"""
Stop Hook - Session end consolidation and summary generation
This hook runs when a Claude Code session ends.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path
from collections import Counter

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.memory_client import get_memory_client

def main():
    """Process session end and create summary."""
    try:
        # Read hook input from stdin
        hook_input = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        hook_input = {}

    session_id = hook_input.get('session_id', f"session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")

    # Initialize memory client
    memory = get_memory_client()

    # Get recent events for this session
    recent_events = memory.get_recent_events(limit=100)

    # Filter events for this session
    session_events = [e for e in recent_events if e.get('session_id') == session_id]

    if not session_events:
        # Try to get all recent events if session filtering fails
        session_events = recent_events[-50:]

    # Analyze session activity
    summary = analyze_session(session_events)
    summary['sessionId'] = session_id
    summary['endedAt'] = datetime.utcnow().isoformat() + 'Z'

    # Save session summary
    memory.save_session_summary(session_id, summary)

    # Update scratchpad to mark session complete
    scratchpad = memory.get_scratchpad()

    # Move current tasks to history
    current_tasks = scratchpad.get('currentTasks', [])
    for task in current_tasks:
        task['status'] = 'session_ended'
        task['sessionEndedAt'] = summary['endedAt']

    # Create session entity in memory
    memory.create_entity(
        name=f"session:{session_id}",
        entity_type='session',
        observations=[
            f"Session ended at {summary['endedAt']}",
            f"Tools used: {', '.join(summary.get('toolsUsed', [])[:5])}",
            f"Files modified: {summary.get('filesModified', 0)}",
            f"Total events: {summary.get('totalEvents', 0)}"
        ],
        metadata={
            'importance': 'normal',
            'summary': summary,
            'duration': calculate_duration(session_events)
        }
    )

    # Clear scratchpad for next session
    memory.update_scratchpad({
        'currentTasks': [],
        'recentContext': [],
        'sessionId': None,
        'lastSessionSummary': summary
    })

    # Create completion entity for tasks that were worked on
    for task in current_tasks:
        memory.add_observation(
            entity_name=task.get('name', ''),
            observation=f"Task was active during session {session_id}"
        )

    sys.exit(0)

def analyze_session(events: list) -> dict:
    """Analyze session events and create a summary."""
    summary = {
        'totalEvents': len(events),
        'toolsUsed': [],
        'filesModified': 0,
        'filesRead': 0,
        'urlsFetched': 0,
        'commandsRun': 0,
        'promptCount': 0,
        'entitiesCreated': 0,
        'errorsEncountered': 0,
        'sensitiveDataBlocked': 0
    }

    tool_counter = Counter()
    files_modified = set()
    files_read = set()
    urls_fetched = set()

    for event in events:
        event_type = event.get('event_type', '')

        if event_type == 'tool_use':
            tool_name = event.get('tool_name', '')
            tool_counter[tool_name] += 1

            tool_input = event.get('tool_input', {})

            if tool_name in ['Write', 'Edit']:
                file_path = tool_input.get('file_path', '')
                if file_path:
                    files_modified.add(file_path)
            elif tool_name == 'Read':
                file_path = tool_input.get('file_path', '')
                if file_path:
                    files_read.add(file_path)
            elif tool_name == 'WebFetch':
                url = tool_input.get('url', '')
                if url:
                    urls_fetched.add(url)
            elif tool_name == 'Bash':
                summary['commandsRun'] += 1

            if event.get('had_sensitive_data'):
                summary['sensitiveDataBlocked'] += 1

        elif event_type == 'user_prompt':
            summary['promptCount'] += 1
            if event.get('had_sensitive_data'):
                summary['sensitiveDataBlocked'] += 1

    summary['toolsUsed'] = [tool for tool, _ in tool_counter.most_common(10)]
    summary['toolUsageCounts'] = dict(tool_counter)
    summary['filesModified'] = len(files_modified)
    summary['filesRead'] = len(files_read)
    summary['urlsFetched'] = len(urls_fetched)
    summary['modifiedFilesList'] = list(files_modified)[:20]
    summary['readFilesList'] = list(files_read)[:20]
    summary['fetchedUrlsList'] = list(urls_fetched)[:10]

    return summary

def calculate_duration(events: list) -> str:
    """Calculate session duration from events."""
    if not events:
        return 'unknown'

    timestamps = []
    for event in events:
        ts = event.get('timestamp')
        if ts:
            try:
                timestamps.append(datetime.fromisoformat(ts.replace('Z', '+00:00')))
            except ValueError:
                continue

    if len(timestamps) < 2:
        return 'unknown'

    timestamps.sort()
    duration = timestamps[-1] - timestamps[0]

    # Format duration
    total_seconds = int(duration.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours > 0:
        return f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        return f"{minutes}m {seconds}s"
    else:
        return f"{seconds}s"

if __name__ == '__main__':
    main()
