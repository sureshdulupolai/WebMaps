"""
analytics/models.py — Event tracking for listings.
"""
import uuid
from django.db import models
from django.utils import timezone


class EventType(models.TextChoices):
    CLICK = 'click', 'Click'
    VIEW = 'view', 'View'
    MAP_OPEN = 'map_open', 'Map Opened'
    TIME_SPENT = 'time_spent', 'Time Spent'


class ListingDailyStats(models.Model):
    """
    Stores aggregated stats per listing per day.
    Drastically reduces database size by using counters instead of rows-per-event.
    """
    listing = models.ForeignKey(
        'hosts.Listing',
        on_delete=models.CASCADE,
        related_name='daily_stats',
        db_index=True,
    )
    date = models.DateField(default=timezone.now, db_index=True)
    
    views_count = models.PositiveIntegerField(default=0)
    clicks_count = models.PositiveIntegerField(default=0)
    map_opens_count = models.PositiveIntegerField(default=0)
    total_time_spent = models.PositiveIntegerField(default=0)
    unique_visitors_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'listing_daily_stats'
        unique_together = ('listing', 'date')
        verbose_name = 'Daily Listing Stat'
        verbose_name_plural = 'Daily Listing Stats'

    def __str__(self):
        return f"{self.listing.company_name} - {self.date}"


class DailyUniqueVisitor(models.Model):
    """
    Temporary storage to track unique visitors per listing per day.
    One row per user per listing per day (much smaller than one row per click).
    """
    listing = models.ForeignKey('hosts.Listing', on_delete=models.CASCADE)
    date = models.DateField(default=timezone.now)
    ip_hash = models.CharField(max_length=64)

    class Meta:
        db_table = 'daily_unique_visitors'
        unique_together = ('listing', 'date', 'ip_hash')
        indexes = [
            models.Index(fields=['listing', 'date', 'ip_hash']),
        ]
