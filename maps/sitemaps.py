from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from hosts.models import Listing

class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = 'daily'

    def items(self):
        return ['maps:home', 'auth_app:login', 'auth_app:register']

    def location(self, item):
        return reverse(item)

class ListingSitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.9

    def items(self):
        return Listing.objects.filter(status='approved', deleted_at__isnull=True)

    def lastmod(self, obj):
        return obj.updated_at
