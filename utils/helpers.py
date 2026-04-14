"""
utils/helpers.py — Shared utility functions used across the project.
"""
import re
import uuid
import hashlib
import random
import string
import logging
import bleach
from slugify import slugify

logger = logging.getLogger('webmaps')


# ─────────────────────────────────────────────
#  SLUG GENERATION
# ─────────────────────────────────────────────
def generate_listing_slug(company_name: str, location_name: str = '') -> str:
    """
    Generate a unique human-readable slug.
    Example: carwash-mumbai-48392
    """
    base = f"{company_name}-{location_name}" if location_name else company_name
    base_slug = slugify(base)[:40]
    suffix = str(random.randint(10000, 99999))
    return f"{base_slug}-{suffix}"


# ─────────────────────────────────────────────
#  OTP
# ─────────────────────────────────────────────
def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of given length."""
    return ''.join(random.choices(string.digits, k=length))


# ─────────────────────────────────────────────
#  IP HASHING (privacy-preserving uniqueness)
# ─────────────────────────────────────────────
def hash_ip(ip_address: str) -> str:
    """One-way hash of IP address for anonymous uniqueness tracking."""
    salt = 'webmaps-ip-salt-2024'
    return hashlib.sha256(f"{salt}{ip_address}".encode()).hexdigest()


# ─────────────────────────────────────────────
#  SECURE TOKEN
# ─────────────────────────────────────────────
def generate_secure_token(length: int = 64) -> str:
    """Generate a cryptographically safe URL-safe token."""
    import secrets
    return secrets.token_urlsafe(length)


# ─────────────────────────────────────────────
#  INPUT SANITIZATION
# ─────────────────────────────────────────────
ALLOWED_TAGS = []  # Strip all HTML


def sanitize_input(text: str) -> str:
    """Strip all HTML tags and dangerous content from user input."""
    if not text:
        return text
    cleaned = bleach.clean(str(text), tags=ALLOWED_TAGS, strip=True)
    return cleaned.strip()


# ─────────────────────────────────────────────
#  DANGEROUS PATTERN DETECTION
# ─────────────────────────────────────────────
SQL_PATTERNS = re.compile(
    r"(\b(select|insert|update|delete|drop|truncate|alter|exec|execute|union|script)\b)",
    re.IGNORECASE,
)
SCRIPT_PATTERNS = re.compile(
    r"(<script|javascript:|on\w+=|<iframe|<object|<embed|<link|<meta)",
    re.IGNORECASE,
)
COMMAND_PATTERNS = re.compile(
    r"[;&|`$]|(rm\s+-rf|chmod|chown|sudo|wget|curl\s+http)",
    re.IGNORECASE,
)


def contains_dangerous_content(text: str) -> bool:
    """Return True if text contains SQL injection, XSS, or command injection patterns."""
    if not text:
        return False
    return bool(
        SQL_PATTERNS.search(text)
        or SCRIPT_PATTERNS.search(text)
        or COMMAND_PATTERNS.search(text)
    )


def is_valid_url(url: str) -> bool:
    """Validate that a URL is a proper http/https URL."""
    pattern = re.compile(
        r'^https?://'
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$',
        re.IGNORECASE,
    )
    return bool(pattern.match(url))


# ─────────────────────────────────────────────
#  IP EXTRACTION
# ─────────────────────────────────────────────
def get_client_ip(request) -> str:
    """Extract real IP address from request, handling proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


# ─────────────────────────────────────────────
#  FILE VALIDATION
# ─────────────────────────────────────────────
def validate_upload_file(file_obj):
    """
    Validate uploaded file:
    - Extension must be .txt, .csv, or .pdf
    - Size must be <= 5MB
    - Text files must not contain script injection
    Returns (is_valid: bool, error_message: str)
    """
    from django.conf import settings
    import os

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        return False, f"File type '{ext}' is not allowed. Use txt, csv, or pdf."

    if file_obj.size > settings.FILE_UPLOAD_MAX_MEMORY_SIZE:
        mb = file_obj.size / (1024 * 1024)
        return False, f"File size {mb:.1f}MB exceeds the 5MB limit."

    if ext in ['.txt', '.csv']:
        try:
            content = file_obj.read().decode('utf-8', errors='ignore')
            file_obj.seek(0)
            if contains_dangerous_content(content):
                return False, "File contains potentially dangerous content."
        except Exception:
            return False, "Could not read file content."

    return True, ''


# ─────────────────────────────────────────────
#  SERVICE FILE PARSER
# ─────────────────────────────────────────────
def parse_service_file(file_obj) -> list:
    """
    Parse service file in format: 'Service Name = Price (Cat1, Cat2)'
    Returns list of dicts: [{'name': '...', 'price': '...', 'categories': ['...']}]
    Skips invalid lines.
    """
    services = []
    try:
        content = file_obj.read().decode('utf-8', errors='ignore')
        file_obj.seek(0)
        lines = content.splitlines()
        
        # Regex to match: Name = Price (Categories)
        # Supports: Car PPF = 90000 (PPF)
        # Supports: Car Wash = 200 ₹ (Wash)
        # Supports: Car PPF and Wash = 91000 (PPF, Wash)
        pattern = re.compile(r'^([^=]+)\s*=\s*([^(\n]+?)(?:\s*\(([^)]+)\))?\s*$', re.MULTILINE)

        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            match = pattern.match(line)
            if not match:
                continue
                
            name = match.group(1).strip()
            price = match.group(2).strip()
            categories_str = match.group(3) or "General"
            
            # Split categories and clean
            categories = [c.strip() for c in categories_str.split(',')]
            
            # Clean name and price
            if not name or not price:
                continue

            services.append({
                'name': name,
                'price': price,
                'categories': categories
            })
            
    except Exception as e:
        logger.warning(f"Service file parse error: {e}")
    return services
