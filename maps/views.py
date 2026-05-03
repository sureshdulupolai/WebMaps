"""
maps/views.py — Public map views: home, search, listing detail.
"""
import json
import logging
import requests
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.conf import settings

from hosts.models import Listing, Review
from .services import (
    parse_route_query, geocode_location,
    get_listings_along_route, get_listings_near_location
)

logger = logging.getLogger('webmaps')


def home_view(request):
    """Main map page — search by location or route."""
    return render(request, 'maps/home.html')


def serialize_listings(results, rating_filter):
    listings_data = []
    for r in results:
        listing = r['listing']
        if rating_filter > 0 and listing.average_rating < rating_filter:
            continue
        listings_data.append({
            'slug': listing.slug,
            'company_name': listing.company_name,
            'short_description': listing.short_description,
            'website_url': listing.website_url,
            'lat': float(listing.latitude),
            'lng': float(listing.longitude),
            'location_name': listing.location_name,
            'distance_km': r['distance_km'],
            'detail_url': listing.get_absolute_url(),
        })
    return listings_data

def search_by_location(request):
    """AJAX endpoint for single location search."""
    query = request.GET.get('q', '').strip()
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    category = request.GET.get('category', '').strip()

    if lat and lng:
        coords = {'lat': float(lat), 'lng': float(lng), 'formatted_address': query}
    elif query:
        coords = geocode_location(query)
    else:
        return JsonResponse({'listings': [], 'start': None})

    if not coords:
        return JsonResponse({
            'listings': [],
            'error': 'Could not locate that place.',
            'start': None
        })

    distance_filter = float(request.GET.get('distance') or 20)
    rating_filter = float(request.GET.get('rating') or 0)
    
    # If category is "All" or empty, don't filter by category in service layer if possible
    # For now, we'll filter in serialize_listings if needed or pass it to service
    results = get_listings_near_location(
        coords['lat'], coords['lng'], 
        radius_km=distance_filter,
        category=category if category != 'All' else None
    )
    # Filter by is_active_on_map
    results = [r for r in results if r['listing'].is_active_on_map]
    listings_data = serialize_listings(results, rating_filter)

    return JsonResponse({
        'listings': listings_data,
        'start': coords,
        'count': len(listings_data)
    })

def route_search(request):
    """AJAX endpoint for route-based search X to Y."""
    start_place = request.GET.get('from', '').strip()
    end_place = request.GET.get('to', '').strip()
    
    if not start_place or not end_place:
        return JsonResponse({'listings': [], 'error': 'Both from and to locations are required.'})

    start_coords = geocode_location(start_place)
    end_coords = geocode_location(end_place)

    if not start_coords or not end_coords:
        return JsonResponse({
            'listings': [],
            'error': 'Could not locate one or both places.'
        })

    # Optional: We could fetch OSRM route data here on the backend, 
    # but the frontend will also fetch it via JS to draw the polyline.
    # We will just return the start/end and the listings near the route.

    distance_filter = float(request.GET.get('distance') or 5)
    rating_filter = float(request.GET.get('rating') or 0)
    
    results = get_listings_along_route(start_coords, end_coords, radius_km=distance_filter)
    listings_data = serialize_listings(results, rating_filter)

    return JsonResponse({
        'listings': listings_data,
        'start': start_coords,
        'end': end_coords,
        'count': len(listings_data)
    })


def all_listings_api(request):
    """AJAX endpoint to return all approved listings."""
    listings = Listing.objects.filter(status='approved', deleted_at__isnull=True, is_active_on_map=True)
    listings_data = []
    for l in listings:
        listings_data.append({
            'slug': l.slug,
            'company_name': l.company_name,
            'short_description': l.short_description,
            'lat': float(l.latitude),
            'lng': float(l.longitude),
            'detail_url': l.get_absolute_url(),
            'distance_km': 0, # Not applicable for global view
        })
    return JsonResponse({'listings': listings_data})


def listing_detail_view(request, slug):
    """
    Listing detail page with embedded map and services table.
    """
    listing = get_object_or_404(
        Listing,
        slug=slug,
        status='approved',
        deleted_at__isnull=True
    )
    services = listing.services.all()
    reviews = listing.reviews.select_related('user').all()
    
    user_review = None
    if request.user.is_authenticated:
        user_review = reviews.filter(user=request.user).first()

    return render(request, 'maps/listing_detail.html', {
        'listing': listing,
        'services': services,
        'reviews': reviews,
        'user_review': user_review,
    })


@login_required
def add_review_view(request, slug):
    if request.method == 'POST':
        listing = get_object_or_404(Listing, slug=slug, status='approved', deleted_at__isnull=True)
        rating = int(request.POST.get('rating', 0))
        comment = request.POST.get('comment', '').strip()

        if not (1 <= rating <= 5):
            messages.error(request, 'Rating must be between 1 and 5.')
            return redirect(listing.get_absolute_url())

        if not comment:
            messages.error(request, 'Comment cannot be empty.')
            return redirect(listing.get_absolute_url())

        if Review.objects.filter(user=request.user, listing=listing).exists():
            messages.error(request, 'You have already reviewed this listing.')
            return redirect(listing.get_absolute_url())

        Review.objects.create(user=request.user, listing=listing, rating=rating, comment=comment)
        messages.success(request, 'Review added successfully.')
        return redirect(listing.get_absolute_url())
    return redirect('maps:home')


@login_required
def edit_review_view(request, review_id):
    review = get_object_or_404(Review, id=review_id, user=request.user)
    if request.method == 'POST':
        rating = int(request.POST.get('rating', review.rating))
        comment = request.POST.get('comment', '').strip()

        if 1 <= rating <= 5:
            review.rating = rating
        if comment:
            review.comment = comment

        review.save()
        messages.success(request, 'Review updated successfully.')
        return redirect(review.listing.get_absolute_url())
    return redirect('maps:home')


@login_required
def delete_review_view(request, review_id):
    review = get_object_or_404(Review, id=review_id, user=request.user)
    if request.method == 'POST':
        listing_url = review.listing.get_absolute_url()
        review.delete()
        messages.success(request, 'Review deleted successfully.')
        return redirect(listing_url)
    return redirect('maps:home')

