"""
payments/admin.py
"""
from django.contrib import admin
from .models import SubscriptionPlan, Subscription


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'duration_days', 'base_cost', 'platform_fee', 'total_cost')
    readonly_fields = ('id', 'created_at')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('listing', 'plan', 'is_active', 'is_trial', 'starts_at', 'expires_at', 'remaining_days')
    list_filter = ('is_active', 'is_trial')
    readonly_fields = ('id', 'created_at', 'updated_at', 'remaining_days')
    search_fields = ('listing__company_name',)
