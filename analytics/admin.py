"""
analytics/admin.py
"""
from django.contrib import admin
from .models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ('listing', 'event_type', 'value', 'session_id', 'created_at')
    list_filter = ('event_type',)
    readonly_fields = ('id', 'created_at')
    search_fields = ('listing__company_name', 'session_id')
