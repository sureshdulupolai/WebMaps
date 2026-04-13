"""
hosts/views.py — Host dashboard, listing management, service editing.
"""
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods, require_POST

from auth_app.decorators import jwt_login_required, role_required
from utils.helpers import sanitize_input
from .models import Listing, ServiceItem
from .services import create_listing, update_listing
from .validators import (
    validate_listing_url, validate_coordinates,
    validate_short_description, validate_company_name
)

logger = logging.getLogger('webmaps')


# ─────────────────────────────────────────────
#  HOST DASHBOARD
# ─────────────────────────────────────────────
@jwt_login_required
@role_required('host')
def dashboard_view(request):
    listings = Listing.objects.filter(
        host=request.user, deleted_at__isnull=True
    ).prefetch_related('services')

    # Aggregate stats per listing
    from analytics.services import aggregate_listing_stats
    from payments.models import Subscription

    listing_data = []
    for listing in listings:
        stats = aggregate_listing_stats(listing.id)
        try:
            sub = Subscription.objects.get(listing=listing)
            remaining_days = max(0, (sub.expires_at.date() - __import__('datetime').date.today()).days)
            sub_status = 'active' if sub.is_active else 'expired'
        except Exception:
            sub = None
            remaining_days = 0
            sub_status = 'no_subscription'

        listing_data.append({
            'listing': listing,
            'stats': stats,
            'subscription': sub,
            'remaining_days': remaining_days,
            'sub_status': sub_status,
        })

    # Notifications
    from notifications.models import Notification
    notifications = Notification.objects.filter(
        user=request.user, is_read=False
    ).order_by('-created_at')[:10]

    return render(request, 'hosts/dashboard.html', {
        'listing_data': listing_data,
        'notifications': notifications,
    })


# ─────────────────────────────────────────────
#  CREATE LISTING
# ─────────────────────────────────────────────
@jwt_login_required
@role_required('host')
@require_http_methods(['GET', 'POST'])
def listing_create_view(request):
    if request.method == 'GET':
        return render(request, 'hosts/listing_form.html', {'action': 'create'})

    errors = {}
    data = {
        'website_url': sanitize_input(request.POST.get('website_url', '').strip()),
        'company_name': sanitize_input(request.POST.get('company_name', '').strip()),
        'short_description': sanitize_input(request.POST.get('short_description', '').strip()),
        'latitude': request.POST.get('latitude', '').strip(),
        'longitude': request.POST.get('longitude', '').strip(),
        'location_name': sanitize_input(request.POST.get('location_name', '').strip()),
    }

    # Validate
    try:
        validate_listing_url(data['website_url'])
    except Exception as e:
        errors['website_url'] = str(e)

    try:
        validate_company_name(data['company_name'])
    except Exception as e:
        errors['company_name'] = str(e)

    try:
        validate_short_description(data['short_description'])
    except Exception as e:
        errors['short_description'] = str(e)

    try:
        validate_coordinates(data['latitude'], data['longitude'])
    except Exception as e:
        errors['coordinates'] = str(e)

    if not data['latitude'] or not data['longitude']:
        errors['coordinates'] = 'Coordinates are required. Please select a location on the map.'

    if errors:
        return render(request, 'hosts/listing_form.html', {
            'errors': errors, 'form_data': data, 'action': 'create'
        })

    file_obj = request.FILES.get('service_file')
    listing, service_errors = create_listing(request.user, data, file_obj)

    if service_errors:
        errors.update(service_errors)
        return render(request, 'hosts/listing_form.html', {
            'errors': errors, 'form_data': data, 'action': 'create'
        })

    return redirect('hosts:dashboard')


# ─────────────────────────────────────────────
#  EDIT LISTING
# ─────────────────────────────────────────────
@jwt_login_required
@role_required('host')
@require_http_methods(['GET', 'POST'])
def listing_edit_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user, deleted_at__isnull=True)

    if not listing.can_update:
        return render(request, 'hosts/listing_form.html', {
            'listing': listing,
            'error': 'You have reached the maximum number of updates (2) for this listing.',
            'action': 'edit',
        })

    if request.method == 'GET':
        return render(request, 'hosts/listing_form.html', {
            'listing': listing, 'action': 'edit'
        })

    data = {
        'website_url': sanitize_input(request.POST.get('website_url', '').strip()),
        'company_name': sanitize_input(request.POST.get('company_name', '').strip()),
        'short_description': sanitize_input(request.POST.get('short_description', '').strip()),
        'latitude': request.POST.get('latitude', str(listing.latitude)).strip(),
        'longitude': request.POST.get('longitude', str(listing.longitude)).strip(),
        'location_name': sanitize_input(request.POST.get('location_name', '').strip()),
    }

    file_obj = request.FILES.get('service_file')
    success, error = update_listing(listing, data, file_obj)

    if not success:
        return render(request, 'hosts/listing_form.html', {
            'listing': listing, 'error': error, 'action': 'edit'
        })

    return redirect('hosts:dashboard')


# ─────────────────────────────────────────────
#  SERVICE MANAGEMENT (AJAX)
# ─────────────────────────────────────────────
@jwt_login_required
@role_required('host')
def service_list_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    services = listing.services.all()
    return render(request, 'hosts/service_edit.html', {
        'listing': listing, 'services': services
    })


@jwt_login_required
@role_required('host')
@require_POST
def service_add_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    category = sanitize_input(request.POST.get('category', '').strip())
    price = sanitize_input(request.POST.get('price', '').strip())

    if not category or not price:
        return JsonResponse({'error': 'Category and price are required.'}, status=400)

    service = ServiceItem.objects.create(listing=listing, category=category, price=price)
    return JsonResponse({'id': str(service.id), 'category': service.category, 'price': service.price})


@jwt_login_required
@role_required('host')
@require_POST
def service_delete_view(request, slug, service_id):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    ServiceItem.objects.filter(id=service_id, listing=listing).delete()
    return JsonResponse({'status': 'deleted'})


@jwt_login_required
@role_required('host')
@require_POST
def service_update_view(request, slug, service_id):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    service = get_object_or_404(ServiceItem, id=service_id, listing=listing)
    category = sanitize_input(request.POST.get('category', '').strip())
    price = sanitize_input(request.POST.get('price', '').strip())
    if category:
        service.category = category[0].upper() + category[1:]
    if price:
        service.price = price[0].upper() + price[1:]
    service.save()
    return JsonResponse({'id': str(service.id), 'category': service.category, 'price': service.price})


@jwt_login_required
@role_required('host')
@require_POST
def listing_delete_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user, deleted_at__isnull=True)
    listing.deleted_at = timezone.now()
    listing.save()
    messages.info(request, 'Listing has been deleted.')
    return redirect('hosts:dashboard')

