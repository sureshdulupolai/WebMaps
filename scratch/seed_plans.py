import os
import django
import sys

# Set up Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from payments.services import seed_subscription_plans

if __name__ == "__main__":
    print("Seeding subscription plans...")
    seed_subscription_plans()
    print("Done.")
