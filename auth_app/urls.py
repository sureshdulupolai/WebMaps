"""
auth_app/urls.py
"""
from django.urls import path
from . import views

app_name = 'auth_app'

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('register/developer/', views.register_developer_view, name='register_developer'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('refresh/', views.refresh_token_view, name='refresh_token'),
    path('password-reset/', views.password_reset_request_view, name='password_reset_request'),
    path('password-reset/confirm/', views.password_reset_confirm_view, name='password_reset_confirm'),
]
