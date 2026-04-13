"""
notifications/views.py
"""
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from auth_app.decorators import jwt_login_required
from .models import Notification
from .services import mark_all_read


@jwt_login_required
def notification_list_view(request):
    notifications = Notification.objects.filter(
        user=request.user
    ).order_by('-created_at')[:20]
    data = [
        {
            'id': str(n.id),
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at.isoformat(),
        }
        for n in notifications
    ]
    return JsonResponse({'notifications': data})


@jwt_login_required
@require_POST
def mark_read_view(request):
    mark_all_read(request.user)
    return JsonResponse({'status': 'ok'})
