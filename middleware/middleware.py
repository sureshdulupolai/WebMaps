"""
middleware/middleware.py — Custom middleware stack for WebMaps.

Includes:
  - SecurityHeadersMiddleware:   Adds CSP, Referrer-Policy headers
  - RateLimitMiddleware:         Sliding window rate limiting per IP
  - BotProtectionMiddleware:     Blocks known malicious user agents
  - CustomErrorMiddleware:       Forces premium error pages regardless of DEBUG mode
  - ErrorCaptureMiddleware:      Captures unhandled exceptions to DB
  - ActivityTrackingMiddleware:  Tags requests with session IDs
"""
import re
import time
import logging
import hashlib
import traceback
from collections import defaultdict, deque
from threading import Lock

from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('webmaps')

# Thread-safe in-memory rate limit store
# { ip_hash: deque([timestamp, ...]) }
_rate_limit_store = defaultdict(deque)
_rate_limit_lock = Lock()


# ─────────────────────────────────────────────
#  1. SECURITY HEADERS
# ─────────────────────────────────────────────
class SecurityHeadersMiddleware:
    """Adds security response headers to every response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(self), camera=(), microphone=()'
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://checkout.razorpay.com https://cdn.razorpay.com https://unpkg.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://unpkg.com https://*.tile.openstreetmap.org; "
            "connect-src 'self' https://maps.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com https://nominatim.openstreetmap.org https://unpkg.com; "
            "frame-src https://checkout.razorpay.com https://api.razorpay.com;"
        )
        return response


# ─────────────────────────────────────────────
#  2. RATE LIMIT MIDDLEWARE
# ─────────────────────────────────────────────
class RateLimitMiddleware:
    """
    Sliding-window rate limit per IP.
    Login: 5 req/min, Register: 3 req/min, API: 100 req/min
    """

    RATE_RULES = [
        (re.compile(r'^/auth/login/'), 'login', 60, 5),
        (re.compile(r'^/auth/register/'), 'register', 60, 3),
        (re.compile(r'^/api/'), 'api', 60, 100),
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def _get_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR', '')
        return hashlib.md5(ip.encode()).hexdigest()

    def _is_rate_limited(self, ip_key: str, window_key: str, window_seconds: int, max_count: int) -> bool:
        key = f"{ip_key}:{window_key}"
        now = time.time()
        with _rate_limit_lock:
            dq = _rate_limit_store[key]
            # Remove timestamps outside window
            while dq and now - dq[0] > window_seconds:
                dq.popleft()
            if len(dq) >= max_count:
                return True
            dq.append(now)
            return False

    def __call__(self, request):
        ip_key = self._get_ip(request)
        path = request.path_info

        # Skip if rate limiting is disabled
        if not getattr(settings, 'ENABLE_RATE_LIMITING', True):
            return self.get_response(request)

        for pattern, rule_name, window, max_count in self.RATE_RULES:
            if pattern.match(path):
                if self._is_rate_limited(ip_key, rule_name, window, max_count):
                    logger.warning(f"Rate limit hit: {rule_name} from {ip_key[:8]}...")
                    
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse(
                            {'error': 'Too many requests. Please slow down.'},
                            status=429
                        )
                    
                    # Premium rendering of the 429 error page
                    try:
                        from errors.views import error_429
                        return error_429(request)
                    except ImportError:
                        return HttpResponse(
                            '<html><body style="background:#08090d;color:#fff;display:grid;place-items:center;height:100vh;font-family:sans-serif;">'
                            '<h2>Too many requests. Please slow down.</h2></body></html>',
                            status=429,
                            content_type='text/html',
                        )
                break

        return self.get_response(request)


# ─────────────────────────────────────────────
#  3. CUSTOM ERROR PAGES (DEBUG-safe)
# ─────────────────────────────────────────────
class CustomErrorMiddleware:
    """
    Forces our premium custom error templates to render for 404, 403, and 500
    responses — even when DEBUG=True (where Django normally shows its
    yellow debug page instead of calling handler404/handler500/handler403).

    Works by:
      - Wrapping the response in __call__ to catch HTTP 404/403 codes.
      - Using process_exception for unhandled exceptions (500 errors).
    """

    # Paths the middleware must NEVER intercept
    _SKIP_PREFIXES = ('/static/', '/media/', '/admin/', '/favicon')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Never block static/media/admin assets
        for prefix in self._SKIP_PREFIXES:
            if request.path_info.startswith(prefix):
                return self.get_response(request)

        try:
            response = self.get_response(request)
        except Exception:
            raise

        # Intercept 404 / 403 and render our premium templates
        if response.status_code == 404:
            from errors.views import error_404
            return error_404(request)

        if response.status_code == 403:
            from errors.views import error_403
            return error_403(request)

        return response

    def process_exception(self, request, exception):
        """
        Called for any unhandled exception — replaces the default
        Django 500 yellow page with our premium 500 template.
        """
        logger.error(
            f"Unhandled exception at {request.path}: "
            f"{type(exception).__name__}: {exception}"
        )
        try:
            from errors.views import error_500
            return error_500(request)
        except Exception as e:
            logger.error(f"CustomErrorMiddleware.process_exception failed: {e}")
            return None  # Fall back to Django default


# ─────────────────────────────────────────────
#  4. BOT PROTECTION MIDDLEWARE
# ─────────────────────────────────────────────
class BotProtectionMiddleware:
    """Block known bad bots and scrapers by User-Agent patterns."""

    BAD_AGENTS = re.compile(
        r'(curl|wget|python-requests|scrapy|ahrefsbot|semrushbot|dotbot|'
        r'mj12bot|blexbot|majestic|rogerbot|sistrix|dataprovider|'
        r'zgrab|masscan|nmap|nikto|sqlmap|libwww)',
        re.IGNORECASE,
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ua = request.META.get('HTTP_USER_AGENT', '')
        if self.BAD_AGENTS.search(ua):
            logger.warning(f"Bot blocked: {ua[:80]}")
            return HttpResponse(status=403)
        return self.get_response(request)


# ─────────────────────────────────────────────
#  4. ERROR CAPTURE MIDDLEWARE
# ─────────────────────────────────────────────
class ErrorCaptureMiddleware:
    """
    Catches unhandled exceptions and stores them in the AppError model.
    Deduplicates: same error+path only increments occurrence_count.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        try:
            from errors.models import AppError
            error_message = f"{type(exception).__name__}: {str(exception)}"
            url_path = request.path_info
            error_type = '500'

            obj, created = AppError.objects.get_or_create(
                error_message=error_message[:500],
                url_path=url_path[:200],
                defaults={
                    'error_type': error_type,
                    'first_seen_at': timezone.now(),
                    'last_seen_at': timezone.now(),
                    'occurrence_count': 1,
                    'traceback': traceback.format_exc(),
                }
            )
            if not created:
                obj.last_seen_at = timezone.now()
                obj.occurrence_count += 1
                obj.traceback = traceback.format_exc()
                obj.save(update_fields=['last_seen_at', 'occurrence_count', 'traceback'])

            logger.error(f"Captured error: {error_message} @ {url_path}")
        except Exception as e:
            logger.error(f"ErrorCaptureMiddleware itself failed: {e}")

        return None  # Let Django's default error handler run


# ─────────────────────────────────────────────
#  5. ACTIVITY TRACKING MIDDLEWARE
# ─────────────────────────────────────────────
class ActivityTrackingMiddleware:
    """
    Tags each request with a session tracking key.
    Used by analytics app for unique-visitor counting.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.session.session_key:
            request.session.create()
        request.session_id = request.session.session_key
        return self.get_response(request)
