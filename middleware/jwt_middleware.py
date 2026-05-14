import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError

User = get_user_model()
logger = logging.getLogger('webmaps')

class JWTAuthenticationMiddleware:
    """
    Middleware to authenticate users globally using JWT tokens stored in cookies.
    This ensures that request.user is populated even on standard (non-DRF) Django views.
    Includes automatic token refresh logic if access token is expired.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.user.is_authenticated:
            access_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
            refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
            
            if access_token:
                auth = JWTAuthentication()
                try:
                    # Try to validate existing access token
                    validated_token = auth.get_validated_token(access_token)
                    user = auth.get_user(validated_token)
                    if user:
                        request.user = user
                except Exception as e:
                    # If token is invalid/expired, try to refresh
                    # We don't log this as a warning because it's a normal occurrence
                    if refresh_token:
                        try:
                            from rest_framework_simplejwt.tokens import RefreshToken
                            refresh = RefreshToken(refresh_token)
                            new_access_token = str(refresh.access_token)
                            
                            # Validate new access token and get user
                            validated_token = auth.get_validated_token(new_access_token)
                            user = auth.get_user(validated_token)
                            
                            if user:
                                request.user = user
                                # Store new token to set in response cookie later
                                request._new_access_token = new_access_token
                        except Exception as refresh_err:
                            # Refresh failed (e.g. refresh token expired)
                            # Still no need to log a loud warning, just clear cookies
                            request._clear_auth_cookies = True
                    else:
                        request._clear_auth_cookies = True

        response = self.get_response(request)

        # Apply cookie updates to the response
        if hasattr(request, '_new_access_token'):
            response.set_cookie(
                settings.JWT_ACCESS_COOKIE,
                request._new_access_token,
                httponly=True,
                samesite='Lax',
                secure=not settings.DEBUG
            )
        
        if getattr(request, '_clear_auth_cookies', False):
            response.delete_cookie(settings.JWT_ACCESS_COOKIE)
            response.delete_cookie(settings.JWT_REFRESH_COOKIE)

        return response
