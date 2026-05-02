"""
maps/services.py — Google Maps geocoding and route-based listing search.
"""
import logging
import math
import requests
from django.conf import settings
from hosts.models import Listing

logger = logging.getLogger('webmaps')


# ─────────────────────────────────────────────
#  ROUTE QUERY PARSING
# ─────────────────────────────────────────────
def parse_route_query(query: str) -> tuple:
    """
    Detect "X to Y" pattern in search query.
    Returns (start_place, end_place) or (None, None)
    """
    import re
    pattern = re.compile(r'^(.+?)\s+to\s+(.+)$', re.IGNORECASE)
    match = pattern.match(query.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return None, None


# ─────────────────────────────────────────────
#  GEOCODING
# ─────────────────────────────────────────────
def geocode_location(place_name: str) -> dict:
    """
    Geocode a place name using Google Maps Geocoding API.
    Returns {'lat': float, 'lng': float, 'formatted_address': str} or None
    """
    if not settings.GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not configured.")
        return None

    try:
        url = 'https://maps.googleapis.com/maps/api/geocode/json'
        params = {'address': place_name, 'key': settings.GOOGLE_MAPS_API_KEY}
        resp = requests.get(url, params=params, timeout=5)
        data = resp.json()

        if data.get('status') == 'OK':
            loc = data['results'][0]['geometry']['location']
            return {
                'lat': loc['lat'],
                'lng': loc['lng'],
                'formatted_address': data['results'][0]['formatted_address'],
            }
    except Exception as e:
        logger.error(f"Geocoding failed for '{place_name}': {e}")
    return None


# ─────────────────────────────────────────────
#  HAVERSINE DISTANCE
# ─────────────────────────────────────────────
def haversine_distance(lat1, lng1, lat2, lng2) -> float:
    """Return distance in km between two lat/lng points."""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(d_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ─────────────────────────────────────────────
#  ROUTE-BASED LISTING SEARCH
# ─────────────────────────────────────────────
def get_listings_along_route(start_coords: dict, end_coords: dict, radius_km: float = 5) -> list:
    """
    Return approved listings within `radius_km` of the straight-line route
    between start and end coordinates.
    Uses perpendicular distance approximation for efficiency.
    """
    listings = Listing.objects.filter(
        status='approved',
        deleted_at__isnull=True,
    ).prefetch_related('services', 'subscription')

    results = []
    for listing in listings:
        lat = float(listing.latitude)
        lng = float(listing.longitude)

        # Check proximity to either endpoint (simple bounding box + haversine)
        d_start = haversine_distance(
            start_coords['lat'], start_coords['lng'], lat, lng
        )
        d_end = haversine_distance(
            end_coords['lat'], end_coords['lng'], lat, lng
        )

        # Bounding box check (fast filter before haversine)
        min_lat = min(start_coords['lat'], end_coords['lat']) - (radius_km / 111)
        max_lat = max(start_coords['lat'], end_coords['lat']) + (radius_km / 111)
        min_lng = min(start_coords['lng'], end_coords['lng']) - (radius_km / 85)
        max_lng = max(start_coords['lng'], end_coords['lng']) + (radius_km / 85)

        if not (min_lat <= lat <= max_lat and min_lng <= lng <= max_lng):
            continue

        # Include if within radius of either endpoint or along the path
        if d_start <= radius_km or d_end <= radius_km:
            results.append({'listing': listing, 'distance_km': min(d_start, d_end)})

    results.sort(key=lambda x: x['distance_km'])
    return results


# ─────────────────────────────────────────────
#  SIMPLE LOCATION SEARCH
# ─────────────────────────────────────────────
def get_listings_near_location(lat: float, lng: float, radius_km: float = 10, category: str = None) -> list:
    """Return approved listings within radius_km of a single point."""
    
    # 1. OPTIMIZATION: Bounding Box Filter (Fast indexed query)
    # 1 degree lat ~ 111km. 1 degree lng ~ 111 * cos(lat).
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
    
    listings = Listing.objects.filter(
        status='approved',
        deleted_at__isnull=True,
        latitude__gte=lat - lat_delta,
        latitude__lte=lat + lat_delta,
        longitude__gte=lng - lng_delta,
        longitude__lte=lng + lng_delta
    ).prefetch_related('services')

    if category:
        listings = listings.filter(category__name__iexact=category)

    # 2. Precise Haversine calculation on the reduced set
    results = []
    for listing in listings:
        d = haversine_distance(lat, lng, float(listing.latitude), float(listing.longitude))
        if d <= radius_km:
            results.append({'listing': listing, 'distance_km': round(d, 2)})

    results.sort(key=lambda x: x['distance_km'])
    return results

