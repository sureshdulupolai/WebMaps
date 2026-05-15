"""
analytics/services.py — Analytics aggregation.
"""
from django.db.models import Sum, Count
from .models import EventType


def aggregate_listing_stats(listing_id) -> dict:
    """Return aggregated stats for a listing dashboard."""
    from django.db.models import Sum
    from .models import ListingDailyStats

    qs = ListingDailyStats.objects.filter(listing_id=listing_id)
    
    stats = qs.aggregate(
        clicks=Sum('clicks_count'),
        views=Sum('views_count'),
        map_opens=Sum('map_opens_count'),
        time_spent=Sum('total_time_spent'),
        unique_visitors=Sum('unique_visitors_count')
    )

    return {
        'clicks': stats['clicks'] or 0,
        'views': stats['views'] or 0,
        'map_opens': stats['map_opens'] or 0,
        'time_spent_seconds': stats['time_spent'] or 0,
        'unique_visitors': stats['unique_visitors'] or 0,
    }
