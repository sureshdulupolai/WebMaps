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
    path('listings/<slug:slug>/update-signal/', views.listing_update_signal_view, name='listing_update_signal'),
    path('reviews/<uuid:review_id>/delete/', views.review_delete_view, name='review_delete'),

    # Promotions
    path('promotions/', views.coupon_list_view, name='coupons'),
    path('promotions/create/', views.coupon_create_view, name='coupon_create'),
    path('promotions/<int:coupon_id>/toggle/', views.coupon_toggle_view, name='coupon_toggle'),
    path('promotions/<int:coupon_id>/delete/', views.coupon_delete_view, name='coupon_delete'),
]
