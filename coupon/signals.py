from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Coupon, Notification
from django.contrib.auth import get_user_model

User = get_user_model()

@receiver(post_save, sender=Coupon)
def send_coupon_notification(sender, instance, created, **kwargs):
    if created:
        if instance.target == 'specific' and instance.user:
            Notification.objects.create(
                user=instance.user,
                title="Exclusive Coupon For You!",
                message=f"Use code {instance.code} to get {instance.discount_value} {instance.discount_type} off!",
                coupon=instance
            )
        elif instance.target == 'all':
            # This could be slow for many users, ideally use a task queue like Celery
            # For now, we'll create notifications for all active users
            users = User.objects.filter(is_active=True)
            notifications = [
                Notification(
                    user=user,
                    title="New Discount Available!",
                    message=f"A new coupon {instance.code} is now available for everyone!",
                    coupon=instance
                ) for user in users
            ]
            Notification.objects.bulk_create(notifications)
