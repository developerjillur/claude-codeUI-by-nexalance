#!/usr/bin/env python3
"""
Secure Filter - Credential detection and redaction for memory storage
CRITICAL: Never store actual credentials. Only store references.
"""

import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum

class SensitiveType(Enum):
    """Types of sensitive data that can be detected."""
    API_KEY = "api_key"
    PASSWORD = "password"
    TOKEN = "token"
    SECRET = "secret"
    CONNECTION_STRING = "connection_string"
    PRIVATE_KEY = "private_key"
    AWS_CREDENTIAL = "aws_credential"
    GITHUB_TOKEN = "github_token"
    JWT = "jwt"
    OAUTH = "oauth"
    CREDIT_CARD = "credit_card"
    SSH_KEY = "ssh_key"

@dataclass
class SensitiveMatch:
    """Represents a detected sensitive data match."""
    type: SensitiveType
    pattern_name: str
    start: int
    end: int
    context: str
    redacted: str

class SecureFilter:
    """Filter for detecting and redacting sensitive information."""

    # Patterns for detecting sensitive data
    PATTERNS: Dict[SensitiveType, List[Tuple[str, str]]] = {
        SensitiveType.API_KEY: [
            (r'api[_-]?key\s*[=:]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', 'generic_api_key'),
            (r'apikey\s*[=:]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', 'apikey_field'),
            (r'x-api-key\s*[=:]\s*["\']?([a-zA-Z0-9_\-]{20,})["\']?', 'x_api_key_header'),
        ],
        SensitiveType.PASSWORD: [
            (r'password\s*[=:]\s*["\']?([^\s"\'\n]{6,})["\']?', 'password_field'),
            (r'passwd\s*[=:]\s*["\']?([^\s"\'\n]{6,})["\']?', 'passwd_field'),
            (r'pwd\s*[=:]\s*["\']?([^\s"\'\n]{6,})["\']?', 'pwd_field'),
        ],
        SensitiveType.TOKEN: [
            (r'bearer\s+([a-zA-Z0-9_\-\.]+)', 'bearer_token'),
            (r'token\s*[=:]\s*["\']?([a-zA-Z0-9_\-\.]{20,})["\']?', 'generic_token'),
            (r'access[_-]?token\s*[=:]\s*["\']?([a-zA-Z0-9_\-\.]+)["\']?', 'access_token'),
            (r'refresh[_-]?token\s*[=:]\s*["\']?([a-zA-Z0-9_\-\.]+)["\']?', 'refresh_token'),
        ],
        SensitiveType.SECRET: [
            (r'secret\s*[=:]\s*["\']?([a-zA-Z0-9_\-]{16,})["\']?', 'generic_secret'),
            (r'client[_-]?secret\s*[=:]\s*["\']?([a-zA-Z0-9_\-]+)["\']?', 'client_secret'),
            (r'app[_-]?secret\s*[=:]\s*["\']?([a-zA-Z0-9_\-]+)["\']?', 'app_secret'),
        ],
        SensitiveType.CONNECTION_STRING: [
            (r'mongodb(\+srv)?://[^\s<>"\']+', 'mongodb_connection'),
            (r'postgres(ql)?://[^\s<>"\']+', 'postgres_connection'),
            (r'mysql://[^\s<>"\']+', 'mysql_connection'),
            (r'redis://[^\s<>"\']+', 'redis_connection'),
            (r'amqp://[^\s<>"\']+', 'rabbitmq_connection'),
        ],
        SensitiveType.AWS_CREDENTIAL: [
            (r'AKIA[0-9A-Z]{16}', 'aws_access_key'),
            (r'aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["\']?([a-zA-Z0-9/+=]{40})["\']?', 'aws_secret_key'),
        ],
        SensitiveType.GITHUB_TOKEN: [
            (r'ghp_[a-zA-Z0-9]{36}', 'github_pat'),
            (r'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}', 'github_fine_grained'),
            (r'gho_[a-zA-Z0-9]{36}', 'github_oauth'),
            (r'ghs_[a-zA-Z0-9]{36}', 'github_app'),
            (r'ghr_[a-zA-Z0-9]{36}', 'github_refresh'),
        ],
        SensitiveType.JWT: [
            (r'eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*', 'jwt_token'),
        ],
        SensitiveType.PRIVATE_KEY: [
            (r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', 'private_key_header'),
            (r'-----BEGIN PGP PRIVATE KEY BLOCK-----', 'pgp_private_key'),
        ],
        SensitiveType.SSH_KEY: [
            (r'ssh-rsa\s+[a-zA-Z0-9+/=]+', 'ssh_rsa_key'),
            (r'ssh-ed25519\s+[a-zA-Z0-9+/=]+', 'ssh_ed25519_key'),
        ],
        SensitiveType.CREDIT_CARD: [
            (r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b', 'credit_card_number'),
        ],
        SensitiveType.OAUTH: [
            (r'sk-[a-zA-Z0-9]{48}', 'openai_api_key'),
            (r'sk-proj-[a-zA-Z0-9]{48}', 'openai_project_key'),
            (r'xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+', 'slack_bot_token'),
            (r'xoxp-[0-9]+-[0-9]+-[0-9]+-[a-f0-9]+', 'slack_user_token'),
        ],
    }

    # Context words that indicate credentials nearby
    CONTEXT_INDICATORS = [
        'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey',
        'auth', 'credential', 'private', 'key', 'bearer', 'oauth', 'jwt',
        'access', 'refresh', 'session', 'cookie', 'login', 'signin'
    ]

    def __init__(self):
        # Compile all patterns for efficiency
        self._compiled_patterns: Dict[SensitiveType, List[Tuple[re.Pattern, str]]] = {}
        for sensitive_type, patterns in self.PATTERNS.items():
            self._compiled_patterns[sensitive_type] = [
                (re.compile(pattern, re.IGNORECASE), name)
                for pattern, name in patterns
            ]

    def scan(self, text: str) -> List[SensitiveMatch]:
        """Scan text for sensitive data patterns."""
        matches = []

        for sensitive_type, patterns in self._compiled_patterns.items():
            for pattern, pattern_name in patterns:
                for match in pattern.finditer(text):
                    # Get context around the match
                    start = max(0, match.start() - 20)
                    end = min(len(text), match.end() + 20)
                    context = text[start:end]

                    # Create redacted version
                    matched_text = match.group(0)
                    if len(matched_text) > 8:
                        redacted = matched_text[:4] + '*' * (len(matched_text) - 8) + matched_text[-4:]
                    else:
                        redacted = '*' * len(matched_text)

                    matches.append(SensitiveMatch(
                        type=sensitive_type,
                        pattern_name=pattern_name,
                        start=match.start(),
                        end=match.end(),
                        context=context,
                        redacted=redacted
                    ))

        return matches

    def contains_sensitive(self, text: str) -> bool:
        """Quick check if text contains any sensitive data."""
        return len(self.scan(text)) > 0

    def redact(self, text: str) -> Tuple[str, List[SensitiveMatch]]:
        """Redact all sensitive data from text and return matches found."""
        matches = self.scan(text)

        if not matches:
            return text, []

        # Sort matches by position (reverse) to replace from end to start
        matches.sort(key=lambda x: x.start, reverse=True)

        redacted_text = text
        for match in matches:
            redacted_text = (
                redacted_text[:match.start] +
                f"[REDACTED:{match.type.value}]" +
                redacted_text[match.end:]
            )

        return redacted_text, matches

    def has_context_indicators(self, text: str) -> bool:
        """Check if text contains words that might indicate credentials nearby."""
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in self.CONTEXT_INDICATORS)

    def safe_extract_reference(self, text: str, sensitive_type: SensitiveType) -> Optional[str]:
        """
        Extract a safe reference from text without actual credential value.
        Returns something like "credential:github:username" instead of the actual token.
        """
        # Try to extract service and identifier information
        service = None
        identifier = None

        # Look for common service patterns
        service_patterns = [
            (r'github\.com[/:]([a-zA-Z0-9_-]+)', 'github'),
            (r'gitlab\.com[/:]([a-zA-Z0-9_-]+)', 'gitlab'),
            (r'aws\.amazon\.com', 'aws'),
            (r'api\.openai\.com', 'openai'),
            (r'mongodb\+srv://([a-zA-Z0-9_-]+):', 'mongodb'),
            (r'postgres://([a-zA-Z0-9_-]+):', 'postgres'),
        ]

        for pattern, service_name in service_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                service = service_name
                if match.groups():
                    identifier = match.group(1)
                break

        if not service:
            service = sensitive_type.value

        if identifier:
            return f"credential:{service}:{identifier}"
        else:
            return f"credential:{service}:unknown"

    def filter_for_storage(self, data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, str]]]:
        """
        Filter a dictionary for safe storage.
        Returns filtered data and list of blocked items.
        """
        blocked = []
        filtered = {}

        for key, value in data.items():
            if isinstance(value, str):
                if self.contains_sensitive(value):
                    matches = self.scan(value)
                    blocked.append({
                        'field': key,
                        'types': [m.type.value for m in matches],
                        'reference': self.safe_extract_reference(value, matches[0].type) if matches else None
                    })
                    # Store only the reference, not the value
                    if matches:
                        filtered[key] = self.safe_extract_reference(value, matches[0].type)
                else:
                    filtered[key] = value
            elif isinstance(value, dict):
                filtered[key], sub_blocked = self.filter_for_storage(value)
                blocked.extend(sub_blocked)
            elif isinstance(value, list):
                filtered_list = []
                for item in value:
                    if isinstance(item, str):
                        if self.contains_sensitive(item):
                            matches = self.scan(item)
                            blocked.append({
                                'field': f"{key}[]",
                                'types': [m.type.value for m in matches]
                            })
                        else:
                            filtered_list.append(item)
                    elif isinstance(item, dict):
                        filtered_item, sub_blocked = self.filter_for_storage(item)
                        filtered_list.append(filtered_item)
                        blocked.extend(sub_blocked)
                    else:
                        filtered_list.append(item)
                filtered[key] = filtered_list
            else:
                filtered[key] = value

        return filtered, blocked


# Singleton instance for convenience
_filter_instance: Optional[SecureFilter] = None

def get_secure_filter() -> SecureFilter:
    """Get the singleton secure filter instance."""
    global _filter_instance
    if _filter_instance is None:
        _filter_instance = SecureFilter()
    return _filter_instance


def scan_text(text: str) -> List[SensitiveMatch]:
    """Convenience function to scan text for sensitive data."""
    return get_secure_filter().scan(text)


def redact_text(text: str) -> str:
    """Convenience function to redact sensitive data from text."""
    redacted, _ = get_secure_filter().redact(text)
    return redacted


def is_safe_for_storage(text: str) -> bool:
    """Check if text is safe to store (no sensitive data)."""
    return not get_secure_filter().contains_sensitive(text)
