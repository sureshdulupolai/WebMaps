"""
hosts/validators.py — Validators for host listings.
"""
from django.core.exceptions import ValidationError
from utils.helpers import is_valid_url, contains_dangerous_content


def validate_listing_url(url: str):
    if not is_valid_url(url):
        raise ValidationError('Enter a valid URL starting with http:// or https://')


def validate_coordinates(lat, lng):
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        raise ValidationError('Coordinates must be valid numbers.')
    if not (-90 <= lat <= 90):
        raise ValidationError('Latitude must be between -90 and 90.')
    if not (-180 <= lng <= 180):
        raise ValidationError('Longitude must be between -180 and 180.')


def validate_short_description(text: str):
    if len(text) > 300:
        raise ValidationError('Description cannot exceed 300 characters.')
    if contains_dangerous_content(text):
        raise ValidationError('Description contains invalid content.')


def validate_company_name(name: str):
    if len(name) < 2:
        raise ValidationError('Company name must be at least 2 characters.')
    if contains_dangerous_content(name):
        raise ValidationError('Company name contains invalid content.')
