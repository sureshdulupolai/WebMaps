"""
hosts/admin.py
"""
from django.contrib import admin
from .models import Listing, ServiceItem, ListingDocument, Category


class ServiceItemInline(admin.TabularInline):
    model = ServiceItem
    extra = 0


class ListingDocumentInline(admin.TabularInline):
    model = ListingDocument
    extra = 0
    readonly_fields = ('created_at',)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'created_at')
    prepopulated_fields = {'slug': ('name',)}



@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'host', 'category', 'status', 'update_count', 'is_active_on_map', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('company_name', 'website_url', 'slug')
    readonly_fields = ('id', 'slug', 'created_at', 'updated_at', 'last_started_at', 'last_stopped_at')
    fieldsets = (
        ('Basic Info', {'fields': ('id', 'slug', 'company_name', 'host', 'category', 'status', 'update_count')}),
        ('Location', {'fields': ('latitude', 'longitude', 'location_name')}),
        ('Visibility & Cooldown', {'fields': ('is_active_on_map', 'last_started_at', 'last_stopped_at')}),
        ('Audit', {'fields': ('created_at', 'updated_at')}),
    )
    inlines = [ServiceItemInline, ListingDocumentInline]


@admin.register(ServiceItem)
class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ('category', 'price', 'listing')
    search_fields = ('category', 'listing__company_name')
