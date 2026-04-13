"""
errors/admin.py
"""
from django.contrib import admin
from .models import AppError


@admin.register(AppError)
class AppErrorAdmin(admin.ModelAdmin):
    list_display = ('error_type', 'error_message', 'url_path', 'occurrence_count', 'last_seen_at')
    list_filter = ('error_type',)
    search_fields = ('error_message', 'url_path')
    readonly_fields = ('id', 'first_seen_at', 'last_seen_at', 'occurrence_count')
    ordering = ('-last_seen_at',)
