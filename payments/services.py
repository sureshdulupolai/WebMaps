"""
payments/services.py — Razorpay integration and subscription management.
"""
import logging
import hmac
import hashlib
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import SubscriptionPlan, Subscription

logger = logging.getLogger('webmaps')


def get_razorpay_client():
    """Return authenticated Razorpay client."""
    import razorpay
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_razorpay_order(amount_inr, listing_id: str) -> dict:
    """
    Create a Razorpay order for the given amount.
    Returns order dict with id, amount, etc.
    """
    client = get_razorpay_client()
    # Ensure amount is an integer in paise
    amount_paise = int(round(float(amount_inr) * 100))
    
    order = client.order.create({
        'amount': amount_paise,
        'currency': 'INR',
        'receipt': f'receipt_{str(listing_id)[:20]}',
        'notes': {'listing_id': str(listing_id)},
    })
    logger.info(f"Razorpay order created: {order['id']} for listing {listing_id}")
    return order


def verify_razorpay_payment(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verify Razorpay payment signature.
    Returns True if valid, False otherwise.
    """
    key = settings.RAZORPAY_KEY_SECRET.encode()
    message = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(key, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def activate_subscription(listing, plan: SubscriptionPlan, payment_data: dict, is_update_only=False):
    """Activate (or renew) a paid subscription for a listing."""
    sub, _ = Subscription.objects.get_or_create(listing=listing)
    sub.plan = plan
    sub.is_trial = False
    sub.is_active = True
    sub.razorpay_order_id = payment_data.get('order_id') or ''
    sub.razorpay_payment_id = payment_data.get('payment_id') or ''
    sub.razorpay_signature = payment_data.get('signature') or ''
    
    if not is_update_only:
        sub.starts_at = timezone.now()
        sub.expires_at = timezone.now() + timedelta(days=plan.duration_days)
        
    sub.save()
    
    # Auto-approve listing upon payment so it goes live immediately
    from hosts.models import ListingStatus
    listing.status = ListingStatus.APPROVED
    listing.rejection_reason = ''
    listing.save(update_fields=['status', 'rejection_reason'])
    
    logger.info(f"Subscription activated and listing approved: {listing.slug}")
    return sub


def start_free_trial(listing):
    """Start a 3-day free trial after admin approval."""
    days = settings.FREE_TRIAL_DAYS
    sub, _ = Subscription.objects.get_or_create(listing=listing)
    sub.plan = None
    sub.is_trial = True
    sub.is_active = True
    sub.starts_at = timezone.now()
    sub.expires_at = timezone.now() + timedelta(days=days)
    sub.save()
    logger.info(f"Free trial started for listing {listing.slug} ({days} days)")
    return sub


def get_all_plans():
    """Return all available subscription plans ordered by duration."""
    return SubscriptionPlan.objects.all().order_by('duration_days')


def seed_subscription_plans():
    """
    Idempotent seeding of default plans.
    Call from management command or migration.
    """
    plans = [
        {'name': '1 Month', 'duration_days': 30, 'base_cost': 181},
        {'name': '3 Months', 'duration_days': 90, 'base_cost': 402},
        {'name': '1 Year', 'duration_days': 365, 'base_cost': 1502},
    ]
    for p in plans:
        SubscriptionPlan.objects.update_or_create(name=p['name'], defaults={
            'duration_days': p['duration_days'],
            'base_cost': p['base_cost'],
            'platform_fee': 2,
        })
    logger.info("Subscription plans seeded.")
