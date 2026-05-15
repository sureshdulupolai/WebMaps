"""
analytics/admin.py
"""
from django.contrib import admin
from .models import ListingDailyStats, DailyUniqueVisitor


@admin.register(ListingDailyStats)
class ListingDailyStatsAdmin(admin.ModelAdmin):
    list_display = ('listing', 'date', 'views_count', 'clicks_count', 'unique_visitors_count')
    list_filter = ('date', 'listing')
    search_fields = ('listing__company_name',)


@admin.register(DailyUniqueVisitor)
class DailyUniqueVisitorAdmin(admin.ModelAdmin):
    list_display = ('listing', 'date', 'ip_hash')
    list_filter = ('date',)
