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
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # We only attempt authentication if the user is not already authenticated
        # via standard session-based auth.
        if not request.user.is_authenticated:
            access_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
            
            if access_token:
                try:
                    # Initialize DRF's JWTAuthentication
                    auth = JWTAuthentication()
                    
                    # Validate the token
                    validated_token = auth.get_validated_token(access_token)
                    
                    # Get the user
                    user = auth.get_user(validated_token)
                    
                    if user:
                        request.user = user
                except TokenError as e:
                    logger.debug(f"Middleware JWT TokenError: {e}")
                    # Optional: We could delete the invalid cookie here, but usually, 
                    # it's better to let the auth_app views handle that on failure.
                except Exception as e:
                    logger.warning(f"Middleware JWT Auth error: {e}")

        response = self.get_response(request)
        return response
