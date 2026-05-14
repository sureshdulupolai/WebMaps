"""
utils/seo.py — Enterprise-grade SEO & AI-Search Optimization Engine.
Generates JSON-LD, OpenGraph, and Dynamic Meta Tags.
"""
import json
from django.utils.safestring import mark_safe
from django.urls import reverse

def get_base_schema(request):
    """Generates the Organization schema for the entire platform."""
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "WebMaps",
        "url": request.build_absolute_uri('/'),
        "logo": request.build_absolute_uri('/static/images/logo.png'),
        "sameAs": [
            "https://twitter.com/webmaps",
            "https://linkedin.com/company/webmaps"
        ]
    }

def get_listing_schema(listing, request):
    """Generates LocalBusiness schema for AI and Google Search."""
    schema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": listing.company_name,
        "description": listing.short_description,
        "telephone": listing.mobile_number if listing.mobile_number else "",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": listing.location_name,
            "addressCountry": "IN"
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": float(listing.latitude),
            "longitude": float(listing.longitude)
        },
        "url": request.build_absolute_uri(listing.get_absolute_url()),
        "priceRange": "₹₹"
    }
    
    # Add FAQ Schema if listing has common questions
    schema["mainEntity"] = [
        {
            "@type": "Question",
            "name": f"Where is {listing.company_name} located?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f"{listing.company_name} is located at {listing.location_name}."
            }
        }
    ]
    
    if listing.mobile_number:
        schema["mainEntity"].append({
            "@type": "Question",
            "name": f"How can I contact {listing.company_name}?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f"You can reach them at {listing.mobile_number}."
            }
        })
        
    return schema

def render_json_ld(schema_data):
    """Safely renders JSON-LD for injection into the <head>."""
    return mark_safe(f'<script type="application/ld+json">{json.dumps(schema_data)}</script>')
