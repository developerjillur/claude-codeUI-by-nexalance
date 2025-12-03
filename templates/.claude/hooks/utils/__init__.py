#!/usr/bin/env python3
"""
Utils package for Claude Code memory hooks.
"""

from .memory_client import MemoryClient, get_memory_client
from .secure_filter import SecureFilter, get_secure_filter, scan_text, redact_text, is_safe_for_storage
from .entity_extractor import EntityExtractor, get_entity_extractor, extract_entities, extract_from_tool

__all__ = [
    'MemoryClient',
    'get_memory_client',
    'SecureFilter',
    'get_secure_filter',
    'scan_text',
    'redact_text',
    'is_safe_for_storage',
    'EntityExtractor',
    'get_entity_extractor',
    'extract_entities',
    'extract_from_tool',
]
