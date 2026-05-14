import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from users.models import User, UserRole

email = 'sureshone@gmail.com'
try:
    user = User.objects.get(email=email)
    user.role = UserRole.HOST
    user.save()
    print(f"Role updated for {email} to: {user.role}")
except User.DoesNotExist:
    print(f"User {email} not found")
