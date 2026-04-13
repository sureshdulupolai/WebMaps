"""
hosts/signals.py
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger('webmaps')


@receiver(post_save, sender='hosts.Listing')
def listing_status_changed(sender, instance, created, **kwargs):
    if created:
        logger.info(f"New listing submitted: {instance.slug}")
