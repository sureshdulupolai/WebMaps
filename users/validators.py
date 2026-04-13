"""
users/validators.py — Input validators for user registration and profile.
"""
import re
from django.core.exceptions import ValidationError


def validate_email_format(email: str):
    # Enforce exactly ONE @ and ends with @gmail.com
    if email.count('@') != 1:
        raise ValidationError('Email must contain exactly one "@" symbol.')
    if not email.endswith('@gmail.com'):
        raise ValidationError('Only @gmail.com email addresses are allowed.')

    # Gmail local part validator (before @gmail.com)
    # Allowed: alphanumeric and periods, no consecutive periods, cannot start/end with period
    local_part = email.split('@')[0]
    if len(local_part) < 6 or len(local_part) > 30:
        raise ValidationError('Gmail username must be between 6 and 30 characters.')
    if not re.match(r'^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$', local_part):
        raise ValidationError('Gmail address can only contain letters, numbers, and non-consecutive periods.')


def validate_username(username: str):
    if len(username) < 3:
        raise ValidationError('Username must be at least 3 characters long.')
    if len(username) > 30:
        raise ValidationError('Username must be at most 30 characters long.')
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        raise ValidationError('Username may only contain letters, numbers, and underscores.')


def validate_phone(phone: str):
    if phone:
        # Strip generic +91 or + prefixes if applicable and only process digits
        cleaned = re.sub(r'^\+?[0-9]*\s*', '', phone) # simple strip for common formats
        # We enforce exactly 10 digits provided by user originally mapping to a raw 10 digit string
        raw_digits = ''.join(filter(str.isdigit, phone))
        
        # In case the user passed country code, let's take the last 10 digits if overall is >10
        # Actually user wants "mobile no pe sirf 10 no hi enter kar"
        if len(raw_digits) != 10:
            raise ValidationError('Phone number must be exactly 10 digits.')
            
        # Reject if all digits are the same (e.g. 0000000000, 1111111111)
        if len(set(raw_digits)) == 1:
            raise ValidationError('Phone number cannot be repeated identical digits.')


def validate_password_strength(password: str):
    if len(password) < 8:
        raise ValidationError('Password must be at least 8 characters.')
    if not re.search(r'[A-Z]', password):
        raise ValidationError('Password must contain at least one uppercase letter.')
    if not re.search(r'[0-9]', password):
        raise ValidationError('Password must contain at least one digit.')
