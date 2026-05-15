"""
utils/management/commands/cleanup_data.py
Cleans up old sessions and analytics data.
Usage: python manage.py cleanup_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.sessions.models import Session
from analytics.models import ListingDailyStats, DailyUniqueVisitor

class Command(BaseCommand):
    help = 'Cleans up expired sessions and analytics data older than 180 days.'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # 1. Clean expired sessions (Django built-in logic)
        self.stdout.write("Cleaning expired sessions...")
        from django.core.management import call_command
        call_command('clearsessions')

        # 2. Clean DailyUniqueVisitor (Old data not needed for aggregation)
        # Keep only last 30 days of unique visitor tracking
        days_30 = now - timezone.timedelta(days=30)
        uv_count, _ = DailyUniqueVisitor.objects.filter(date__lt=days_30.date()).delete()
        self.stdout.write(f"Deleted {uv_count} old unique visitor logs (older than 30 days).")

        # 3. Clean ListingDailyStats (Keep last 180 days)
        days_180 = now - timezone.timedelta(days=180)
        stats_count, _ = ListingDailyStats.objects.filter(date__lt=days_180.date()).delete()
        self.stdout.write(f"Deleted {stats_count} old stats rows (older than 180 days).")

        self.stdout.write(self.style.SUCCESS('Data cleanup complete.'))
