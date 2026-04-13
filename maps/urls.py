"""
maps/urls.py
"""
from django.urls import path
from . import views

app_name = 'maps'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('api/maps/search/', views.search_by_location, name='search_by_location'),
    path('api/maps/route/', views.route_search, name='route_search'),
    path('listing/<slug:slug>/', views.listing_detail_view, name='listing_detail'),
    path('listing/<slug:slug>/review/', views.add_review_view, name='add_review'),
    path('review/edit/<uuid:review_id>/', views.edit_review_view, name='edit_review'),
    path('review/delete/<uuid:review_id>/', views.delete_review_view, name='delete_review'),
]
