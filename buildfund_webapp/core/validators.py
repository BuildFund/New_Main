"""Input validation and sanitization utilities."""
from __future__ import annotations

import re
import html
from typing import Any
from django.core.exceptions import ValidationError
from django.utils.html import strip_tags


def sanitize_string(value: str, max_length: int = None) -> str:
    """
    Sanitize a string input to prevent XSS and injection attacks.
    
    Args:
        value: Input string to sanitize
        max_length: Optional maximum length
        
    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        raise ValidationError("Input must be a string")
    
    # Remove HTML tags
    sanitized = strip_tags(value)
    
    # Escape HTML entities
    sanitized = html.escape(sanitized)
    
    # Remove control characters except newlines and tabs
    sanitized = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', sanitized)
    
    # Trim whitespace
    sanitized = sanitized.strip()
    
    # Enforce max length
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized


def validate_postcode(postcode: str) -> str:
    """
    Validate and sanitize UK postcode format.
    
    Args:
        postcode: UK postcode string
        
    Returns:
        Validated postcode
        
    Raises:
        ValidationError: If postcode format is invalid
    """
    if not postcode:
        raise ValidationError("Postcode is required")
    
    # Remove all spaces and convert to uppercase
    cleaned = re.sub(r'\s+', '', postcode.upper())
    
    # UK postcode regex pattern
    # Format: A9 9AA or A99 9AA or AA9 9AA or AA99 9AA or A9A 9AA or AA9A 9AA
    pattern = r'^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2}$'
    
    if not re.match(pattern, cleaned):
        raise ValidationError("Invalid UK postcode format")
    
    # Format with space
    if len(cleaned) > 5:
        formatted = f"{cleaned[:-3]} {cleaned[-3:]}"
    else:
        formatted = cleaned
    
    return formatted


def validate_company_number(company_number: str) -> str:
    """
    Validate UK company number format (8 digits, optionally with leading zeros).
    
    Args:
        company_number: Company registration number
        
    Returns:
        Validated company number
        
    Raises:
        ValidationError: If format is invalid
    """
    if not company_number:
        raise ValidationError("Company number is required")
    
    # Remove spaces and dashes
    cleaned = re.sub(r'[\s-]', '', company_number)
    
    # Must be 8 digits
    if not re.match(r'^\d{8}$', cleaned):
        raise ValidationError("Company number must be 8 digits")
    
    return cleaned


def sanitize_for_prompt(text: str) -> str:
    """
    Sanitize text to prevent prompt injection attacks in AI/LLM contexts.
    
    Args:
        text: Text to sanitize
        
    Returns:
        Sanitized text safe for use in prompts
    """
    if not isinstance(text, str):
        return ""
    
    # Remove common prompt injection patterns
    injection_patterns = [
        r'ignore\s+(previous|above|all)\s+(instructions|commands|prompts?)',
        r'forget\s+(previous|above|all)',
        r'you\s+are\s+now',
        r'act\s+as\s+if',
        r'pretend\s+to\s+be',
        r'system:\s*',
        r'<\|.*?\|>',  # Special tokens
    ]
    
    sanitized = text
    for pattern in injection_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
    
    # Remove control characters
    sanitized = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', sanitized)
    
    # Limit length to prevent token limit attacks
    max_length = 10000
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized.strip()


def validate_numeric_input(value: Any, min_value: float = None, max_value: float = None) -> float:
    """
    Validate and convert numeric input safely.
    
    Args:
        value: Input value to validate
        min_value: Optional minimum value
        max_value: Optional maximum value
        
    Returns:
        Validated float value
        
    Raises:
        ValidationError: If value is invalid
    """
    try:
        if isinstance(value, str):
            # Remove any non-numeric characters except decimal point and minus
            cleaned = re.sub(r'[^\d.-]', '', value)
            num_value = float(cleaned)
        else:
            num_value = float(value)
    except (ValueError, TypeError):
        raise ValidationError("Invalid numeric value")
    
    if min_value is not None and num_value < min_value:
        raise ValidationError(f"Value must be at least {min_value}")
    
    if max_value is not None and num_value > max_value:
        raise ValidationError(f"Value must be at most {max_value}")
    
    return num_value


def validate_email(email: str) -> str:
    """
    Validate and sanitize email address.
    
    Args:
        email: Email address to validate
        
    Returns:
        Validated email address
        
    Raises:
        ValidationError: If email format is invalid
    """
    if not email:
        raise ValidationError("Email is required")
    
    email = email.strip().lower()
    
    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        raise ValidationError("Invalid email format")
    
    # Additional length check
    if len(email) > 254:  # RFC 5321 limit
        raise ValidationError("Email address too long")
    
    return email
