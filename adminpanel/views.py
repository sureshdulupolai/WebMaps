"""
adminpanel/views.py — Custom developer admin dashboard (NOT Django's /admin/).
"""
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from auth_app.decorators import jwt_login_required, role_required
from django.utils import timezone
from users.models import User
from hosts.models import Listing, Review
from hosts.services import approve_listing, reject_listing
from errors.models import AppError
from analytics.models import AnalyticsEvent
from payments.models import Subscription

logger = logging.getLogger('webmaps')


@jwt_login_required
@role_required('admin')
def dashboard_view(request):
    """Main admin dashboard with overview stats."""
    stats = {
        'total_users': User.objects.filter(deleted_at__isnull=True).count(),
        'total_hosts': User.objects.filter(role='host').count(),
        'total_customers': User.objects.filter(role='customer').count(),
        'total_listings': Listing.objects.filter(deleted_at__isnull=True).count(),
        'pending_listings': Listing.objects.filter(status='pending').count(),
        'approved_listings': Listing.objects.filter(status='approved').count(),
        'rejected_listings': Listing.objects.filter(status='rejected').count(),
        'total_events': AnalyticsEvent.objects.count(),
        'total_errors': AppError.objects.count(),
        'active_subs': Subscription.objects.filter(is_active=True).count(),
    }
    recent_listings = Listing.objects.filter(
        status='pending'
    ).select_related('host').order_by('-created_at')[:10]

    recent_errors = AppError.objects.order_by('-last_seen_at')[:5]

    return render(request, 'adminpanel/dashboard.html', {
        'stats': stats,
        'recent_listings': recent_listings,
        'recent_errors': recent_errors,
    })


@jwt_login_required
@role_required('admin')
def user_list_view(request):
    users = User.objects.filter(deleted_at__isnull=True).order_by('-created_at')
    return render(request, 'adminpanel/users.html', {'users': users})


@jwt_login_required
@role_required('admin')
def listing_list_view(request):
    status_filter = request.GET.get('status', '')
    listings = Listing.objects.filter(deleted_at__isnull=True).select_related('host')
    if status_filter:
        listings = listings.filter(status=status_filter)
    listings = listings.order_by('-created_at')
    return render(request, 'adminpanel/listings.html', {
        'listings': listings,
        'status_filter': status_filter,
    })


@jwt_login_required
@role_required('admin')
def listing_detail_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug)
    services = listing.services.all()
    try:
        sub = listing.subscription
    except Exception:
        sub = None
    return render(request, 'adminpanel/listing_detail.html', {
        'listing': listing,
        'services': services,
        'subscription': sub,
    })


@jwt_login_required
@role_required('admin')
@require_POST
def approve_listing_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug)
    approve_listing(listing, request.user)
    return redirect('adminpanel:listings')


@jwt_login_required
@role_required('admin')
@require_POST
def reject_listing_view(request, slug):
    reason = request.POST.get('reason', 'Does not meet our guidelines.').strip()
    listing = get_object_or_404(Listing, slug=slug)
    reject_listing(listing, request.user, reason)
    return redirect('adminpanel:listings')


@jwt_login_required
@role_required('admin')
def analytics_view(request):
    from analytics.services import aggregate_listing_stats
    from hosts.models import Listing as L
    listings = L.objects.filter(status='approved', deleted_at__isnull=True)
    listing_stats = [
        {'listing': l, 'stats': aggregate_listing_stats(l.id)}
        for l in listings
    ]
    return render(request, 'adminpanel/analytics.html', {
        'listing_stats': listing_stats
    })


@jwt_login_required
@role_required('admin')
def error_log_view(request):
    errors = AppError.objects.order_by('-last_seen_at')
    return render(request, 'adminpanel/errors.html', {'errors': errors})


@jwt_login_required
@role_required('admin')
@require_POST
def user_delete_view(request, user_id):
    user = get_object_or_404(User, id=user_id)
    user.deleted_at = timezone.now()
    user.save()
    return redirect('adminpanel:users')


@jwt_login_required
@role_required('admin')
@require_POST
def listing_delete_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug)
    listing.deleted_at = timezone.now()
    listing.save()
    return redirect('adminpanel:listings')


@jwt_login_required
@role_required('admin')
@require_POST
def review_delete_view(request, review_id):
    review = get_object_or_404(Review, id=review_id)
    listing_slug = review.listing.slug
    review.delete()
    return redirect('adminpanel:listing_detail', slug=listing_slug)

