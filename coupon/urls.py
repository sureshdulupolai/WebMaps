from django.urls import path
from . import views

app_name = 'coupon'

urlpatterns = [
    path('validate/', views.validate_coupon, name='validate'),
    path('notifications/', views.get_notifications, name='notifications'),
    path('notifications/read/', views.mark_notifications_read, name='mark_read'),
]
