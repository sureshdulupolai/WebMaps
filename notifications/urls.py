"""
notifications/urls.py
"""
from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    path('', views.notification_page_view, name='page'),
    path('list/', views.notification_list_view, name='list'),
    path('mark-read/', views.mark_read_view, name='mark_read'),
    path('mark-read/<uuid:notification_id>/', views.mark_read_single_view, name='mark_read_single'),
    path('delete/<uuid:notification_id>/', views.notification_delete_view, name='delete'),
]
