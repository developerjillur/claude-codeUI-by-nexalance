#!/usr/bin/env python3
"""
PostToolUse Hook - Captures all tool executions for memory storage
This hook runs after every tool use in Claude Code.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.memory_client import get_memory_client
from utils.secure_filter import get_secure_filter
from utils.entity_extractor import extract_from_tool

def main():
    """Process tool use event from stdin."""
    try:
        # Read hook input from stdin
        hook_input = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        # No valid input, exit silently
        sys.exit(0)

    # Extract tool information
    tool_name = hook_input.get('tool_name', '')
    tool_input = hook_input.get('tool_input', {})
    tool_output = hook_input.get('tool_output', '')
    session_id = hook_input.get('session_id', 'unknown')

    if not tool_name:
        sys.exit(0)

    # Initialize clients
    memory = get_memory_client()
    secure_filter = get_secure_filter()

    # Check for sensitive data in tool input and output
    blocked_items = []

    # Filter tool input
    if isinstance(tool_input, dict):
        filtered_input, input_blocked = secure_filter.filter_for_storage(tool_input)
        blocked_items.extend(input_blocked)
    else:
        filtered_input = tool_input

    # Check tool output for sensitive data
    output_preview = ''
    if tool_output:
        output_str = str(tool_output)[:500]
        if secure_filter.contains_sensitive(output_str):
            redacted_output, output_matches = secure_filter.redact(output_str)
            output_preview = redacted_output
            for match in output_matches:
                blocked_items.append({
                    'field': 'tool_output',
                    'types': [match.type.value]
                })
        else:
            output_preview = output_str

    # Log blocked sensitive data
    for blocked in blocked_items:
        memory.log_sensitive_blocked(
            pattern_type=','.join(blocked.get('types', ['unknown'])),
            source=f"tool:{tool_name}",
            context=f"Field: {blocked.get('field', 'unknown')}"
        )

    # Create raw event record
    event = {
        'event_type': 'tool_use',
        'tool_name': tool_name,
        'tool_input': filtered_input,
        'output_preview': output_preview[:200] if output_preview else '',
        'session_id': session_id,
        'had_sensitive_data': len(blocked_items) > 0
    }

    # Append to raw events
    memory.append_raw_event(event)

    # Extract entities from tool use
    entities = extract_from_tool(tool_name, tool_input, tool_output)

    # Store extracted entities
    for entity in entities:
        memory.create_entity(
            name=entity.name,
            entity_type=entity.type.value,
            observations=entity.observations,
            metadata={
                **entity.metadata,
                'confidence': entity.confidence,
                'source': entity.source
            }
        )

    # Update scratchpad with recent activity
    scratchpad = memory.get_scratchpad()
    recent_context = scratchpad.get('recentContext', [])

    # Add this tool use to recent context
    context_entry = {
        'type': 'tool_use',
        'tool': tool_name,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }

    # Add relevant details based on tool type
    if tool_name in ['Read', 'Write', 'Edit']:
        context_entry['file'] = filtered_input.get('file_path', '')
    elif tool_name == 'WebFetch':
        context_entry['url'] = filtered_input.get('url', '')
    elif tool_name == 'Bash':
        cmd = filtered_input.get('command', '')
        context_entry['command'] = cmd[:50] + '...' if len(cmd) > 50 else cmd

    recent_context.append(context_entry)

    # Keep only last 20 context entries
    if len(recent_context) > 20:
        recent_context = recent_context[-20:]

    memory.update_scratchpad({
        'recentContext': recent_context,
        'sessionId': session_id
    })

    # Output nothing (hook should be silent on success)
    sys.exit(0)

if __name__ == '__main__':
    main()
