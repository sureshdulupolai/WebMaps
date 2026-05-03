from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from auth_app.decorators import jwt_login_required
from .models import Notification
from .services import mark_all_read


@jwt_login_required
def notification_list_view(request):
    """API view for dropdown/navbar notifications."""
    now = timezone.now()
    # Auto-delete expired
    Notification.objects.filter(user=request.user, expires_at__lt=now).delete()
    
    notifications = Notification.objects.filter(
        user=request.user
    ).order_by('-created_at')[:10]
    
    unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
    
    data = [
        {
            'id': str(n.id),
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%b %d, %H:%M'),
        }
        for n in notifications
    ]
    return JsonResponse({
        'notifications': data,
        'unread_count': unread_count
    })

@jwt_login_required
def notification_page_view(request):
    """HTML page for all notifications with search."""
    now = timezone.now()
    # Auto-delete expired
    Notification.objects.filter(user=request.user, expires_at__lt=now).delete()
    
    query = request.GET.get('q', '').strip()
    notifications = Notification.objects.filter(user=request.user)
    
    if query:
        notifications = notifications.filter(message__icontains=query)
        
    notifications = notifications.order_by('-created_at')
    
    return render(request, 'notifications/list.html', {
        'notifications': notifications,
        'query': query
    })


@jwt_login_required
@require_POST
def mark_read_view(request):
    """Mark all as read."""
    mark_all_read(request.user)
    return JsonResponse({'status': 'ok'})

@jwt_login_required
@require_POST
def mark_read_single_view(request, notification_id):
    """Mark single notification as read."""
    notif = get_object_or_404(Notification, id=notification_id, user=request.user)
    notif.is_read = True
    notif.save()
    return JsonResponse({'status': 'ok'})

@jwt_login_required
@require_POST
def notification_delete_view(request, notification_id):
    """Delete single notification."""
    notif = get_object_or_404(Notification, id=notification_id, user=request.user)
    notif.delete()
    return JsonResponse({'status': 'ok'})
