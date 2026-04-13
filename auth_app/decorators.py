"""
auth_app/decorators.py — View decorators for JWT-based authentication.
"""
from functools import wraps
from django.shortcuts import redirect
from django.conf import settings
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
import logging

logger = logging.getLogger('webmaps')


def jwt_login_required(view_func):
    """
    Decorator for standard Django views using JWT cookie auth.
    Attaches the authenticated user to request.user.
    Redirects to login if no valid token found.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if not token:
            return redirect('auth_app:login')
        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            auth = JWTAuthentication()
            validated = auth.get_validated_token(token)
            user = auth.get_user(validated)
            request.user = user
            request._jwt_token = token
        except TokenError as e:
            logger.debug(f"JWT decode error: {e}")
            response = redirect('auth_app:login')
            response.delete_cookie(settings.JWT_ACCESS_COOKIE)
            response.delete_cookie(settings.JWT_REFRESH_COOKIE)
            return response
        return view_func(request, *args, **kwargs)
    return wrapper


def role_required(*roles):
    """
    Decorator requiring the user to have one of the given roles.
    Must be used AFTER @jwt_login_required.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if request.user.role not in roles:
                return redirect('maps:home')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
