from django.contrib import admin
from .models import Coupon, CouponUsage, CouponAttempt, Notification

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'coupon_id', 'discount_type', 'discount_value', 'target', 'is_active', 'usage_count', 'expire_date')
    search_fields = ('code', 'coupon_id')
    list_filter = ('discount_type', 'target', 'is_active')

@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ('coupon', 'user', 'discount_applied', 'final_amount', 'used_at')

@admin.register(CouponAttempt)
class CouponAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'failed_attempts', 'last_failed_at', 'blocked_until')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'is_read', 'created_at')
