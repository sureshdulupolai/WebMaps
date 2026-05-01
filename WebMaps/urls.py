"""
WebMaps — Root URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.sitemaps.views import sitemap
from django.views.generic import TemplateView
from maps.sitemaps import StaticViewSitemap, ListingSitemap

sitemaps = {
    'static': StaticViewSitemap,
    'listings': ListingSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('auth/', include('auth_app.urls', namespace='auth_app')),
    path('users/', include('users.urls', namespace='users')),

    # Core features
    path('', include('maps.urls', namespace='maps')),
    path('hosts/', include('hosts.urls', namespace='hosts')),
    path('adminpanel/', include('adminpanel.urls', namespace='adminpanel')),
    path('payments/', include('payments.urls', namespace='payments')),
    path('notifications/', include('notifications.urls', namespace='notifications')),
    path('coupon/', include('coupon.urls', namespace='coupon')),

    # API endpoints
    path('api/analytics/', include('analytics.urls', namespace='analytics')),

    # SEO
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('robots.txt', TemplateView.as_view(template_name='robots.txt', content_type='text/plain')),
]

# Serve media & static files in development — MUST come before any catch-all
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Custom error handlers (production — DEBUG=False)
# For DEBUG=True, CustomErrorMiddleware in middleware.py handles it
handler404 = 'errors.views.error_404'
handler500 = 'errors.views.error_500'
handler403 = 'errors.views.error_403'
