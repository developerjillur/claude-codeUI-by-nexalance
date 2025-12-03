#!/usr/bin/env python3
"""
UserPromptSubmit Hook - Analyzes user prompts and injects relevant context
This hook runs before each user prompt is processed.
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
from utils.entity_extractor import extract_entities, EntityType

def main():
    """Process user prompt from stdin and optionally inject context."""
    try:
        # Read hook input from stdin
        hook_input = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        # No valid input, exit silently
        sys.exit(0)

    prompt = hook_input.get('prompt', '')
    session_id = hook_input.get('session_id', 'unknown')

    if not prompt:
        sys.exit(0)

    # Initialize clients
    memory = get_memory_client()
    secure_filter = get_secure_filter()

    # Check for sensitive data in prompt
    if secure_filter.contains_sensitive(prompt):
        matches = secure_filter.scan(prompt)
        for match in matches:
            memory.log_sensitive_blocked(
                pattern_type=match.type.value,
                source='user_prompt',
                context=match.context
            )
        # Redact for storage
        prompt_for_storage, _ = secure_filter.redact(prompt)
    else:
        prompt_for_storage = prompt

    # Log the prompt as a raw event
    event = {
        'event_type': 'user_prompt',
        'prompt': prompt_for_storage[:1000],  # Limit size
        'session_id': session_id,
        'had_sensitive_data': secure_filter.contains_sensitive(prompt)
    }
    memory.append_raw_event(event)

    # Extract entities from the prompt
    entities = extract_entities(prompt)

    # Store extracted entities and track active tasks/goals
    active_tasks = []
    active_goals = []

    for entity in entities:
        entity_id = memory.create_entity(
            name=entity.name,
            entity_type=entity.type.value,
            observations=entity.observations,
            metadata={
                **entity.metadata,
                'confidence': entity.confidence,
                'source': entity.source
            }
        )

        if entity.type == EntityType.TASK:
            active_tasks.append({
                'id': entity_id,
                'name': entity.name,
                'status': 'active',
                'createdAt': datetime.utcnow().isoformat() + 'Z'
            })
        elif entity.type == EntityType.GOAL:
            active_goals.append({
                'id': entity_id,
                'name': entity.name,
                'status': 'active',
                'createdAt': datetime.utcnow().isoformat() + 'Z'
            })

    # Update scratchpad with current context
    scratchpad = memory.get_scratchpad()

    # Merge with existing tasks/goals
    existing_tasks = scratchpad.get('currentTasks', [])
    existing_goals = scratchpad.get('activeGoals', [])

    # Add new tasks (avoid duplicates by name)
    existing_task_names = {t.get('name') for t in existing_tasks}
    for task in active_tasks:
        if task['name'] not in existing_task_names:
            existing_tasks.append(task)

    existing_goal_names = {g.get('name') for g in existing_goals}
    for goal in active_goals:
        if goal['name'] not in existing_goal_names:
            existing_goals.append(goal)

    # Keep lists manageable
    if len(existing_tasks) > 10:
        existing_tasks = existing_tasks[-10:]
    if len(existing_goals) > 5:
        existing_goals = existing_goals[-5:]

    memory.update_scratchpad({
        'currentTasks': existing_tasks,
        'activeGoals': existing_goals,
        'sessionId': session_id,
        'lastPrompt': prompt_for_storage[:200]
    })

    # Search for relevant context to inject
    relevant_context = []

    # Search memory for relevant entities
    search_terms = extract_key_terms(prompt)
    for term in search_terms[:3]:  # Limit to top 3 terms
        results = memory.search(term, limit=3)
        for result in results:
            if result['score'] > 0.5:  # Only include relevant results
                relevant_context.append({
                    'name': result['name'],
                    'type': result['type'],
                    'score': result['score']
                })

    # Remove duplicates
    seen = set()
    unique_context = []
    for ctx in relevant_context:
        if ctx['name'] not in seen:
            seen.add(ctx['name'])
            unique_context.append(ctx)

    # Output context to inject (if any)
    # This will be passed back to Claude Code
    if unique_context:
        output = {
            'inject_context': True,
            'context': {
                'relevant_memory': unique_context[:5],
                'active_tasks': existing_tasks[:3],
                'active_goals': existing_goals[:2]
            }
        }
        # Note: Context injection requires Claude Code support
        # For now, we just log it
        memory.append_raw_event({
            'event_type': 'context_prepared',
            'context': output['context'],
            'session_id': session_id
        })

    sys.exit(0)

def extract_key_terms(text: str) -> list:
    """Extract key terms from text for searching."""
    import re

    # Remove common words
    stop_words = {
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'under', 'again',
        'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
        'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this',
        'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our',
        'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
        'what', 'which', 'who', 'whom', 'please', 'help', 'want', 'need', 'like'
    }

    # Extract words
    words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9_-]*\b', text.lower())

    # Filter and deduplicate
    key_terms = []
    seen = set()
    for word in words:
        if word not in stop_words and word not in seen and len(word) > 2:
            key_terms.append(word)
            seen.add(word)

    return key_terms[:10]  # Return top 10 terms

if __name__ == '__main__':
    main()
