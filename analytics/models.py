"""
analytics/models.py — Event tracking for listings.
"""
import uuid
from django.db import models


class EventType(models.TextChoices):
    CLICK = 'click', 'Click'
    VIEW = 'view', 'View'
    MAP_OPEN = 'map_open', 'Map Opened'
    TIME_SPENT = 'time_spent', 'Time Spent'


class AnalyticsEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        'hosts.Listing',
        on_delete=models.CASCADE,
        related_name='analytics_events',
        db_index=True,
    )
    session_id = models.CharField(max_length=64, db_index=True)
    event_type = models.CharField(max_length=15, choices=EventType.choices, db_index=True)
    value = models.PositiveIntegerField(default=1, help_text='Seconds for time_spent, 1 for counts')
    ip_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'analytics_events'
        ordering = ['-created_at']
        verbose_name = 'Analytics Event'
        verbose_name_plural = 'Analytics Events'
        indexes = [
            models.Index(fields=['listing', 'event_type']),
            models.Index(fields=['listing', 'ip_hash']),
        ]

    def __str__(self):
        return f"{self.event_type} @ {self.listing.company_name}"
