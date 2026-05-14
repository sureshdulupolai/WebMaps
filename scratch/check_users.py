import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from users.models import User

emails = ['sureshone@gmail.com', 'sureshpolai63@gmail.com']
password_to_check = 'Krish123'

for email in emails:
    try:
        user = User.objects.get(email=email)
        match = user.check_password(password_to_check)
        print(f"User: {email}")
        print(f"  Exists: True")
        print(f"  Password '{password_to_check}' matches: {match}")
        print(f"  Is Active: {user.is_active}")
        print(f"  Role: {user.role}")
    except User.DoesNotExist:
        print(f"User: {email}")
        print(f"  Exists: False")
