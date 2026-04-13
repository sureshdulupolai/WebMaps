"""
users/views.py — User profile views (auth views are in auth_app).
"""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.utils import timezone
from auth_app.decorators import jwt_login_required
from hosts.models import Review

@jwt_login_required
def profile_view(request):
    return render(request, 'users/profile.html', {
        'user': request.user,
        'recent_reviews': request.user.reviews.all()[:3]
    })


@jwt_login_required
def edit_profile_view(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        phone = request.POST.get('phone', '').strip()

        request.user.first_name = first_name
        request.user.last_name = last_name
        request.user.phone = phone
        request.user.save()

        messages.success(request, 'Profile updated successfully.')
        return redirect('users:profile')
    return redirect('users:profile')


@jwt_login_required
@require_POST
def delete_account_view(request):
    user = request.user
    user.deleted_at = timezone.now()  # Use soft delete
    user.save()
    messages.info(request, 'Your account has been deleted.')
    # Logout is handled automatically via redirect or we can clear cookies here
    response = redirect('maps:home')
    response.delete_cookie('access_token')
    response.delete_cookie('refresh_token')
    return response


@jwt_login_required
def my_reviews_view(request):
    reviews = request.user.reviews.select_related('listing').all()
    return render(request, 'users/my_reviews.html', {'reviews': reviews})

