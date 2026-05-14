import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from users.models import User

emails = ['sureshone@gmail.com', 'sureshpolai63@gmail.com']
new_password = 'Krish123'

for email in emails:
    try:
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        print(f"Password reset for {email} to {new_password}")
    except User.DoesNotExist:
        print(f"User {email} not found.")
