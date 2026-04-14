"""
adminpanel/urls.py
"""
from django.urls import path
from . import views

app_name = 'adminpanel'

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
    path('users/', views.user_list_view, name='users'),
    path('listings/', views.listing_list_view, name='listings'),
    path('listings/<slug:slug>/', views.listing_detail_view, name='listing_detail'),
    path('listings/<slug:slug>/approve/', views.approve_listing_view, name='approve_listing'),
    path('listings/<slug:slug>/reject/', views.reject_listing_view, name='reject_listing'),
    path('analytics/', views.analytics_view, name='analytics'),
    path('errors/', views.error_log_view, name='errors'),
    path('errors/clear-all/', views.error_clear_all_view, name='error_clear_all'),
    path('errors/<uuid:error_id>/delete/', views.error_delete_view, name='error_delete'),
    path('users/<uuid:user_id>/delete/', views.user_delete_view, name='user_delete'),
    path('listings/<slug:slug>/delete/', views.listing_delete_view, name='listing_delete'),
    path('reviews/<uuid:review_id>/delete/', views.review_delete_view, name='review_delete'),
]
