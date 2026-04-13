"""
payments/models.py — Subscription plans and user subscriptions.
"""
import uuid
from django.db import models
from django.utils import timezone


class SubscriptionPlan(models.Model):
    """Pre-defined subscription tiers. Seeded via data migration."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    duration_days = models.PositiveIntegerField()
    base_cost = models.PositiveIntegerField(help_text='Cost in INR (excluding platform fee)')
    platform_fee = models.PositiveIntegerField(default=50, help_text='Fixed platform fee in INR')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_plans'
        ordering = ['duration_days']

    def __str__(self):
        return f"{self.name} — ₹{self.total_cost}"

    @property
    def total_cost(self):
        return self.base_cost + self.platform_fee

    @property
    def total_cost_paise(self):
        """Convert to paise for Razorpay (1 INR = 100 paise)."""
        return self.total_cost * 100


class Subscription(models.Model):
    """Active or historical subscription for a listing."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.OneToOneField(
        'hosts.Listing',
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    razorpay_order_id = models.CharField(max_length=100, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=300, blank=True)

    is_active = models.BooleanField(default=False)
    is_trial = models.BooleanField(default=False)

    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_subscriptions'
        verbose_name = 'Subscription'

    def __str__(self):
        kind = 'Trial' if self.is_trial else str(self.plan)
        return f"{self.listing.company_name} — {kind}"

    @property
    def is_expired(self):
        if not self.expires_at:
            return True
        return timezone.now() > self.expires_at

    @property
    def remaining_days(self):
        if not self.expires_at or self.is_expired:
            return 0
        delta = self.expires_at - timezone.now()
        return max(0, delta.days)
