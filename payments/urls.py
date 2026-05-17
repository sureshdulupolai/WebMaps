"""
payments/urls.py
"""
from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    path('plans/<slug:slug>/', views.plans_view, name='plans'),
    path('checkout/<slug:slug>/', views.checkout_page_view, name='checkout'),
    path('initiate/<slug:slug>/', views.initiate_payment_view, name='initiate'),
    path('verify/', views.verify_payment_view, name='verify'),
    path('paypal-verify/', views.paypal_verify_view, name='paypal_verify'),
    path('success/', views.payment_success_view, name='success'),
    path('failure/', views.payment_failure_view, name='failure'),
]
