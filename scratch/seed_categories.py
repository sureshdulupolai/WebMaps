import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'WebMaps.settings')
django.setup()

from hosts.models import Category
from django.utils.text import slugify

categories = [
    "Restaurant",
    "Cafe",
    "Retail",
    "Services"
]

for cat_name in categories:
    Category.objects.get_or_create(
        name=cat_name,
        defaults={'slug': slugify(cat_name)}
    )

print("Categories seeded successfully.")
