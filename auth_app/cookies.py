"""
auth_app/cookies.py — Helper functions for setting/clearing JWT cookies securely.
"""
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def get_tokens_for_user(user):
    """Generate access + refresh tokens for a given user."""
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


def set_auth_cookies(response, access_token: str, refresh_token: str, remember: bool = False):
    """
    Set JWT tokens as HTTPOnly, Secure cookies on the response.
    Never visible to JavaScript.
    If remember is False, the cookies will expire when the browser is closed (Session cookies).
    """
    jwt_settings = settings.SIMPLE_JWT
    secure = jwt_settings.get('AUTH_COOKIE_SECURE', False)
    http_only = jwt_settings.get('AUTH_COOKIE_HTTP_ONLY', True)
    samesite = jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax')

    # Expiry logic
    # If remember is False, set max_age to None for session-only cookies
    access_max_age = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()) if remember else None
    refresh_max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()) if remember else None

    # Access token cookie
    response.set_cookie(
        key=settings.JWT_ACCESS_COOKIE,
        value=access_token,
        max_age=access_max_age,
        secure=secure,
        httponly=http_only,
        samesite=samesite,
        path='/',
    )

    # Refresh token cookie
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE,
        value=refresh_token,
        max_age=refresh_max_age,
        secure=secure,
        httponly=http_only,
        samesite=samesite,
        path='/',
    )

    return response


def clear_auth_cookies(response):
    """Clear both JWT cookies on logout."""
    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path='/')
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/')
    return response
