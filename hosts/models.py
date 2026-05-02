"""
hosts/models.py — Listing, ServiceItem, ListingDocument models.
"""
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class ListingStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    PENDING = 'pending', 'Pending Review'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class Category(models.Model):
    """
    Global category for listings (e.g., Restaurant, Cafe).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    icon_svg = models.TextField(blank=True, help_text="SVG path or icon class name")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Listing(models.Model):
    """
    A host's website/service listing with geographic coordinates.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listings',
        db_index=True,
    )

    # Listing info
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='listings'
    )
    website_url = models.URLField(max_length=500)
    company_name = models.CharField(max_length=200)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    short_description = models.CharField(max_length=300)
    slug = models.SlugField(max_length=80, unique=True, db_index=True)

    # Location
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)]
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)]
    )
    location_name = models.CharField(max_length=200, blank=True)

    # Status & moderation
    status = models.CharField(
        max_length=10,
        choices=ListingStatus.choices,
        default=ListingStatus.PENDING,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)

    # Update tracking (max 2)
    update_count = models.PositiveSmallIntegerField(default=0)

    # Schedule
    operating_hours = models.JSONField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'host_listings'
        unique_together = ('latitude', 'longitude')
        ordering = ['-created_at']
        verbose_name = 'Listing'
        verbose_name_plural = 'Listings'

    def __str__(self):
        return f"{self.company_name} ({self.status})"

    @property
    def is_approved(self):
        return self.status == ListingStatus.APPROVED

    @property
    def can_update(self):
        return self.update_count < 2

    @property
    def coordinates(self):
        return (float(self.latitude), float(self.longitude))

    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('maps:listing_detail', kwargs={'slug': self.slug})

    @property
    def average_rating(self):
        from django.db.models import Avg
        result = self.reviews.aggregate(average=Avg('rating'))['average']
        return round(result, 1) if result else 0.0

    @property
    def total_reviews(self):
        return self.reviews.count()


class ServiceItem(models.Model):
    """
    A single service/price entry for a listing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='services',
    )
    service_name = models.CharField(max_length=255, default='')
    category = models.CharField(max_length=200)
    price = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'host_service_items'
        ordering = ['category', 'service_name']
        verbose_name = 'Service Item'

    def __str__(self):
        return f"{self.category}: {self.service_name} — {self.price}"

    def save(self, *args, **kwargs):
        # Auto-capitalize first letter
        if self.service_name:
            self.service_name = self.service_name[0].upper() + self.service_name[1:]
        if self.category:
            self.category = self.category[0].upper() + self.category[1:]
        if self.price:
            self.price = self.price[0].upper() + self.price[1:]
        super().save(*args, **kwargs)


class ListingDocument(models.Model):
    """
    Uploaded service file associated with a listing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    file = models.FileField(upload_to='listing_docs/%Y/%m/')
    original_filename = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'host_documents'
        verbose_name = 'Listing Document'

    def __str__(self):
        return f"{self.listing.company_name} — {self.original_filename}"


class Review(models.Model):
    """
    User review for a listing.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
        db_index=True,
    )
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='reviews',
        db_index=True,
    )
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'host_reviews'
        unique_together = ('user', 'listing')
        ordering = ['-created_at']
        verbose_name = 'Review'
        verbose_name_plural = 'Reviews'

    def __str__(self):
        return f"{self.user.username} - {self.listing.company_name} - {self.rating} stars"
