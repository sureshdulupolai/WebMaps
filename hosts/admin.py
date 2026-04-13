"""
hosts/admin.py
"""
from django.contrib import admin
from .models import Listing, ServiceItem, ListingDocument


class ServiceItemInline(admin.TabularInline):
    model = ServiceItem
    extra = 0


class ListingDocumentInline(admin.TabularInline):
    model = ListingDocument
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'host', 'status', 'update_count', 'created_at')
    list_filter = ('status',)
    search_fields = ('company_name', 'website_url', 'slug')
    readonly_fields = ('id', 'slug', 'created_at', 'updated_at')
    inlines = [ServiceItemInline, ListingDocumentInline]


@admin.register(ServiceItem)
class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ('category', 'price', 'listing')
    search_fields = ('category', 'listing__company_name')
