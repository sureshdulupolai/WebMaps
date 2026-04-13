"""
analytics/services.py — Analytics aggregation.
"""
from django.db.models import Sum, Count
from .models import AnalyticsEvent, EventType


def aggregate_listing_stats(listing_id) -> dict:
    """Return aggregated stats for a listing dashboard."""
    qs = AnalyticsEvent.objects.filter(listing_id=listing_id)

    clicks = qs.filter(event_type=EventType.CLICK).count()
    views = qs.filter(event_type=EventType.VIEW).count()
    map_opens = qs.filter(event_type=EventType.MAP_OPEN).count()
    time_spent = qs.filter(event_type=EventType.TIME_SPENT).aggregate(
        total=Sum('value')
    )['total'] or 0

    unique_visitors = qs.filter(
        event_type=EventType.VIEW
    ).values('ip_hash').distinct().count()

    return {
        'clicks': clicks,
        'views': views,
        'map_opens': map_opens,
        'time_spent_seconds': time_spent,
        'unique_visitors': unique_visitors,
    }
