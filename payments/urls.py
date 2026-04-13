"""
payments/urls.py
"""
from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    path('plans/<slug:slug>/', views.plans_view, name='plans'),
    path('initiate/<slug:slug>/', views.initiate_payment_view, name='initiate'),
    path('verify/', views.verify_payment_view, name='verify'),
    path('success/', views.payment_success_view, name='success'),
    path('failure/', views.payment_failure_view, name='failure'),
]
