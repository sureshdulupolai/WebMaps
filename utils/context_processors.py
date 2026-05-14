"""
utils/context_processors.py — Injects SEO metadata into all templates.
"""
from django.conf import settings

def seo_metadata(request):
    """
    Returns global SEO metadata. 
    Specific views can override these in their own context.
    """
    full_url = request.build_absolute_uri()
    
    return {
        'seo': {
            'site_name': 'WebMaps',
            'title': 'WebMaps — Discover Local Businesses & Routes',
            'description': 'The most advanced location-based business discovery platform. Find nearby services, optimize routes, and manage your business presence.',
            'og_image': request.build_absolute_uri('/static/images/og-main.png'),
            'canonical_url': full_url.split('?')[0], # Strip query params for canonical
            'twitter_handle': '@webmaps',
            'ai_optimized': True,
        }
    }
