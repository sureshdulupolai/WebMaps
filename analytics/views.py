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
from .models import AnalyticsEvent, EventType

logger = logging.getLogger('webmaps')

VALID_EVENT_TYPES = {e.value for e in EventType}


@csrf_exempt
@require_POST
def track_events_view(request):
    """
    Receive batched analytics events from frontend JS.
    Expected body: {"session_id": "...", "events": [...]}
    Each event: {"listing_slug": "...", "type": "click|view|map_open|time_spent", "value": 1}
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    session_id = body.get('session_id', '')
    events = body.get('events', [])
    ip_hash = hash_ip(get_client_ip(request))

    if not isinstance(events, list):
        return JsonResponse({'error': 'events must be a list.'}, status=400)

    saved = 0
    for event in events[:50]:  # Cap at 50 events per request
        event_type = event.get('type', '')
        slug = event.get('listing_slug', '')
        value = int(event.get('value', 1))

        if event_type not in VALID_EVENT_TYPES or not slug:
            continue

        try:
            listing = Listing.objects.get(slug=slug, status='approved')
            AnalyticsEvent.objects.create(
                listing=listing,
                session_id=session_id[:64],
                event_type=event_type,
                value=min(value, 86400),  # Max 1 day in seconds
                ip_hash=ip_hash,
            )
            saved += 1
        except Listing.DoesNotExist:
            continue
        except Exception as e:
            logger.error(f"Analytics event save error: {e}")

    return JsonResponse({'saved': saved})
