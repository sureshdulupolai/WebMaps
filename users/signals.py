"""
users/signals.py — Post-save signals for user model.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger('webmaps')


@receiver(post_save, sender='users.User')
def user_created(sender, instance, created, **kwargs):
    if created:
        logger.info(f"New user registered: {instance.email} (role={instance.role})")
