"""
users/services.py — Business logic for user management.
"""
import logging
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from datetime import timedelta
from utils.helpers import generate_otp, generate_secure_token

logger = logging.getLogger('webmaps')


def send_password_reset_email(user):
    """Generate and email a password reset token."""
    token = generate_secure_token(48)
    user.password_reset_token = token
    user.reset_token_expires_at = timezone.now() + timedelta(
        minutes=settings.PASSWORD_RESET_EXPIRY_MINUTES
    )
    user.save(update_fields=['password_reset_token', 'reset_token_expires_at'])

    reset_url = f"{settings.SITE_URL}/auth/password-reset/confirm/?token={token}&uid={user.id}"
    subject = 'WebMaps — Password Reset Request'
    message = (
        f"Hi {user.username},\n\n"
        f"Click the link below to reset your password:\n{reset_url}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_EXPIRY_MINUTES} minutes.\n\n"
        f"If you did not request this, please ignore.\n\n"
        f"— WebMaps Team"
    )
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
        logger.info(f"Password reset email sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send reset email to {user.email}: {e}")


def reset_password(user, token: str, new_password: str) -> tuple:
    """
    Validate reset token and set new password.
    Returns (success: bool, message: str)
    """
    if not user.is_reset_token_valid:
        return False, 'Reset token has expired or is invalid.'
    if user.password_reset_token != token:
        return False, 'Invalid reset token.'
    user.set_password(new_password)
    user.password_reset_token = None
    user.reset_token_expires_at = None
    user.save(update_fields=['password', 'password_reset_token', 'reset_token_expires_at'])
    return True, 'Password reset successfully.'
