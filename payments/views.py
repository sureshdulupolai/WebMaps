"""
payments/views.py — Payment flow: plan selection, Razorpay checkout, verification.
"""
import logging
from decimal import Decimal
import json
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
from coupon.models import Coupon, CouponUsage

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
def checkout_page_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    
    plan_id = request.GET.get('plan_id')
    payment_type = request.GET.get('payment_type', '')
    coupon_code = request.GET.get('coupon_code', '')
    
    plan = None
    if plan_id:
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            pass

    # 1. Base amount
    base_amount = Decimal('0')
    if payment_type != 'update' and plan:
        base_amount = Decimal(str(plan.total_cost))
    
    # 2. Update surcharge
    update_surcharge = Decimal('0')
    if listing.update_count >= 2:
        update_surcharge = Decimal('22.88')
    
    taxable_amount = base_amount + update_surcharge
    gst_amount = taxable_amount * Decimal('0.18')
    platform_fee_extra = Decimal('2')
    
    if base_amount == 0 and update_surcharge > 0:
        final_total_inr = Decimal('29.00')
    else:
        final_total_inr = (taxable_amount + gst_amount + platform_fee_extra).quantize(Decimal('0.01'))

    discount_amount = Decimal('0')
    if coupon_code:
        try:
            coupon = Coupon.objects.get(code=coupon_code.strip().upper())
            is_valid, _ = coupon.is_valid(user=request.user, amount=final_total_inr)
            if is_valid:
                if coupon.discount_type == 'percentage':
                    discount_amount = (final_total_inr * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                else:
                    discount_amount = coupon.discount_value
                final_total_inr = max(Decimal('0'), final_total_inr - discount_amount)
        except Coupon.DoesNotExist:
            pass

    usd_amount = (final_total_inr / Decimal('83.0')).quantize(Decimal('0.01'))

    return render(request, 'payments/checkout.html', {
        'listing': listing,
        'final_total_inr': final_total_inr,
        'usd_amount': usd_amount,
        'plan_id': plan_id,
        'payment_type': payment_type,
        'coupon_code': coupon_code,
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
        plan = None
        if plan_id:
            try:
                plan = SubscriptionPlan.objects.get(id=plan_id)
            except SubscriptionPlan.DoesNotExist:
                return JsonResponse({'error': 'Invalid plan.'}, status=400)
        
        payment_type = request.POST.get('payment_type', '')
        if payment_type != 'update' and not plan:
            return JsonResponse({'error': 'Plan ID is required.'}, status=400)

        # 1. Base amount from plan
        base_amount = Decimal('0')
        if payment_type != 'update' and plan:
            base_amount = Decimal(str(plan.total_cost))
        
        # 2. Check for update surcharge (matching listing_form.js logic)
        update_surcharge = Decimal('0')
        if listing.update_count >= 2:
            update_surcharge = Decimal('22.88') # This results in ~29 total
        
        # 3. Calculate Taxes (18% total GST)
        taxable_amount = base_amount + update_surcharge
        gst_amount = taxable_amount * Decimal('0.18')
        
        # 4. Platform Fee (Matching frontend's extra +2)
        platform_fee_extra = Decimal('2')
        
        # 5. Final Total in INR
        if base_amount == 0 and update_surcharge > 0:
            # If ONLY paying for update, make it exactly 29
            final_total_inr = Decimal('29.00')
        else:
            final_total_inr = (taxable_amount + gst_amount + platform_fee_extra).quantize(Decimal('0.01'))

        # 6. Apply Coupon
        coupon_code = request.POST.get('coupon_code', '').strip().upper()
        discount_amount = Decimal('0')
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code)
                is_valid, msg = coupon.is_valid(user=request.user, amount=final_total_inr)
                if is_valid:
                    if coupon.discount_type == 'percentage':
                        discount_amount = (final_total_inr * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                    else:
                        discount_amount = coupon.discount_value
                    
                    final_total_inr = max(Decimal('0'), final_total_inr - discount_amount)
            except Coupon.DoesNotExist:
                pass

        final_amount_paise = int(final_total_inr * 100)

        # 7. Zero Amount Flow
        if final_total_inr <= 0:
            return JsonResponse({
                'order_id': 'FREE_' + listing.slug,
                'amount': 0,
                'is_free': True,
                'currency': 'INR',
                'plan_name': plan.name if plan else 'Listing Update',
                'listing_name': listing.company_name,
            })

        logger.info(f"Payment Initiation: Listing={listing.slug}, Plan={plan.name if plan else 'Update'}, Total={final_total_inr}")

        order = create_razorpay_order(float(final_total_inr), listing.id)
        return JsonResponse({
            'order_id': order['id'],
            'amount': final_amount_paise,
            'currency': 'INR',
            'plan_name': plan.name if plan else 'Listing Update',
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
    coupon_code = body.get('coupon_code', '').strip().upper()
    payment_type = body.get('payment_type', '')

    # 1. Handle Free Checkout (Zero Amount)
    is_free = str(order_id).startswith('FREE_')
    if not is_free and not verify_razorpay_payment(order_id, payment_id, signature):
        logger.warning(f"Invalid Razorpay signature for order {order_id}")
        return JsonResponse({'error': 'Payment verification failed.'}, status=400)

    try:
        listing = Listing.objects.get(slug=slug)
        plan = None
        if plan_id:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        
        # Determine if it's an update-only payment
        is_update_only = (payment_type == 'update')

        activate_subscription(listing, plan, {
            'order_id': order_id,
            'payment_id': payment_id,
            'signature': signature,
        }, is_update_only=is_update_only)

        # 📄 LOG TRANSACTION
        from .models import PaymentLog
        PaymentLog.objects.create(
            user=listing.host,
            listing=listing,
            plan=plan,
            amount=Decimal('29.00') if is_update_only else (plan.total_cost if plan else Decimal('29.00')),
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id or 'FREE',
            status='success'
        )

        # 📄 LOG COUPON USAGE
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code=coupon_code)
                # (Re-calculate subtotal for log - MUST match initiate_payment_view)
                base_amt = Decimal(str(plan.total_cost)) if plan and not is_update_only else Decimal('0')
                surcharge = Decimal('22.88') if listing.update_count >= 2 else Decimal('0')
                
                # Use same logic as initiate_payment_view
                taxable = base_amt + surcharge
                gst = taxable * Decimal('0.18')
                platform = Decimal('2')
                
                if base_amt == Decimal('0') and surcharge > 0:
                    subtotal = Decimal('29.00')
                else:
                    subtotal = (taxable + gst + platform).quantize(Decimal('0.01'))
                
                if coupon.discount_type == 'percentage':
                    discount_val = (subtotal * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                else:
                    discount_val = coupon.discount_value
                
                CouponUsage.objects.create(
                    coupon=coupon,
                    user=listing.host,
                    listing_slug=listing.slug,
                    discount_applied=discount_val,
                    final_amount=max(Decimal('0'), subtotal - discount_val)
                )
                coupon.usage_count += 1
                coupon.save()
            except Coupon.DoesNotExist:
                pass

        return JsonResponse({'status': 'success', 'redirect': f'/hosts/dashboard/'})
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Subscription activation error: {e}\n{error_trace}")
        return JsonResponse({'error': f'Activation failed: {str(e)}'}, status=500)


@jwt_login_required
def payment_success_view(request):
    return render(request, 'payments/success.html')


@jwt_login_required
def payment_failure_view(request):
    return render(request, 'payments/failure.html')


@jwt_login_required
@role_required('host')
def checkout_page_view(request, slug):
    listing = get_object_or_404(Listing, slug=slug, host=request.user)
    
    plan_id = request.GET.get('plan_id', '')
    payment_type = request.GET.get('payment_type', '')
    coupon_code = request.GET.get('coupon_code', '')
    
    plan = None
    if plan_id and plan_id != 'null':
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            pass

    # Base amount
    base_amount = Decimal('0')
    if payment_type != 'update' and plan:
        base_amount = Decimal(str(plan.total_cost))
    
    # Update surcharge
    update_surcharge = Decimal('0')
    if listing.update_count >= 2:
        update_surcharge = Decimal('22.88')
    
    taxable_amount = base_amount + update_surcharge
    gst_amount = taxable_amount * Decimal('0.18')
    platform_fee_extra = Decimal('2')
    
    if base_amount == 0 and update_surcharge > 0:
        final_total_inr = Decimal('29.00')
    else:
        final_total_inr = (taxable_amount + gst_amount + platform_fee_extra).quantize(Decimal('0.01'))

    discount_amount = Decimal('0')
    if coupon_code and coupon_code != 'null':
        try:
            from payments.models import Coupon
            coupon = Coupon.objects.get(code=coupon_code.strip().upper())
            is_valid, _ = coupon.is_valid(user=request.user, amount=final_total_inr)
            if is_valid:
                if coupon.discount_type == 'percentage':
                    discount_amount = (final_total_inr * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                else:
                    discount_amount = coupon.discount_value
                final_total_inr = max(Decimal('0'), final_total_inr - discount_amount)
        except Exception:
            pass

    usd_amount = (final_total_inr / Decimal('83.0')).quantize(Decimal('0.01'))

    return render(request, 'payments/checkout.html', {
        'listing': listing,
        'final_total_inr': final_total_inr,
        'usd_amount': usd_amount,
        'plan_id': plan_id,
        'payment_type': payment_type,
        'coupon_code': coupon_code,
        'razorpay_key': settings.RAZORPAY_KEY_ID,
        'paypal_client_id': settings.PAYPAL_CLIENT_ID,
    })


@csrf_exempt
@require_POST
@jwt_login_required
@role_required('host')
def paypal_verify_view(request):
    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid request.'}, status=400)

    order_id = body.get('orderID', '')
    trans_id = body.get('transID', '')
    status = body.get('status', '')
    
    slug = body.get('listing_slug', '')
    plan_id = body.get('plan_id', '')
    coupon_code = body.get('coupon_code', '').strip().upper()
    payment_type = body.get('payment_type', '')

    if status != 'COMPLETED':
        return JsonResponse({'error': 'PayPal payment not completed.'}, status=400)

    try:
        listing = Listing.objects.get(slug=slug, host=request.user)
        plan = None
        if plan_id and plan_id != 'null':
            plan = SubscriptionPlan.objects.get(id=plan_id)
        
        is_update_only = (payment_type == 'update')

        activate_subscription(listing, plan, {
            'order_id': order_id,
            'payment_id': trans_id,
            'signature': 'paypal',
        }, is_update_only=is_update_only)

        from .models import PaymentLog
        PaymentLog.objects.create(
            user=listing.host,
            listing=listing,
            plan=plan,
            amount=Decimal('29.00') if is_update_only else (plan.total_cost if plan else Decimal('29.00')),
            razorpay_order_id=order_id,
            razorpay_payment_id=trans_id,
            status='success'
        )

        if coupon_code and coupon_code != 'null':
            try:
                from payments.models import Coupon
                coupon = Coupon.objects.get(code=coupon_code)
                coupon.increment_usage(request.user)
            except Exception:
                pass

        return JsonResponse({'status': 'success', 'redirect': f'/hosts/dashboard/'})
    except Listing.DoesNotExist:
        return JsonResponse({'error': 'Listing not found.'}, status=404)
    except Exception as e:
        logger.error(f"PayPal activation failed: {e}")
        return JsonResponse({'error': 'Error activating subscription.'}, status=500)
