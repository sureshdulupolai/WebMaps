"""
analytics/views.py — REST API endpoint for batched event tracking.
"""
import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from hosts.models import Listing
from utils.helpers import hash_ip, get_client_ip
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import ListingDailyStats, DailyUniqueVisitor, EventType

logger = logging.getLogger('webmaps')
VALID_EVENT_TYPES = {e.value for e in EventType}

@csrf_exempt
@require_POST
def track_events_view(request):
    """
    Receive batched analytics events from frontend JS.
    Aggregates events into ListingDailyStats to minimize DB size.
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    events = body.get('events', [])
    ip_hash = hash_ip(get_client_ip(request))
    today = timezone.now().date()

    if not isinstance(events, list):
        return JsonResponse({'error': 'events must be a list.'}, status=400)

    saved = 0
    for event in events[:50]:
        event_type = event.get('type', '')
        slug = event.get('listing_slug', '')
        value = int(event.get('value', 1))

        if event_type not in VALID_EVENT_TYPES or not slug:
            continue

        try:
            listing = Listing.objects.get(slug=slug, status='approved')
            
            with transaction.atomic():
                # 1. Get or create the daily stats row
                stats, created = ListingDailyStats.objects.get_or_create(
                    listing=listing,
                    date=today
                )

                # 2. Update counters based on event type
                if event_type == EventType.VIEW:
                    stats.views_count = F('views_count') + 1
                    # Handle Unique Visitor
                    uv, uv_created = DailyUniqueVisitor.objects.get_or_create(
                        listing=listing,
                        date=today,
                        ip_hash=ip_hash
                    )
                    if uv_created:
                        stats.unique_visitors_count = F('unique_visitors_count') + 1
                
                elif event_type == EventType.CLICK:
                    stats.clicks_count = F('clicks_count') + 1
                
                elif event_type == EventType.MAP_OPEN:
                    stats.map_opens_count = F('map_opens_count') + 1
                
                elif event_type == EventType.TIME_SPENT:
                    stats.total_time_spent = F('total_time_spent') + min(value, 3600)

                stats.save()
                saved += 1

        except Listing.DoesNotExist:
            continue
        except Exception as e:
            logger.error(f"Analytics aggregation error: {e}")

    return JsonResponse({'saved': saved})
