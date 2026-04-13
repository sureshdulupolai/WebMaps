"""
auth_app/authentication.py — Custom JWT authentication reading from HTTPOnly cookies.
Replaces the default DRF Bearer token header approach.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import logging

logger = logging.getLogger('webmaps')


class CookieJWTAuthentication(JWTAuthentication):
    """
    Reads JWT access token from HTTPOnly cookie instead of Authorization header.
    Falls back to Authorization header for API clients.
    """

    def authenticate(self, request):
        # Try cookie first
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)

        # Fallback to Authorization header
        if not raw_token:
            header = self.get_header(request)
            if header is None:
                return None
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            return user, validated_token
        except TokenError as e:
            raise InvalidToken({'detail': str(e)})
        except Exception as e:
            logger.warning(f"JWT auth error: {e}")
            return None
