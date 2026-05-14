"""
maps/urls.py
"""
from django.urls import path
from . import views

app_name = 'maps'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('search/', views.search_view, name='search'),
    path('api/maps/search/', views.search_by_location, name='search_by_location'),
    path('api/maps/route/', views.route_search, name='route_search'),
    path('api/maps/all/', views.all_listings_api, name='all_listings'),
    path('listing/<slug:slug>/', views.listing_detail_view, name='listing_detail'),
    path('listing/<slug:slug>/review/', views.add_review_view, name='add_review'),
    path('review/edit/<uuid:review_id>/', views.edit_review_view, name='edit_review'),
    path('review/delete/<uuid:review_id>/', views.delete_review_view, name='delete_review'),
    
    # Legal & Documentation
    path('privacy-protocol/', views.privacy_policy, name='privacy'),
    path('service-agreement/', views.terms_of_service, name='terms'),
    path('developer-api/', views.api_documentation, name='api_docs'),
    
    # SEO
    path('robots.txt', views.robots_txt, name='robots_txt'),
    path('sitemap.xml', views.sitemap_xml, name='sitemap_xml'),
]
