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
    Geocode a place name using OpenStreetMap Nominatim API.
    Returns {'lat': float, 'lng': float, 'formatted_address': str} or None
    """
    try:
        url = 'https://nominatim.openstreetmap.org/search'
        params = {'q': place_name, 'format': 'json', 'limit': 1}
        headers = {'User-Agent': 'WebMaps/1.0'}
        resp = requests.get(url, params=params, headers=headers, timeout=5)
        data = resp.json()

        if data and len(data) > 0:
            return {
                'lat': float(data[0]['lat']),
                'lng': float(data[0]['lon']),
                'formatted_address': data[0]['display_name'],
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
def distance_to_line_segment(lat, lng, start_lat, start_lng, end_lat, end_lng):
    """
    Calculate approx distance in km from point to line segment.
    """
    R = 6371.0
    lat1, lng1 = math.radians(start_lat), math.radians(start_lng)
    lat2, lng2 = math.radians(end_lat), math.radians(end_lng)
    lat3, lng3 = math.radians(lat), math.radians(lng)

    x1, y1 = 0.0, 0.0
    x2 = R * (lng2 - lng1) * math.cos((lat1 + lat2) / 2)
    y2 = R * (lat2 - lat1)
    x3 = R * (lng3 - lng1) * math.cos((lat1 + lat3) / 2)
    y3 = R * (lat3 - lat1)

    dx = x2 - x1
    dy = y2 - y1
    length_sq = dx*dx + dy*dy

    if length_sq == 0:
        return haversine_distance(lat, lng, start_lat, start_lng)

    t = max(0, min(1, (x3 * dx + y3 * dy) / length_sq))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy

    return math.sqrt((x3 - proj_x)**2 + (y3 - proj_y)**2)


def get_listings_along_route(start_coords: dict, end_coords: dict, radius_km: float = 5) -> list:
    """
    Return approved listings within `radius_km` of the straight-line route
    between start and end coordinates.
    """
    listings = Listing.objects.filter(
        status='approved',
        deleted_at__isnull=True,
    ).prefetch_related('services', 'subscription')

    results = []
    start_lat = float(start_coords['lat'])
    start_lng = float(start_coords['lng'])
    end_lat = float(end_coords['lat'])
    end_lng = float(end_coords['lng'])

    min_lat = min(start_lat, end_lat) - (radius_km / 111.0)
    max_lat = max(start_lat, end_lat) + (radius_km / 111.0)
    min_lng = min(start_lng, end_lng) - (radius_km / 85.0)
    max_lng = max(start_lng, end_lng) + (radius_km / 85.0)

    for listing in listings:
        lat = float(listing.latitude)
        lng = float(listing.longitude)

        # Bounding box check (fast filter before distance calc)
        if not (min_lat <= lat <= max_lat and min_lng <= lng <= max_lng):
            continue

        d_segment = distance_to_line_segment(lat, lng, start_lat, start_lng, end_lat, end_lng)

        # Include if within radius of the path segment
        if d_segment <= radius_km:
            results.append({'listing': listing, 'distance_km': round(d_segment, 2)})

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

