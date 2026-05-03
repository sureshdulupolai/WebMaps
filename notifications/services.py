"""
notifications/services.py — Notification creation and expiry checks.
"""
import logging
from django.conf import settings
from django.utils import timezone
from .models import Notification

logger = logging.getLogger('webmaps')


def create_notification(user, message: str, expires_at=None) -> Notification:
    """Create a new notification for a user. Defaults to 30 days expiry if not set."""
    if not expires_at:
        from datetime import timedelta
        expires_at = timezone.now() + timedelta(days=30)
        
    notif = Notification.objects.create(user=user, message=message, expires_at=expires_at)
    logger.info(f"Notification created for {user.email}: {message[:60]}")
    return notif


def check_expiry_notifications(user):
    """
    Called on each login for host users.
    If any subscription expires within SUBSCRIPTION_NOTIFY_DAYS_BEFORE days,
    and no similar notification was sent today, create one.
    """
    if user.role != 'host':
        return

    from hosts.models import Listing
    from payments.models import Subscription

    listings = Listing.objects.filter(host=user, status='approved', deleted_at__isnull=True)
    notify_days = settings.SUBSCRIPTION_NOTIFY_DAYS_BEFORE
    today = timezone.now().date()

    for listing in listings:
        try:
            sub = Subscription.objects.get(listing=listing, is_active=True)
        except Subscription.DoesNotExist:
            continue

        if sub.expires_at and sub.remaining_days <= notify_days:
            # Check if already notified today
            already_notified = Notification.objects.filter(
                user=user,
                message__contains=listing.company_name,
                created_at__date=today,
            ).exists()

            if not already_notified:
                kind = 'free trial' if sub.is_trial else 'subscription'
                create_notification(
                    user,
                    f"⚠️ Your {kind} for '{listing.company_name}' expires in "
                    f"{sub.remaining_days} day(s). Renew now to stay visible."
                )


def mark_all_read(user):
    """Mark all notifications as read for a user."""
    Notification.objects.filter(user=user, is_read=False).update(is_read=True)
