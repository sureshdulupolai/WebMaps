"""
hosts/apps.py
"""
from django.apps import AppConfig


class HostsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hosts'

    def ready(self):
        import hosts.signals  # noqa
