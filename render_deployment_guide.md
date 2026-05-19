# 🚀 WebMaps — Render Production Deployment Guide

This guide describes how to deploy the **WebMaps** location-based business discovery platform to production on Render with a live PostgreSQL database and production-grade security.

---

## 🛠️ 1. Render Dashboard Configuration

When creating a new **Web Service** on Render, configure the following settings:

### A. Environment
* **Runtime:** `Python`
* **Build Command:**
  ```bash
  pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
  ```
* **Start Command:**
  ```bash
  gunicorn WebMaps.wsgi:application
  ```

---

## 🔑 2. Required Environment Variables

Add the following variables in the **Environment** tab of your Render Web Service:

| Variable Name | Recommended Value / Action | Purpose |
| :--- | :--- | :--- |
| `RENDER` | `true` | Tells Django it's running in production on Render. Automatically forces `DEBUG = False`, secure cookies, SSL redirects, and HSTS. |
| `SECRET_KEY` | *[Generate a 50+ character random string]* | Cryptographic signing key for sessions/tokens. |
| `ALLOWED_HOSTS` | `your-app-name.onrender.com` | Restricts allowed host headers. |
| `DATABASE_URL` | *[Auto-populated when linking a Render PostgreSQL database]* | The Postgres database connection URI. |
| `DEBUG` | `False` | Reinforces debug-mode state (though overridden to False automatically when `RENDER=true`). |
| `SESSION_COOKIE_SECURE` | `True` | Transmits session cookies only over HTTPS connections. |
| `CSRF_COOKIE_SECURE` | `True` | Transmits CSRF cookies only over HTTPS connections. |
| `SECURE_SSL_REDIRECT` | `True` | Forces all HTTP traffic to redirect to secure HTTPS. |
| `SITE_URL` | `https://your-app-name.onrender.com` | Base URL used for public links and sitemaps. |

---

## 🐘 3. Neon Serverless PostgreSQL Setup

Since you are using **Neon PostgreSQL** for production, follow these steps to connect it seamlessly:

1. **Get the Neon Connection String:**
   * Go to your **Neon Console** (https://console.neon.tech).
   * In your Dashboard, copy the connection string under **Connection Details**.
   * Make sure it is set to **pooled** if you want optimal performance, and select **Django** or **Go/Libpq** format.
   * The URL will look like:
     ```text
     postgres://alex:secretpassword@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```

2. **Add it to Render:**
   * In your Render service, go to **Environment** > **Environment Variables**.
   * Add a new environment variable called `DATABASE_URL`.
   * Paste your Neon connection string as the value.
   * *Note:* You do **not** need to set up a Render database service since you are using Neon! Django will connect directly to Neon dynamically using the `DATABASE_URL` environment variable you provided.

---

## 🛡️ 4. Built-In Security Features Activated in this Project

Our security audit and hardening have successfully configured:

1. **Auto Production Guard (`DEBUG` Enforcement):**
   * If `RENDER=true` is detected, `DEBUG` is set to `False` automatically. This prevents showing the Django yellow error page (with database credentials, secrets, etc.) to the public.

2. **Automated Host Parsing (`ALLOWED_HOSTS`):**
   * Dynamic addition of `RENDER_EXTERNAL_HOSTNAME` and `*.onrender.com` ensures zero HTTP Host header errors while keeping local dev secure.

3. **Dynamic CORS & CSRF Trusted Origins:**
   * Automatically adds the dynamic Render hostname and `*.onrender.com` to Django's CSRF trusted origins, preventing the common "CSRF verification failed" page errors without hardcoding other project domains.

4. **Premium Custom Error Handling:**
   * Custom 404 (Page Not Found), 403 (Forbidden), 429 (Too Many Requests), and 500 (Server Error) custom-designed templates are automatically active.

5. **Robust Content Security Policy (CSP):**
   * Pre-configured CSP headers allow Leaflet maps, OpenStreetMap tiles, Razorpay, Google APIs, and PayPal integrations, while protecting from external scripting injections.
