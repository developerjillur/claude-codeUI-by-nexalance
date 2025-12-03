#!/usr/bin/env python3
"""
Memory Client - Optimized memory operations for Claude Code hooks
Includes caching, batch writes, and performance optimizations.
Version 2.1.38 - Performance Optimized
"""

import json
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import fcntl
import time
import threading

# =============================================================================
# Global Cache for Performance
# =============================================================================

class MemoryCache:
    """Thread-safe in-memory cache with TTL."""

    def __init__(self, ttl_seconds: int = 60):
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self._ttl = ttl_seconds
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        with self._lock:
            if key in self._cache:
                if time.time() - self._timestamps.get(key, 0) < self._ttl:
                    return self._cache[key]
                else:
                    # Expired, remove from cache
                    del self._cache[key]
                    del self._timestamps[key]
        return None

    def set(self, key: str, value: Any):
        """Set value in cache."""
        with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()

    def invalidate(self, key: str = None):
        """Invalidate specific key or all cache."""
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
            else:
                self._cache.clear()
                self._timestamps.clear()

# Global cache instance (shared across all MemoryClient instances)
_global_cache = MemoryCache(ttl_seconds=60)

# =============================================================================
# Batch Write Buffer
# =============================================================================

class BatchWriteBuffer:
    """Buffer for batch writing to reduce I/O operations."""

    def __init__(self, max_items: int = 5, max_age_seconds: float = 2.0):
        self._buffer: List[Dict[str, Any]] = []
        self._max_items = max_items
        self._max_age = max_age_seconds
        self._first_item_time: Optional[float] = None
        self._lock = threading.Lock()

    def add(self, item: Dict[str, Any]) -> bool:
        """Add item to buffer. Returns True if flush is needed."""
        with self._lock:
            if not self._first_item_time:
                self._first_item_time = time.time()

            self._buffer.append(item)

            # Check if we should flush
            should_flush = (
                len(self._buffer) >= self._max_items or
                (time.time() - self._first_item_time) >= self._max_age
            )

            return should_flush

    def flush(self) -> List[Dict[str, Any]]:
        """Get and clear buffered items."""
        with self._lock:
            items = self._buffer.copy()
            self._buffer.clear()
            self._first_item_time = None
            return items

    def has_items(self) -> bool:
        """Check if buffer has items."""
        with self._lock:
            return len(self._buffer) > 0

# =============================================================================
# Memory Client with Performance Optimizations
# =============================================================================

class MemoryClient:
    """Client for managing project memory storage with caching and batch writes."""

    # Lightweight mode - skip expensive operations
    LIGHTWEIGHT_MODE = os.environ.get('CLAUDE_MEMORY_LIGHTWEIGHT', '1') == '1'

    def __init__(self, project_root: Optional[str] = None):
        self.project_root = Path(project_root) if project_root else self._find_project_root()
        self.claude_dir = self.project_root / '.claude'
        self.memory_dir = self.claude_dir / 'memory'
        self.sessions_dir = self.memory_dir / 'sessions'

        # Main storage files
        self.raw_events_file = self.memory_dir / 'raw-events.jsonl'
        self.memory_file = self.claude_dir / 'memory.jsonl'
        self.index_file = self.claude_dir / 'memory-index.json'
        self.graph_file = self.claude_dir / 'memory-graph.json'
        self.scratchpad_file = self.claude_dir / 'scratchpad.json'
        self.sensitive_log = self.memory_dir / 'sensitive-blocked.log'

        # Batch write buffer
        self._write_buffer = BatchWriteBuffer(max_items=5, max_age_seconds=2.0)

        self._ensure_directories()

    def _find_project_root(self) -> Path:
        """Find the project root by looking for .claude directory or git root."""
        cwd = Path.cwd()

        # Look for .claude directory
        for parent in [cwd] + list(cwd.parents):
            if (parent / '.claude').exists():
                return parent
            if (parent / '.git').exists():
                return parent

        return cwd

    def _ensure_directories(self):
        """Ensure all required directories exist."""
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def _generate_id(self, content: str) -> str:
        """Generate a unique ID based on content hash."""
        return hashlib.sha256(content.encode()).hexdigest()[:12]

    def _lock_file(self, file_path: Path, mode: str = 'a+'):
        """Get a file handle with exclusive lock for safe concurrent access."""
        f = open(file_path, mode)
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        return f

    def _unlock_file(self, f):
        """Release file lock."""
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        f.close()

    def append_raw_event(self, event: Dict[str, Any]) -> str:
        """Append a raw event to the events log (lightweight: batched)."""
        event_id = self._generate_id(json.dumps(event) + str(time.time()))

        record = {
            'id': event_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            **event
        }

        if self.LIGHTWEIGHT_MODE:
            # Add to batch buffer instead of writing immediately
            should_flush = self._write_buffer.add(record)
            if should_flush:
                self._flush_raw_events()
        else:
            # Direct write (original behavior)
            f = self._lock_file(self.raw_events_file)
            try:
                f.write(json.dumps(record) + '\n')
            finally:
                self._unlock_file(f)

        return event_id

    def _flush_raw_events(self):
        """Flush buffered raw events to file."""
        items = self._write_buffer.flush()
        if not items:
            return

        f = self._lock_file(self.raw_events_file)
        try:
            for item in items:
                f.write(json.dumps(item) + '\n')
        finally:
            self._unlock_file(f)

    def create_entity(self,
                      name: str,
                      entity_type: str,
                      observations: List[str],
                      metadata: Optional[Dict[str, Any]] = None) -> str:
        """Create a new entity in memory storage."""
        entity_id = self._generate_id(f"{entity_type}:{name}")
        timestamp = datetime.utcnow().isoformat() + 'Z'

        record = {
            'type': 'create_entity',
            'timestamp': timestamp,
            'data': {
                'id': entity_id,
                'name': name,
                'entityType': entity_type,
                'observations': observations,
                'createdAt': timestamp,
                'updatedAt': timestamp,
                'metadata': metadata or {}
            }
        }

        f = self._lock_file(self.memory_file)
        try:
            f.write(json.dumps(record) + '\n')
        finally:
            self._unlock_file(f)

        # Update index (skip in lightweight mode for batch operations)
        if not self.LIGHTWEIGHT_MODE:
            self._update_index(entity_id, name, entity_type, observations, metadata)

        # Invalidate cache
        _global_cache.invalidate('index')

        return entity_id

    def add_observation(self, entity_name: str, observation: str) -> bool:
        """Add an observation to an existing entity."""
        timestamp = datetime.utcnow().isoformat() + 'Z'

        record = {
            'type': 'add_observation',
            'timestamp': timestamp,
            'data': {
                'entityName': entity_name,
                'observation': observation
            }
        }

        f = self._lock_file(self.memory_file)
        try:
            f.write(json.dumps(record) + '\n')
        finally:
            self._unlock_file(f)

        # Invalidate cache
        _global_cache.invalidate('index')

        return True

    def create_relation(self, from_entity: str, to_entity: str, relation_type: str) -> bool:
        """Create a relation between two entities."""
        timestamp = datetime.utcnow().isoformat() + 'Z'

        record = {
            'type': 'create_relation',
            'timestamp': timestamp,
            'data': {
                'from': from_entity,
                'to': to_entity,
                'relationType': relation_type
            }
        }

        f = self._lock_file(self.memory_file)
        try:
            f.write(json.dumps(record) + '\n')
        finally:
            self._unlock_file(f)

        # Update graph (skip in lightweight mode)
        if not self.LIGHTWEIGHT_MODE:
            self._update_graph(from_entity, to_entity, relation_type)

        # Invalidate cache
        _global_cache.invalidate('graph')

        return True

    def _update_index(self, entity_id: str, name: str, entity_type: str,
                      observations: List[str], metadata: Optional[Dict[str, Any]]):
        """Update the search index with new entity."""
        index = self._load_index()

        # Create searchable text
        search_text = f"{name} {' '.join(observations)}"
        if metadata:
            if 'tags' in metadata:
                search_text += ' ' + ' '.join(metadata['tags'])

        index['entities'][entity_id] = {
            'name': name,
            'type': entity_type,
            'searchText': search_text.lower(),
            'importance': metadata.get('importance', 'normal') if metadata else 'normal',
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }

        # Update type index
        if entity_type not in index['byType']:
            index['byType'][entity_type] = []
        if entity_id not in index['byType'][entity_type]:
            index['byType'][entity_type].append(entity_id)

        self._save_index(index)

    def _update_graph(self, from_entity: str, to_entity: str, relation_type: str):
        """Update the relation graph."""
        graph = self._load_graph()

        if from_entity not in graph['nodes']:
            graph['nodes'][from_entity] = {'relations': []}

        graph['nodes'][from_entity]['relations'].append({
            'to': to_entity,
            'type': relation_type,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        })

        # Add edge
        graph['edges'].append({
            'from': from_entity,
            'to': to_entity,
            'type': relation_type
        })

        self._save_graph(graph)

    def _load_index(self) -> Dict[str, Any]:
        """Load the search index (with caching)."""
        # Check cache first
        cached = _global_cache.get('index')
        if cached is not None:
            return cached

        if self.index_file.exists():
            try:
                with open(self.index_file, 'r') as f:
                    index = json.load(f)
                    _global_cache.set('index', index)
                    return index
            except (json.JSONDecodeError, IOError):
                pass

        default_index = {
            'version': 1,
            'entities': {},
            'byType': {},
            'lastUpdated': datetime.utcnow().isoformat() + 'Z'
        }
        _global_cache.set('index', default_index)
        return default_index

    def _save_index(self, index: Dict[str, Any]):
        """Save the search index."""
        index['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
        with open(self.index_file, 'w') as f:
            json.dump(index, f, indent=2)
        _global_cache.set('index', index)

    def _load_graph(self) -> Dict[str, Any]:
        """Load the relation graph (with caching)."""
        # Check cache first
        cached = _global_cache.get('graph')
        if cached is not None:
            return cached

        if self.graph_file.exists():
            try:
                with open(self.graph_file, 'r') as f:
                    graph = json.load(f)
                    _global_cache.set('graph', graph)
                    return graph
            except (json.JSONDecodeError, IOError):
                pass

        default_graph = {
            'version': 1,
            'nodes': {},
            'edges': [],
            'lastUpdated': datetime.utcnow().isoformat() + 'Z'
        }
        _global_cache.set('graph', default_graph)
        return default_graph

    def _save_graph(self, graph: Dict[str, Any]):
        """Save the relation graph."""
        graph['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
        with open(self.graph_file, 'w') as f:
            json.dump(graph, f, indent=2)
        _global_cache.set('graph', graph)

    def search(self, query: str, entity_type: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for entities matching the query (with result caching)."""
        # Check search cache
        cache_key = f'search:{query}:{entity_type}:{limit}'
        cached = _global_cache.get(cache_key)
        if cached is not None:
            return cached

        index = self._load_index()

        # Early exit if index is empty
        if not index['entities']:
            return []

        query_lower = query.lower()
        results = []

        for entity_id, entity in index['entities'].items():
            # Filter by type if specified
            if entity_type and entity['type'] != entity_type:
                continue

            # Simple text matching
            if query_lower in entity['searchText']:
                score = entity['searchText'].count(query_lower)
                # Boost by importance
                importance_boost = {'critical': 3, 'high': 2, 'normal': 1, 'low': 0.5}
                score *= importance_boost.get(entity['importance'], 1)

                results.append({
                    'id': entity_id,
                    'name': entity['name'],
                    'type': entity['type'],
                    'score': score
                })

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        final_results = results[:limit]

        # Cache results
        _global_cache.set(cache_key, final_results)

        return final_results

    def get_entities_by_type(self, entity_type: str) -> List[str]:
        """Get all entity IDs of a given type."""
        index = self._load_index()
        return index['byType'].get(entity_type, [])

    def get_scratchpad(self) -> Dict[str, Any]:
        """Load the active scratchpad context (with caching)."""
        cached = _global_cache.get('scratchpad')
        if cached is not None:
            return cached

        if self.scratchpad_file.exists():
            try:
                with open(self.scratchpad_file, 'r') as f:
                    scratchpad = json.load(f)
                    _global_cache.set('scratchpad', scratchpad)
                    return scratchpad
            except (json.JSONDecodeError, IOError):
                pass

        default_scratchpad = {
            'version': 1,
            'activeGoals': [],
            'currentTasks': [],
            'recentContext': [],
            'sessionId': None,
            'lastUpdated': datetime.utcnow().isoformat() + 'Z'
        }
        _global_cache.set('scratchpad', default_scratchpad)
        return default_scratchpad

    def update_scratchpad(self, updates: Dict[str, Any]):
        """Update the scratchpad with new data."""
        scratchpad = self.get_scratchpad()
        scratchpad.update(updates)
        scratchpad['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'

        with open(self.scratchpad_file, 'w') as f:
            json.dump(scratchpad, f, indent=2)

        _global_cache.set('scratchpad', scratchpad)

    def log_sensitive_blocked(self, pattern_type: str, source: str, context: str):
        """Log when sensitive data is detected and blocked."""
        timestamp = datetime.utcnow().isoformat() + 'Z'
        entry = f"[{timestamp}] BLOCKED: {pattern_type} detected in {source} - Context: {context[:100]}...\n"

        with open(self.sensitive_log, 'a') as f:
            f.write(entry)

    def get_session_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific session summary."""
        session_file = self.sessions_dir / f"{session_id}.json"
        if session_file.exists():
            try:
                with open(session_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return None

    def save_session_summary(self, session_id: str, summary: Dict[str, Any]):
        """Save a session summary."""
        session_file = self.sessions_dir / f"{session_id}.json"
        summary['sessionId'] = session_id
        summary['savedAt'] = datetime.utcnow().isoformat() + 'Z'

        with open(session_file, 'w') as f:
            json.dump(summary, f, indent=2)

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get the most recent raw events."""
        events = []

        if not self.raw_events_file.exists():
            return events

        with open(self.raw_events_file, 'r') as f:
            lines = f.readlines()

        # Get last N lines
        for line in lines[-limit:]:
            try:
                events.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue

        return events

    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about the memory system."""
        index = self._load_index()
        graph = self._load_graph()

        stats = {
            'totalEntities': len(index['entities']),
            'entitiesByType': {k: len(v) for k, v in index['byType'].items()},
            'totalRelations': len(graph['edges']),
            'rawEventsCount': 0,
            'lastUpdated': index.get('lastUpdated'),
            'lightweightMode': self.LIGHTWEIGHT_MODE
        }

        if self.raw_events_file.exists():
            with open(self.raw_events_file, 'r') as f:
                stats['rawEventsCount'] = sum(1 for _ in f)

        return stats

    def flush_all(self):
        """Flush all buffered writes (call at session end)."""
        if self._write_buffer.has_items():
            self._flush_raw_events()


# Convenience function for use in hooks
def get_memory_client() -> MemoryClient:
    """Get a memory client instance for the current project."""
    return MemoryClient()
