from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import string
import random
from datetime import timedelta

User = get_user_model()

def generate_coupon_id():
    return ''.join(random.choices(string.digits, k=12))

class Coupon(models.Model):
    TARGET_CHOICES = (
        ('all', 'All Users'),
        ('specific', 'Specific User'),
        ('hidden', 'Hidden (No Notification)'),
    )
    
    DISCOUNT_TYPE = (
        ('percentage', 'Percentage (%)'),
        ('fixed', 'Fixed Amount (₹)'),
    )

    coupon_id = models.CharField(max_length=12, default=generate_coupon_id, unique=True, editable=False)
    code = models.CharField(max_length=20, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    
    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    target = models.CharField(max_length=20, choices=TARGET_CHOICES, default='all')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='exclusive_coupons')
    
    start_date = models.DateTimeField(default=timezone.now)
    expire_date = models.DateTimeField()
    
    is_active = models.BooleanField(default=True)
    
    usage_limit = models.PositiveIntegerField(default=1, help_text="How many times this coupon can be used overall")
    usage_count = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self, user=None, amount=0):
        now = timezone.now()
        if not self.is_active:
            return False, "This coupon is currently disabled."
        if now < self.start_date or now > self.expire_date:
            return False, "This coupon has expired or is not yet valid."
        if self.usage_count >= self.usage_limit:
            return False, "This coupon has reached its usage limit."
        if amount < self.min_purchase_amount:
            return False, f"Minimum purchase of ₹{self.min_purchase_amount} required."
        
        if self.target == 'specific' and user != self.user:
            return False, "This coupon is not valid for your account."
            
        return True, "Valid"

    def __str__(self):
        return f"{self.code} ({self.discount_value} {self.discount_type})"

class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    listing_slug = models.CharField(max_length=255)
    discount_applied = models.DecimalField(max_digits=10, decimal_places=2)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)

class CouponAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    failed_attempts = models.PositiveIntegerField(default=0)
    last_failed_at = models.DateTimeField(auto_now=True)
    blocked_until = models.DateTimeField(null=True, blank=True)

    def is_blocked(self):
        if self.blocked_until and timezone.now() < self.blocked_until:
            return True
        return False

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coupon_notifications')
    title = models.CharField(max_length=100)
    message = models.TextField()
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
