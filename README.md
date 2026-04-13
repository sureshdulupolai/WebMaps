# WebMaps

## Project Description

This platform allows users to find businesses by location using an interactive map.

**Users can:**
- Search businesses
- View listings
- Post reviews
- Find nearby services

**Hosts can:**
- Create listings
- Manage services

**Admins can:**
- Approve listings
- Manage users

---

## Features

- User authentication
- Listings management
- Reviews system
- Map search
- Route search
- Admin dashboard
- Notifications
- Analytics

---

## Technology Stack

- **Backend:** Django 4.2
- **Frontend:** HTML, CSS, JavaScript
- **Map System:** OpenStreetMap, Leaflet, Nominatim, OSRM
- **Database:** SQLite

---

## Installation Steps

\`\`\`bash
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
\`\`\`

---

## Project Structure

\`\`\`text
WebMaps/

adminpanel/
analytics/
auth_app/
errors/
hosts/
maps/
middleware/
notifications/
payments/
users/
utils/

templates/
static/

manage.py
db.sqlite3
\`\`\`

---

## How Maps Work

This project uses OpenStreetMap and Leaflet instead of Google Maps.

**Benefits:**
- Free
- No billing
- No API key
- Open source

---

## License

MIT
