#!/usr/bin/env python3
"""
Entity Extractor - Pattern-based extraction of entities from text and tool usage
This provides fast, lightweight extraction. For complex cases, use the Memory Curator Agent.
"""

import re
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

class EntityType(Enum):
    """Types of entities that can be extracted."""
    TASK = "task"
    GOAL = "goal"
    DECISION = "decision"
    FILE = "file"
    URL = "url"
    PATTERN = "pattern"
    ERROR = "error"
    DEPENDENCY = "dependency"
    COMMAND = "command"
    CREDENTIAL_REF = "credential_ref"  # Reference only, never actual value
    PERSON = "person"
    PROJECT = "project"
    FEATURE = "feature"
    BUG = "bug"
    NOTE = "note"

@dataclass
class ExtractedEntity:
    """Represents an extracted entity."""
    type: EntityType
    name: str
    observations: List[str]
    confidence: float  # 0.0 to 1.0
    source: str  # Where this was extracted from
    metadata: Dict[str, Any] = field(default_factory=dict)
    related_entities: List[str] = field(default_factory=list)

class EntityExtractor:
    """Extracts entities from text and tool usage data."""

    # Action words that indicate tasks
    TASK_INDICATORS = [
        'implement', 'create', 'add', 'fix', 'update', 'modify', 'change',
        'refactor', 'delete', 'remove', 'build', 'setup', 'configure',
        'install', 'deploy', 'test', 'debug', 'optimize', 'improve'
    ]

    # Words indicating goals/objectives
    GOAL_INDICATORS = [
        'want to', 'need to', 'should', 'must', 'goal is', 'objective',
        'aim to', 'plan to', 'intend to', 'purpose', 'target'
    ]

    # Words indicating decisions
    DECISION_INDICATORS = [
        'decided', 'chose', 'selected', 'picked', 'went with', 'using',
        'will use', 'opted for', 'prefer', 'better to', 'instead of'
    ]

    # File patterns
    FILE_PATTERNS = [
        r'(?:^|[\s\'"(])([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,10})(?:[\s\'"),]|$)',  # file.ext
        r'(?:src|lib|test|docs?|config)/[a-zA-Z0-9_\-./]+',  # path patterns
    ]

    # URL pattern
    URL_PATTERN = r'https?://[^\s<>"\')\]]+[^\s<>"\')\].,;:!?]'

    # Error patterns
    ERROR_PATTERNS = [
        r'error[:\s]+(.+?)(?:\n|$)',
        r'exception[:\s]+(.+?)(?:\n|$)',
        r'failed[:\s]+(.+?)(?:\n|$)',
        r'cannot\s+(.+?)(?:\n|$)',
    ]

    def __init__(self):
        self._compiled_file_patterns = [re.compile(p, re.IGNORECASE) for p in self.FILE_PATTERNS]
        self._url_pattern = re.compile(self.URL_PATTERN, re.IGNORECASE)
        self._error_patterns = [re.compile(p, re.IGNORECASE) for p in self.ERROR_PATTERNS]

    def extract_from_prompt(self, prompt: str) -> List[ExtractedEntity]:
        """Extract entities from a user prompt."""
        entities = []
        prompt_lower = prompt.lower()

        # Extract tasks
        task = self._extract_task(prompt, prompt_lower)
        if task:
            entities.append(task)

        # Extract goals
        goal = self._extract_goal(prompt, prompt_lower)
        if goal:
            entities.append(goal)

        # Extract files mentioned
        files = self._extract_files(prompt)
        entities.extend(files)

        # Extract URLs
        urls = self._extract_urls(prompt)
        entities.extend(urls)

        return entities

    def extract_from_tool_use(self, tool_name: str, tool_input: Dict[str, Any],
                               tool_output: Optional[str] = None) -> List[ExtractedEntity]:
        """Extract entities from tool usage."""
        entities = []

        if tool_name in ['Read', 'Write', 'Edit']:
            file_entity = self._extract_file_from_tool(tool_name, tool_input)
            if file_entity:
                entities.append(file_entity)

        elif tool_name == 'WebFetch':
            url_entity = self._extract_url_from_tool(tool_input)
            if url_entity:
                entities.append(url_entity)

        elif tool_name == 'Bash':
            cmd_entity = self._extract_command_from_tool(tool_input)
            if cmd_entity:
                entities.append(cmd_entity)

            # Check for errors in output
            if tool_output:
                errors = self._extract_errors(tool_output)
                entities.extend(errors)

        elif tool_name == 'Grep':
            # Extract search patterns
            pattern = tool_input.get('pattern', '')
            if pattern and len(pattern) > 3:
                entities.append(ExtractedEntity(
                    type=EntityType.PATTERN,
                    name=f"search:{pattern[:50]}",
                    observations=[f"Searched for pattern: {pattern}"],
                    confidence=0.6,
                    source='tool:Grep',
                    metadata={'pattern': pattern, 'path': tool_input.get('path', '')}
                ))

        return entities

    def _extract_task(self, prompt: str, prompt_lower: str) -> Optional[ExtractedEntity]:
        """Extract task from prompt."""
        for indicator in self.TASK_INDICATORS:
            if indicator in prompt_lower:
                # Find the sentence containing the task indicator
                sentences = re.split(r'[.!?]', prompt)
                for sentence in sentences:
                    if indicator in sentence.lower():
                        task_name = self._generate_task_name(sentence, indicator)
                        return ExtractedEntity(
                            type=EntityType.TASK,
                            name=task_name,
                            observations=[sentence.strip()],
                            confidence=0.8,
                            source='user_prompt',
                            metadata={
                                'action': indicator,
                                'status': 'active',
                                'createdAt': datetime.utcnow().isoformat() + 'Z'
                            }
                        )
        return None

    def _extract_goal(self, prompt: str, prompt_lower: str) -> Optional[ExtractedEntity]:
        """Extract goal from prompt."""
        for indicator in self.GOAL_INDICATORS:
            if indicator in prompt_lower:
                # Extract the goal description
                match = re.search(f'{indicator}\\s+(.+?)(?:[.!?]|$)', prompt_lower)
                if match:
                    goal_desc = match.group(1).strip()
                    goal_name = f"goal_{self._slugify(goal_desc[:30])}"
                    return ExtractedEntity(
                        type=EntityType.GOAL,
                        name=goal_name,
                        observations=[prompt.strip()[:200]],
                        confidence=0.7,
                        source='user_prompt',
                        metadata={
                            'indicator': indicator,
                            'status': 'active'
                        }
                    )
        return None

    def _extract_files(self, text: str) -> List[ExtractedEntity]:
        """Extract file references from text."""
        entities = []
        seen_files: Set[str] = set()

        for pattern in self._compiled_file_patterns:
            for match in pattern.finditer(text):
                file_path = match.group(1) if match.groups() else match.group(0)
                file_path = file_path.strip()

                # Skip common false positives
                if file_path in seen_files:
                    continue
                if not self._is_likely_file(file_path):
                    continue

                seen_files.add(file_path)
                entities.append(ExtractedEntity(
                    type=EntityType.FILE,
                    name=f"file:{file_path}",
                    observations=[f"File mentioned: {file_path}"],
                    confidence=0.7,
                    source='text_extraction',
                    metadata={'path': file_path}
                ))

        return entities

    def _extract_urls(self, text: str) -> List[ExtractedEntity]:
        """Extract URLs from text."""
        entities = []
        seen_urls: Set[str] = set()

        for match in self._url_pattern.finditer(text):
            url = match.group(0)
            if url in seen_urls:
                continue

            seen_urls.add(url)

            # Categorize URL
            url_type = self._categorize_url(url)

            entities.append(ExtractedEntity(
                type=EntityType.URL,
                name=f"url:{url[:50]}",
                observations=[f"URL referenced: {url}"],
                confidence=0.9,
                source='text_extraction',
                metadata={
                    'url': url,
                    'urlType': url_type
                }
            ))

        return entities

    def _extract_errors(self, output: str) -> List[ExtractedEntity]:
        """Extract error messages from output."""
        entities = []

        for pattern in self._error_patterns:
            for match in pattern.finditer(output):
                error_msg = match.group(1) if match.groups() else match.group(0)
                error_msg = error_msg.strip()[:200]

                entities.append(ExtractedEntity(
                    type=EntityType.ERROR,
                    name=f"error:{error_msg[:30]}",
                    observations=[error_msg],
                    confidence=0.8,
                    source='tool_output',
                    metadata={'fullError': error_msg}
                ))

        return entities

    def _extract_file_from_tool(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[ExtractedEntity]:
        """Extract file entity from file-related tool usage."""
        file_path = tool_input.get('file_path', '')
        if not file_path:
            return None

        action = {
            'Read': 'read',
            'Write': 'created/written',
            'Edit': 'edited'
        }.get(tool_name, 'accessed')

        return ExtractedEntity(
            type=EntityType.FILE,
            name=f"file:{file_path}",
            observations=[f"File {action}: {file_path}"],
            confidence=1.0,
            source=f'tool:{tool_name}',
            metadata={
                'path': file_path,
                'action': action,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
        )

    def _extract_url_from_tool(self, tool_input: Dict[str, Any]) -> Optional[ExtractedEntity]:
        """Extract URL entity from WebFetch tool usage."""
        url = tool_input.get('url', '')
        if not url:
            return None

        return ExtractedEntity(
            type=EntityType.URL,
            name=f"url:{url[:50]}",
            observations=[f"URL fetched: {url}"],
            confidence=1.0,
            source='tool:WebFetch',
            metadata={
                'url': url,
                'urlType': self._categorize_url(url),
                'fetchedAt': datetime.utcnow().isoformat() + 'Z'
            }
        )

    def _extract_command_from_tool(self, tool_input: Dict[str, Any]) -> Optional[ExtractedEntity]:
        """Extract command entity from Bash tool usage."""
        command = tool_input.get('command', '')
        if not command:
            return None

        # Extract command name
        cmd_parts = command.split()
        cmd_name = cmd_parts[0] if cmd_parts else 'unknown'

        return ExtractedEntity(
            type=EntityType.COMMAND,
            name=f"cmd:{cmd_name}",
            observations=[f"Command executed: {command[:100]}"],
            confidence=1.0,
            source='tool:Bash',
            metadata={
                'command': command[:500],
                'executedAt': datetime.utcnow().isoformat() + 'Z'
            }
        )

    def _generate_task_name(self, sentence: str, action: str) -> str:
        """Generate a task name from a sentence."""
        # Extract key words after the action
        clean = re.sub(r'[^\w\s]', '', sentence.lower())
        words = clean.split()

        # Find action word position
        try:
            action_idx = words.index(action)
            key_words = words[action_idx:action_idx + 4]
        except ValueError:
            key_words = words[:4]

        return f"task_{'_'.join(key_words)}"

    def _slugify(self, text: str) -> str:
        """Convert text to a slug-friendly format."""
        text = re.sub(r'[^\w\s-]', '', text.lower())
        text = re.sub(r'[\s_]+', '_', text)
        return text[:30]

    def _is_likely_file(self, path: str) -> bool:
        """Check if a string is likely a file path."""
        # Must have an extension
        if '.' not in path:
            return False

        # Common extensions
        valid_extensions = {
            'ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt',
            'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'swift', 'vue', 'svelte',
            'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'css', 'scss', 'less',
            'md', 'txt', 'rst', 'sh', 'bash', 'zsh', 'fish', 'ps1',
            'sql', 'graphql', 'prisma', 'env', 'config', 'conf'
        }

        ext = path.split('.')[-1].lower()
        return ext in valid_extensions

    def _categorize_url(self, url: str) -> str:
        """Categorize a URL by its purpose."""
        url_lower = url.lower()

        if 'github.com' in url_lower:
            return 'github'
        elif 'gitlab.com' in url_lower:
            return 'gitlab'
        elif 'stackoverflow.com' in url_lower:
            return 'documentation'
        elif 'docs.' in url_lower or '/docs/' in url_lower:
            return 'documentation'
        elif 'api.' in url_lower or '/api/' in url_lower:
            return 'api'
        elif 'localhost' in url_lower or '127.0.0.1' in url_lower:
            return 'local'
        else:
            return 'external'


# Singleton instance
_extractor: Optional[EntityExtractor] = None

def get_entity_extractor() -> EntityExtractor:
    """Get the singleton entity extractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = EntityExtractor()
    return _extractor


def extract_entities(text: str) -> List[ExtractedEntity]:
    """Convenience function to extract entities from text."""
    return get_entity_extractor().extract_from_prompt(text)


def extract_from_tool(tool_name: str, tool_input: Dict[str, Any],
                      tool_output: Optional[str] = None) -> List[ExtractedEntity]:
    """Convenience function to extract entities from tool usage."""
    return get_entity_extractor().extract_from_tool_use(tool_name, tool_input, tool_output)
