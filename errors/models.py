"""
errors/models.py — Deduplicating error log model.
"""
import uuid
from django.db import models
from django.utils import timezone


class AppError(models.Model):
    """
    Stores application errors without duplicates.
    Same (error_message + url_path) → increment occurrence_count.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    error_message = models.CharField(max_length=500, db_index=True)
    url_path = models.CharField(max_length=200, db_index=True)
    error_type = models.CharField(max_length=10, default='500')
    first_seen_at = models.DateTimeField(default=timezone.now)
    last_seen_at = models.DateTimeField(default=timezone.now)
    occurrence_count = models.PositiveIntegerField(default=1)
    traceback = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'app_errors'
        unique_together = ('error_message', 'url_path')
        ordering = ['-last_seen_at']
        verbose_name = 'Application Error'
        verbose_name_plural = 'Application Errors'

    def __str__(self):
        return f"[{self.error_type}] {self.error_message[:60]} ({self.occurrence_count}x)"
