"""
Django production-grade settings for WebMaps project.
Uses python-decouple for environment-based configuration.
"""

import os
import dj_database_url
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

# ─────────────────────────────────────────────
#  BASE
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-now')

# In Render or production environments, force DEBUG = False
DEBUG = config('DEBUG', default=True, cast=bool)
if os.environ.get('RENDER') == 'true':
    DEBUG = False

# Ultimate security safeguard: prevent deploying with a known default secret key in production
if (os.environ.get('RENDER') == 'true' or not DEBUG) and SECRET_KEY == 'django-insecure-change-me-now':
    raise ValueError(
        "CRITICAL SECURITY EXCEPTION: The default insecure SECRET_KEY cannot be used in a production environment! "
        "Please set a strong, unique SECRET_KEY environment variable in your host panel."
    )

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='127.0.0.1,localhost', cast=Csv())
# If on Render, make sure to add the Render default hosts dynamically
if os.environ.get('RENDER') == 'true':
    render_external_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
    if render_external_hostname:
        ALLOWED_HOSTS.append(render_external_hostname)
    for host in ['*.onrender.com', 'localhost', '127.0.0.1']:
        if host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(host)

SITE_URL = config('SITE_URL', default='http://127.0.0.1:8000')

# ─────────────────────────────────────────────
#  CUSTOM USER MODEL
# ─────────────────────────────────────────────
AUTH_USER_MODEL = 'users.User'

# ─────────────────────────────────────────────
#  INSTALLED APPS
# ─────────────────────────────────────────────
INSTALLED_APPS = [
    # Django built-ins
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.sitemaps',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # Project apps
    'utils',
    'users',
    'auth_app',
    'hosts',
    'adminpanel',
    'maps',
    'payments',
    'analytics',
    'notifications',
    'errors',
    'middleware',
    'coupon',
]

# ─────────────────────────────────────────────
#  MIDDLEWARE
# ─────────────────────────────────────────────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'middleware.middleware.CustomErrorMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'middleware.jwt_middleware.JWTAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    # Custom middleware
    'middleware.middleware.SecurityHeadersMiddleware',
    'middleware.middleware.RateLimitMiddleware',
    'middleware.middleware.BotProtectionMiddleware',
    'middleware.middleware.ErrorCaptureMiddleware',
    'middleware.middleware.ActivityTrackingMiddleware',
]

ROOT_URLCONF = 'WebMaps.urls'

SITE_ID = 1

# ─────────────────────────────────────────────
#  TEMPLATES
# ─────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'utils.context_processors.seo_metadata',
            ],
        },
    },
]

WSGI_APPLICATION = 'WebMaps.wsgi.application'

# ─────────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────────
# SQLite for local development, PostgreSQL (or other configured DB) for live Render environment
database_url = os.environ.get('DATABASE_URL')
is_internal_render_db = database_url and 'dpg-' in database_url and '.render.com' not in database_url and os.environ.get('RENDER') != 'true'

if (os.environ.get('RENDER') == 'true' or database_url) and not is_internal_render_db:
    DATABASES = {
        'default': dj_database_url.config(
            default=database_url,
            conn_max_age=600,
            ssl_require=os.environ.get('RENDER') == 'true'
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ─────────────────────────────────────────────
#  PASSWORD HASHING  — Argon2 (Gold Standard)
# ─────────────────────────────────────────────
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─────────────────────────────────────────────
#  DJANGO REST FRAMEWORK
# ─────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'auth_app.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}

# ─────────────────────────────────────────────
#  JWT SETTINGS
# ─────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=180),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': config('SESSION_COOKIE_SECURE', default=False, cast=bool),
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

JWT_ACCESS_COOKIE = 'access_token'
JWT_REFRESH_COOKIE = 'refresh_token'

# ─────────────────────────────────────────────
#  CORS
# ─────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]
CORS_ALLOW_CREDENTIALS = True

# ─────────────────────────────────────────────
#  CSRF
# ─────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]

# If deployed on Render, append the default render domain dynamically to trusted origins
if os.environ.get('RENDER') == 'true':
    render_external_hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
    if render_external_hostname:
        CSRF_TRUSTED_ORIGINS.append(f'https://{render_external_hostname}')
        CORS_ALLOWED_ORIGINS.append(f'https://{render_external_hostname}')
    # Also support common wildcards/subdomains for Render
    if 'https://*.onrender.com' not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append('https://*.onrender.com')
    if 'https://*.onrender.com' not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append('https://*.onrender.com')

CSRF_COOKIE_HTTPONLY = False  # JS needs to read it for AJAX (for X-CSRFToken header)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=not DEBUG, cast=bool)
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = False  # Use cookie-based CSRF for better AJAX compatibility

# ─────────────────────────────────────────────
#  SECURITY HEADERS (production)
# ─────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=not DEBUG, cast=bool)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=not DEBUG, cast=bool)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=not DEBUG, cast=bool)
CSRF_COOKIE_SAMESITE = 'Lax'
X_FRAME_OPTIONS = 'DENY'

if not DEBUG or os.environ.get('RENDER') == 'true':
    # Force production secure settings, overriding any unsafe local .env settings
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # Full HSTS Protection
    SECURE_HSTS_SECONDS = 63072000  # 2 years
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # Extra protection
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_SESSION_COOKIE_SAMESITE = 'Strict'

# ─────────────────────────────────────────────
#  EMAIL
# ─────────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = 'WebMaps <noreply@webmaps.com>'

# ─────────────────────────────────────────────
#  STATIC & MEDIA
# ─────────────────────────────────────────────
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Versioned static files for cache busting and tampering prevention (Production only)
if not DEBUG:
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ─────────────────────────────────────────────
#  CACHE (in-memory for dev, Redis for prod)
# ─────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'webmaps-cache',
    }
}

# ─────────────────────────────────────────────
#  INTERNATIONALIZATION
# ─────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# ─────────────────────────────────────────────
#  DEFAULT AUTO FIELD
# ─────────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─────────────────────────────────────────────
#  RAZORPAY
# ─────────────────────────────────────────────
RAZORPAY_KEY_ID = config('RAZORPAY_KEY_ID', default='')
RAZORPAY_KEY_SECRET = config('RAZORPAY_KEY_SECRET', default='')

# ─────────────────────────────────────────────
#  PAYPAL
# ─────────────────────────────────────────────
PAYPAL_CLIENT_ID = config('PAYPAL_CLIENT_ID', default='sb')

# ─────────────────────────────────────────────
#  FILE UPLOAD SETTINGS
# ─────────────────────────────────────────────
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = ['.txt', '.csv', '.pdf']
ALLOWED_UPLOAD_MIME_TYPES = ['text/plain', 'text/csv', 'application/pdf']

# ─────────────────────────────────────────────
#  RATE LIMITING (custom middleware config)
# ─────────────────────────────────────────────
ENABLE_RATE_LIMITING = config('ENABLE_RATE_LIMITING', default=True, cast=bool)
RATE_LIMIT_LOGIN = 5       # per minute (Strict for brute-force protection)
RATE_LIMIT_REGISTER = 3    # per minute
RATE_LIMIT_API = 100       # per minute

# ─────────────────────────────────────────────
#  OTP / TOKENS
# ─────────────────────────────────────────────
OTP_EXPIRY_MINUTES = 10
PASSWORD_RESET_EXPIRY_MINUTES = 30

# ─────────────────────────────────────────────
#  FREE TRIAL
# ─────────────────────────────────────────────
FREE_TRIAL_DAYS = 3

# ─────────────────────────────────────────────
#  SUBSCRIPTION EXPIRY NOTIFICATION
# ─────────────────────────────────────────────
SUBSCRIPTION_NOTIFY_DAYS_BEFORE = 3

# ─────────────────────────────────────────────
#  LOGGING
# ─────────────────────────────────────────────
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'webmaps.log',
            'maxBytes': 1024 * 1024 * 5,  # 5MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'error_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'errors.log',
            'maxBytes': 1024 * 1024 * 5,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'webmaps': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'webmaps.errors': {
            'handlers': ['console', 'error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# ─────────────────────────────────────────────
#  CUSTOM ERROR HANDLERS
#  (Defined in urls.py — Django's correct location)
# ─────────────────────────────────────────────
# handler404, handler500, handler403 → see WebMaps/urls.py
