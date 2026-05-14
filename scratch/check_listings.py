import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from users.models import User
from hosts.models import Listing

email = 'sureshone@gmail.com'
try:
    user = User.objects.get(email=email)
    listings_count = Listing.objects.filter(host=user).count()
    print(f"User: {email}")
    print(f"  Role: {user.role}")
    print(f"  Listings Count: {listings_count}")
except User.DoesNotExist:
    print(f"User {email} not found")
