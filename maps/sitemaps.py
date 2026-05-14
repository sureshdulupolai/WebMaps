"""
maps/sitemaps.py — Enterprise sitemap for business listings.
"""
from django.contrib.sitemaps import Sitemap
from hosts.models import Listing

class ListingSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.9

    def items(self):
        # Only index active and approved listings
        return Listing.objects.filter(deleted_at__isnull=True, status='APPROVED')

    def lastmod(self, obj):
        return obj.updated_at

    def location(self, obj):
        from django.urls import reverse
        return reverse('maps:listing_detail', args=[obj.id])

class StaticViewSitemap(Sitemap):
    priority = 0.5
    changefreq = 'monthly'

    def items(self):
        return ['maps:home', 'auth_app:login', 'auth_app:register']

    def location(self, item):
        from django.urls import reverse
        return reverse(item)
