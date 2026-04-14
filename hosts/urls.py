"""
hosts/urls.py
"""
from django.urls import path
from . import views

app_name = 'hosts'

urlpatterns = [
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('listing/create/', views.listing_create_view, name='listing_create'),
    path('listing/<slug:slug>/edit/', views.listing_edit_view, name='listing_edit'),
    path('listing/<slug:slug>/delete/', views.listing_delete_view, name='listing_delete'),
    path('listing/<slug:slug>/insights/', views.listing_insights_view, name='listing_insights'),
    path('listing/<slug:slug>/services/', views.service_list_view, name='service_list'),
    path('listing/<slug:slug>/services/add/', views.service_add_view, name='service_add'),
    path('listing/<slug:slug>/services/<uuid:service_id>/update/', views.service_update_view, name='service_update'),
    path('listing/<slug:slug>/services/<uuid:service_id>/delete/', views.service_delete_view, name='service_delete'),
]
