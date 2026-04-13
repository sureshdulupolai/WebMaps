"""
users/models.py — Custom User model with UUID PK, roles, OTP, email verification.
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class UserRole(models.TextChoices):
    CUSTOMER = 'customer', 'Customer'
    HOST = 'host', 'Host'
    ADMIN = 'admin', 'Admin'


class UserManager(BaseUserManager):
    """Custom manager for User model."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email)
        extra_fields.setdefault('is_active', True)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Central user model.
    Roles: customer, host, admin
    Authentication: email + password
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Identity
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=60, unique=True, db_index=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Role
    role = models.CharField(
        max_length=10,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
        db_index=True,
    )

    # Flags
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Password reset
    password_reset_token = models.CharField(max_length=128, blank=True, null=True)
    reset_token_expires_at = models.DateTimeField(null=True, blank=True)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    @property
    def is_reset_token_valid(self):
        if not self.password_reset_token or not self.reset_token_expires_at:
            return False
        return timezone.now() < self.reset_token_expires_at

    # Role helpers
    @property
    def is_customer(self):
        return self.role == UserRole.CUSTOMER

    @property
    def is_host(self):
        return self.role == UserRole.HOST

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN
