"""
users/permissions.py — DRF permission classes for role-based access control.
"""
from rest_framework.permissions import BasePermission


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'customer'


class IsHost(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'host'


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsVerified(BasePermission):
    message = 'Please verify your email to access this feature.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_verified
