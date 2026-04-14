"""
payments/views.py — Payment flow: plan selection, Razorpay checkout, verification.
"""
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.http import require_POST, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from auth_app.decorators import jwt_login_required, role_required
from hosts.models import Listing
from .models import SubscriptionPlan
from .services import (
    get_all_plans, create_razorpay_order,
    verify_razorpay_payment, activate_subscription
)

logger = logging.getLogger('webmaps')


@jwt_login_required
@role_required('host')
def plans_view(request, slug):
    """Show available subscription plans for a listing."""
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    plans = get_all_plans()
    return render(request, 'payments/plans.html', {
        'listing': listing,
        'plans': plans,
        'razorpay_key': settings.RAZORPAY_KEY_ID,
    })


@jwt_login_required
@role_required('host')
@require_POST
def initiate_payment_view(request, slug):
    """Create Razorpay order and return order_id to frontend."""
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    plan_id = request.POST.get('plan_id')

    try:
        plan = SubscriptionPlan.objects.get(id=plan_id)
    except SubscriptionPlan.DoesNotExist:
        return JsonResponse({'error': 'Invalid plan.'}, status=400)

    try:
        order = create_razorpay_order(plan.total_cost, listing.id)
        return JsonResponse({
            'order_id': order['id'],
            'amount': plan.total_cost_paise,
            'currency': 'INR',
            'plan_name': plan.name,
            'listing_name': listing.company_name,
        })
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        return JsonResponse({'error': 'Payment service unavailable. Try again later.'}, status=500)


@csrf_exempt
@require_POST
def verify_payment_view(request):
    """
    Verify Razorpay payment signature and activate subscription.
    Called by Razorpay checkout callback.
    """
    import json
    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid request.'}, status=400)

    order_id = body.get('razorpay_order_id', '')
    payment_id = body.get('razorpay_payment_id', '')
    signature = body.get('razorpay_signature', '')
    slug = body.get('listing_slug', '')
    plan_id = body.get('plan_id', '')

    if not verify_razorpay_payment(order_id, payment_id, signature):
        logger.warning(f"Invalid Razorpay signature for order {order_id}")
        return JsonResponse({'error': 'Payment verification failed.'}, status=400)

    try:
        listing = Listing.objects.get(slug=slug)
        plan = SubscriptionPlan.objects.get(id=plan_id)
        activate_subscription(listing, plan, {
            'order_id': order_id,
            'payment_id': payment_id,
            'signature': signature,
        })

        # 📄 LOG TRANSACTION
        from .models import PaymentLog
        PaymentLog.objects.create(
            user=listing.host,
            listing=listing,
            plan=plan,
            amount=plan.total_cost,
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            status='success'
        )

        return JsonResponse({'status': 'success', 'redirect': f'/hosts/dashboard/'})
    except Exception as e:
        logger.error(f"Subscription activation error: {e}")
        return JsonResponse({'error': 'Could not activate subscription.'}, status=500)


@jwt_login_required
def payment_success_view(request):
    return render(request, 'payments/success.html')


@jwt_login_required
def payment_failure_view(request):
    return render(request, 'payments/failure.html')
