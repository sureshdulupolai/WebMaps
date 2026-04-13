"""
auth_app/views.py — Registration, Login, Logout, OTP, Password Reset views.
"""
import logging
from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings
from django.utils import timezone
from django.views.decorators.http import require_POST, require_http_methods

from users.models import User, UserRole
from users.services import send_password_reset_email, reset_password
from users.validators import (
    validate_email_format, validate_username, validate_password_strength, validate_phone
)
from auth_app.cookies import get_tokens_for_user, set_auth_cookies, clear_auth_cookies
from utils.helpers import sanitize_input, get_client_ip

logger = logging.getLogger('webmaps')


# ─────────────────────────────────────────────
#  REGISTER
# ─────────────────────────────────────────────
@require_http_methods(['GET', 'POST'])
def register_view(request):
    if request.method == 'GET':
        return render(request, 'auth/register.html')

    # Sanitize inputs
    email = sanitize_input(request.POST.get('email', '').strip().lower())
    username = sanitize_input(request.POST.get('username', '').strip())
    password = request.POST.get('password', '')
    confirm_password = request.POST.get('confirm_password', '')
    role = request.POST.get('role', UserRole.CUSTOMER)
    first_name = sanitize_input(request.POST.get('first_name', '').strip())
    last_name = sanitize_input(request.POST.get('last_name', '').strip())
    phone = sanitize_input(request.POST.get('phone', '').strip())

    errors = {}

    # Validate
    try:
        validate_email_format(email)
    except Exception as e:
        errors['email'] = str(e)

    try:
        validate_username(username)
    except Exception as e:
        errors['username'] = str(e)

    try:
        validate_password_strength(password)
    except Exception as e:
        errors['password'] = str(e)

    if password != confirm_password:
        errors['confirm_password'] = 'Passwords do not match.'

    if role not in [UserRole.CUSTOMER, UserRole.HOST]:
        errors['role'] = 'Invalid role selection.'

    if phone:
        try:
            validate_phone(phone)
        except Exception as e:
            errors['phone'] = str(e)

    if User.objects.filter(email=email).exists():
        errors['email'] = 'This email is already registered.'

    if User.objects.filter(username=username).exists():
        # Generate a suggestion
        import random
        suggestion = f"{username}{random.randint(10, 999)}"
        while User.objects.filter(username=suggestion).exists():
            suggestion = f"{username}{random.randint(10, 999)}"
        errors['username'] = f'This username is already taken. How about "{suggestion}"?'

    if errors:
        return render(request, 'auth/register.html', {'errors': errors, 'form_data': request.POST})

    user = User.objects.create_user(
        email=email,
        username=username,
        password=password,
        role=role,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )

    logger.info(f"New user registered: {email}")
    
    # Auto login immediately
    access_token, refresh_token = get_tokens_for_user(user)
    response = redirect(_get_redirect_after_login(user))
    set_auth_cookies(response, access_token, refresh_token)
    return response

# ─────────────────────────────────────────────
#  REGISTER DEVELOPER
# ─────────────────────────────────────────────
@require_http_methods(['GET', 'POST'])
def register_developer_view(request):
    if request.method == 'GET':
        return render(request, 'auth/register_developer.html')

    secret_key = request.POST.get('secret_key', '').strip()
    # Simple hardcoded dev security key for demonstration / approval
    valid_key = getattr(settings, 'DEVELOPER_SECRET_KEY', 'webmaps_admin_secure_2026')
    
    if secret_key != valid_key:
        return render(request, 'auth/register_developer.html', {'error': 'Invalid Security Key. Access denied.'})

    # Validate inputs
    email = sanitize_input(request.POST.get('email', '').strip().lower())
    username = sanitize_input(request.POST.get('username', '').strip())
    password = request.POST.get('password', '')
    confirm_password = request.POST.get('confirm_password', '')
    phone = sanitize_input(request.POST.get('phone', '').strip())
    first_name = sanitize_input(request.POST.get('first_name', '').strip())
    last_name = sanitize_input(request.POST.get('last_name', '').strip())

    errors = {}

    try:
        validate_email_format(email)
    except Exception as e:
        errors['email'] = str(e)
    try:
        validate_username(username)
    except Exception as e:
        errors['username'] = str(e)
    try:
        validate_password_strength(password)
    except Exception as e:
        errors['password'] = str(e)

    if password != confirm_password:
        errors['confirm_password'] = 'Passwords do not match.'

    if phone:
        try:
            validate_phone(phone)
        except Exception as e:
            errors['phone'] = str(e)

    if User.objects.filter(email=email).exists():
        errors['email'] = 'This email is already registered.'

    if User.objects.filter(username=username).exists():
        errors['username'] = 'This username is already taken.'

    if errors:
        return render(request, 'auth/register_developer.html', {
            'errors': errors, 
            'form_data': request.POST,
            'verified_key': secret_key
        })

    # Create admin user
    user = User.objects.create_user(
        email=email,
        username=username,
        password=password,
        role=UserRole.ADMIN,  # Developer gets admin UI panel access
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )

    logger.info(f"New Developer registered: {email}")
    access_token, refresh_token = get_tokens_for_user(user)
    response = redirect('adminpanel:dashboard')
    set_auth_cookies(response, access_token, refresh_token)
    return response





# ─────────────────────────────────────────────
#  LOGIN
# ─────────────────────────────────────────────
@require_http_methods(['GET', 'POST'])
def login_view(request):
    # Already logged in?
    access_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
    if access_token:
        return redirect('maps:home')

    if request.method == 'GET':
        return render(request, 'auth/login.html')

    email = sanitize_input(request.POST.get('email', '').strip().lower())
    password = request.POST.get('password', '')

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return render(request, 'auth/login.html', {'error': 'Invalid email or password.'})

    if not user.check_password(password):
        return render(request, 'auth/login.html', {'error': 'Invalid email or password.'})

    if not user.is_active:
        return render(request, 'auth/login.html', {'error': 'This account has been deactivated.'})

    # Update IP
    user.last_login_ip = get_client_ip(request)
    user.save(update_fields=['last_login_ip'])

    # Check subscription expiry notifications on login
    try:
        from notifications.services import check_expiry_notifications
        check_expiry_notifications(user)
    except Exception:
        pass

    access_token, refresh_token = get_tokens_for_user(user)
    response = redirect(_get_redirect_after_login(user))
    set_auth_cookies(response, access_token, refresh_token)
    logger.info(f"User logged in: {email}")
    return response


def _get_redirect_after_login(user):
    """Return appropriate redirect URL based on user role."""
    if user.role == UserRole.ADMIN:
        return 'adminpanel:dashboard'
    elif user.role == UserRole.HOST:
        return 'hosts:dashboard'
    else:
        return 'maps:home'


# ─────────────────────────────────────────────
#  LOGOUT
# ─────────────────────────────────────────────
@require_POST
def logout_view(request):
    response = redirect('auth_app:login')
    clear_auth_cookies(response)
    # Blacklist refresh token if present
    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    if refresh_token:
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
    logger.info(f"User logged out")
    return response


# ─────────────────────────────────────────────
#  REFRESH TOKEN
# ─────────────────────────────────────────────
@require_POST
def refresh_token_view(request):
    from django.http import JsonResponse
    from rest_framework_simplejwt.tokens import RefreshToken
    from rest_framework_simplejwt.exceptions import TokenError

    refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    if not refresh_token:
        return JsonResponse({'error': 'No refresh token.'}, status=401)

    try:
        token = RefreshToken(refresh_token)
        new_access = str(token.access_token)
        new_refresh = str(token)
        response = JsonResponse({'status': 'ok'})
        set_auth_cookies(response, new_access, new_refresh)
        return response
    except TokenError as e:
        response = JsonResponse({'error': str(e)}, status=401)
        clear_auth_cookies(response)
        return response


# ─────────────────────────────────────────────
#  PASSWORD RESET
# ─────────────────────────────────────────────
@require_http_methods(['GET', 'POST'])
def password_reset_request_view(request):
    if request.method == 'GET':
        return render(request, 'auth/password_reset_request.html')

    email = sanitize_input(request.POST.get('email', '').strip().lower())
    try:
        user = User.objects.get(email=email)
        send_password_reset_email(user)
    except User.DoesNotExist:
        pass  # Don't reveal if email exists

    return render(request, 'auth/password_reset_request.html', {
        'success': 'If that email is registered, a reset link has been sent.'
    })


@require_http_methods(['GET', 'POST'])
def password_reset_confirm_view(request):
    if request.method == 'GET':
        token = request.GET.get('token', '')
        uid = request.GET.get('uid', '')
        return render(request, 'auth/password_reset_confirm.html', {'token': token, 'uid': uid})

    token = sanitize_input(request.POST.get('token', ''))
    uid = sanitize_input(request.POST.get('uid', ''))
    new_password = request.POST.get('new_password', '')
    confirm_password = request.POST.get('confirm_password', '')

    if new_password != confirm_password:
        return render(request, 'auth/password_reset_confirm.html', {
            'token': token, 'uid': uid,
            'error': 'Passwords do not match.'
        })

    try:
        from users.validators import validate_password_strength
        validate_password_strength(new_password)
    except Exception as e:
        return render(request, 'auth/password_reset_confirm.html', {
            'token': token, 'uid': uid, 'error': str(e)
        })

    try:
        user = User.objects.get(id=uid)
    except (User.DoesNotExist, Exception):
        return render(request, 'auth/password_reset_confirm.html', {
            'error': 'Invalid reset link.'
        })

    success, message = reset_password(user, token, new_password)
    if success:
        return redirect('auth_app:login')
    return render(request, 'auth/password_reset_confirm.html', {
        'token': token, 'uid': uid, 'error': message
    })
