from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import Coupon, CouponAttempt, Notification
from decimal import Decimal
from datetime import timedelta

@login_required
@require_POST
def validate_coupon(request):
    import json
    
    # Handle both JSON and Form data
    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
            code = data.get('code', '').strip().upper()
            amount_str = data.get('amount', '0')
            amount = Decimal(str(amount_str))
        except (json.JSONDecodeError, ValueError, TypeError):
            return JsonResponse({'valid': False, 'message': 'Invalid request data.'}, status=400)
    else:
        code = request.POST.get('code', '').strip().upper()
        amount = Decimal(request.POST.get('amount', '0'))

    user = request.user

    # 1. Check for block
    attempt, created = CouponAttempt.objects.get_or_create(user=user)
    if attempt.is_blocked():
        remaining = attempt.blocked_until - timezone.now()
        hours = int(remaining.total_seconds() // 3600)
        minutes = int((remaining.total_seconds() % 3600) // 60)
        return JsonResponse({
            'valid': False, 
            'message': f'Too many failed attempts. You are blocked for {hours}h {minutes}m.'
        }, status=403)

    # 2. Find coupon
    try:
        coupon = Coupon.objects.get(code=code)
    except Coupon.DoesNotExist:
        # Increment failed attempts
        attempt.failed_attempts += 1
        if attempt.failed_attempts >= 3:
            attempt.blocked_until = timezone.now() + timedelta(hours=7)
            attempt.failed_attempts = 0 # Reset count for next cycle
            attempt.save()
            return JsonResponse({
                'valid': False, 
                'message': 'Too many failed attempts. Blocked for 7 hours.'
            }, status=403)
        attempt.save()
        return JsonResponse({
            'valid': False, 
            'message': f'Invalid coupon code. ({3 - attempt.failed_attempts} attempts left)'
        }, status=400)

    # 3. Validate logic
    is_valid, msg = coupon.is_valid(user=user, amount=amount)
    if not is_valid:
        return JsonResponse({'valid': False, 'message': msg}, status=400)

    # Calculate discount
    discount = Decimal('0.00')
    if coupon.discount_type == 'percentage':
        discount = (amount * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
    else:
        discount = coupon.discount_value

    final_amount = max(Decimal('0.00'), amount - discount)

    # Success! Reset failed attempts
    attempt.failed_attempts = 0
    attempt.save()

    return JsonResponse({
        'valid': True,
        'discount_amount': str(discount),
        'discount_type': coupon.discount_type,
        'discount_value': str(coupon.discount_value),
        'final_amount': str(final_amount),
        'message': f'Coupon "{code}" applied successfully!'
    })

@login_required
def mark_notifications_read(request):
    # Deleting instead of marking as read to save DB space as requested
    Notification.objects.filter(user=request.user).delete()
    return JsonResponse({'success': True})

@login_required
def get_notifications(request):
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:10]
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
    data = [{
        'id': n.id,
        'title': n.title,
        'message': n.message,
        'coupon_code': n.coupon.code if n.coupon else None,
        'is_read': n.is_read,
        'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
    } for n in notifications]
    return JsonResponse({'notifications': data, 'unread_count': unread_count})
