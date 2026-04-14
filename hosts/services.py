"""
hosts/services.py — Business logic for host listings.
"""
import logging
from django.utils import timezone
from utils.helpers import generate_listing_slug, parse_service_file, validate_upload_file
from .models import Listing, ServiceItem, ListingDocument, ListingStatus

logger = logging.getLogger('webmaps')


def create_listing(host, data: dict, file_obj=None, parsed_services: list = None) -> tuple:
    """
    Create a new listing for a host.
    Returns (listing, errors_dict)
    """
    errors = {}

    # Check coordinate uniqueness
    lat = data.get('latitude')
    lng = data.get('longitude')
    if Listing.objects.filter(latitude=lat, longitude=lng).exists():
        errors['coordinates'] = 'A listing already exists at these exact coordinates.'

    if errors:
        return None, errors

    slug = generate_listing_slug(
        data.get('company_name', ''),
        data.get('location_name', '')
    )

    listing = Listing.objects.create(
        host=host,
        website_url=data['website_url'],
        company_name=data['company_name'],
        short_description=data['short_description'],
        slug=slug,
        latitude=lat,
        longitude=lng,
        location_name=data.get('location_name', ''),
        operating_hours=data.get('operating_hours'),
        status=ListingStatus.PENDING,
    )

    if parsed_services:
        _save_parsed_services(listing, parsed_services)
    elif file_obj:
        _process_service_file(listing, file_obj)

    logger.info(f"Listing created: {listing.slug} by {host.email}")
    return listing, {}


def _process_service_file(listing, file_obj):
    """Parse and save service items from uploaded file."""
    is_valid, error_msg = validate_upload_file(file_obj)
    if not is_valid:
        logger.warning(f"Invalid service file for listing {listing.slug}: {error_msg}")
        return

    services = parse_service_file(file_obj)
    if services:
        # Clear old services and replace
        listing.services.all().delete()
        
        items_to_create = []
        for s in services:
            for cat in s['categories']:
                items_to_create.append(
                    ServiceItem(
                        listing=listing,
                        service_name=s['name'],
                        category=cat,
                        price=s['price']
                    )
                )
        
        ServiceItem.objects.bulk_create(items_to_create)

        # Store the document
        ListingDocument.objects.create(
            listing=listing,
            file=file_obj,
            original_filename=file_obj.name,
        )
        logger.info(f"Parsed {len(services)} services for listing {listing.slug}")


def _save_parsed_services(listing, services: list):
    """Save a list of pre-parsed service dictionaries."""
    if not services:
        return
        
    listing.services.all().delete()
    items_to_create = []
    for s in services:
        name = s.get('name') or s.get('category')  # fallback for old format
        price = s.get('price')
        categories = s.get('categories') or ["General"]
        
        for cat in categories:
            items_to_create.append(
                ServiceItem(
                    listing=listing,
                    service_name=name,
                    category=cat,
                    price=price
                )
            )
    
    ServiceItem.objects.bulk_create(items_to_create)
    logger.info(f"Saved {len(items_to_create)} service items for {listing.slug}")


def update_listing(listing, data: dict, file_obj=None, parsed_services: list = None) -> tuple:
    """
    Update a listing (max 2 times enforced).
    Returns (success: bool, error: str)
    """
    if not listing.can_update:
        return False, 'Maximum update limit (2) reached. No further edits allowed.'

    # Check coordinates if changed
    lat = data.get('latitude', listing.latitude)
    lng = data.get('longitude', listing.longitude)
    coord_changed = (str(lat) != str(listing.latitude) or str(lng) != str(listing.longitude))

    if coord_changed:
        if Listing.objects.filter(latitude=lat, longitude=lng).exclude(id=listing.id).exists():
            return False, 'A listing already exists at these exact coordinates.'

    listing.website_url = data.get('website_url', listing.website_url)
    listing.company_name = data.get('company_name', listing.company_name)
    listing.short_description = data.get('short_description', listing.short_description)
    listing.latitude = lat
    listing.longitude = lng
    listing.location_name = data.get('location_name', listing.location_name)
    listing.operating_hours = data.get('operating_hours', listing.operating_hours)
    listing.update_count += 1
    listing.save()

    if parsed_services:
        _save_parsed_services(listing, parsed_services)
    elif file_obj:
        _process_service_file(listing, file_obj)

    logger.info(f"Listing updated: {listing.slug} (update #{listing.update_count})")
    return True, ''


def approve_listing(listing, admin_user):
    """Admin approves a listing. Starts free trial."""
    listing.status = ListingStatus.APPROVED
    listing.rejection_reason = ''
    listing.save(update_fields=['status', 'rejection_reason'])

    # Start free trial subscription
    try:
        from payments.services import start_free_trial
        start_free_trial(listing)
    except Exception as e:
        logger.error(f"Failed to start free trial for {listing.slug}: {e}")

    # Notify host
    try:
        from notifications.services import create_notification
        create_notification(
            listing.host,
            f"Great news! Your listing '{listing.company_name}' has been approved. "
            f"Your 3-day free trial has started."
        )
    except Exception as e:
        logger.error(f"Failed to create approval notification: {e}")

    logger.info(f"Listing approved: {listing.slug} by {admin_user.email}")


def reject_listing(listing, admin_user, reason: str):
    """Admin rejects a listing."""
    listing.status = ListingStatus.REJECTED
    listing.rejection_reason = reason
    listing.save(update_fields=['status', 'rejection_reason'])

    try:
        from notifications.services import create_notification
        create_notification(
            listing.host,
            f"Your listing '{listing.company_name}' was not approved. "
            f"Reason: {reason}"
        )
    except Exception as e:
        logger.error(f"Failed to create rejection notification: {e}")

    logger.info(f"Listing rejected: {listing.slug} by {admin_user.email}")
