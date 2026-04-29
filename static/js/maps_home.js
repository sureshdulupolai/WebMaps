/**
 * maps_home.js
 * Tab toggling logic for the Home/Dashboard page, pulled from inline scripts.
 */

function toggleTab(tab) {
  document.querySelectorAll('.tab-pill').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  if (tab === 'location') {
     const tabLoc = document.getElementById('tab-location');
     if (tabLoc) {
       tabLoc.classList.add('active');
       tabLoc.setAttribute('aria-selected', 'true');
     }
     const formLoc = document.getElementById('search-form-location');
     if (formLoc) formLoc.classList.add('active');
  } else {
     const tabRoute = document.getElementById('tab-route');
     if (tabRoute) {
       tabRoute.classList.add('active');
       tabRoute.setAttribute('aria-selected', 'true');
     }
     const formRoute = document.getElementById('search-form-route');
     if (formRoute) formRoute.classList.add('active');
  }
}

function switchView(view) {
  const mapBtn = document.getElementById('view-map-btn');
  const productBtn = document.getElementById('view-product-btn');
  const productView = document.getElementById('product-view');
  const mapEl = document.getElementById('map');
  
  if (view === 'map') {
    if(mapBtn) mapBtn.classList.add('active');
    if(productBtn) productBtn.classList.remove('active');
    if(productView) productView.classList.remove('active');
    if(mapEl) mapEl.style.opacity = '1';
  } else {
    if(mapBtn) mapBtn.classList.remove('active');
    if(productBtn) productBtn.classList.add('active');
    if(productView) productView.classList.add('active');
    if(mapEl) mapEl.style.opacity = '0';
  }
}

// Geolocation & Auto-fill Logic
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1';
const LOCATION_OVERLAY_KEY = 'webmaps_location_granted';

function enableInput() {
  const input = document.getElementById('loc-search-input');
  if (input) input.disabled = false;
}

function closeLocationOverlay() {
  const overlay = document.getElementById('location-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    // User explicitly said "Maybe Later", so we don't store the granted flag.
    // However, they can still search manually.
  }
  enableInput();
}

async function handleLocationEnable() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    closeLocationOverlay();
    return;
  }

  const btn = document.getElementById('location-allow-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⌛ Detecting...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      // Store current coords for "change detection" later
      localStorage.setItem('webmaps_last_lat', latitude);
      localStorage.setItem('webmaps_last_lng', longitude);
      
      try {
        const response = await fetch(NOMINATIM_URL.replace('{lat}', latitude).replace('{lon}', longitude));
        const data = await response.json();
        
        if (data && data.address) {
          const addr = data.address;
          const neighborhood = addr.neighborhood || addr.suburb || addr.residential || '';
          const city = addr.city || addr.town || addr.village || addr.state_district || '';
          
          let displayAddress = neighborhood && city ? `${neighborhood}, ${city}` : data.display_name.split(',').slice(0, 2).join(', ');

          const input = document.getElementById('loc-search-input');
          if (input) {
            input.value = displayAddress;
            // TRIGGER SEARCH AUTOMATICALLY WITH COORDS FOR SPEED
            handleSearchLocation(null, latitude, longitude);
          }
          // Set persistent flag
          localStorage.setItem(LOCATION_OVERLAY_KEY, 'true');
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      } finally {
        const overlay = document.getElementById('location-overlay');
        if (overlay) overlay.classList.add('hidden');
        enableInput();
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      btn.disabled = false;
      btn.innerHTML = originalText;
      alert("Unable to retrieve location. Please check your browser permissions.");
      closeLocationOverlay();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

async function checkLocationPermission() {
  // Check browser permission API if available
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      if (result.state === 'granted') {
        // Direct autofill if already allowed
        handleLocationSilent();
        return;
      } else if (result.state === 'denied') {
        // If denied, we don't show the overlay as it would be useless
        enableInput();
        return;
      }
    } catch (e) {}
  }

  // If not granted or prompt, show professional overlay unless previously "handled"
  if (!localStorage.getItem(LOCATION_OVERLAY_KEY)) {
    const overlay = document.getElementById('location-overlay');
    if (overlay) overlay.classList.remove('hidden');
  } else {
    enableInput();
  }
}

async function handleLocationSilent() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    
    // Check if location changed significantly (> 2km roughly)
    const oldLat = localStorage.getItem('webmaps_last_lat');
    const oldLng = localStorage.getItem('webmaps_last_lng');
    
    if (oldLat && oldLng) {
      const dist = Math.sqrt(Math.pow(latitude - oldLat, 2) + Math.pow(longitude - oldLng, 2));
      if (dist > 0.02) { // roughly 2km
        console.log("Location changed significantly. Updating results...");
      }
    }
    
    localStorage.setItem('webmaps_last_lat', latitude);
    localStorage.setItem('webmaps_last_lng', longitude);

    try {
      const response = await fetch(NOMINATIM_URL.replace('{lat}', latitude).replace('{lon}', longitude));
      const data = await response.json();
      if (data && data.address) {
         const addr = data.address;
         const neighborhood = addr.neighborhood || addr.suburb || addr.residential || '';
         const city = addr.city || addr.town || addr.village || addr.state_district || '';
         const displayAddress = neighborhood && city ? `${neighborhood}, ${city}` : data.display_name.split(',').slice(0, 2).join(', ');
         
         const input = document.getElementById('loc-search-input');
         if (input) {
           input.value = displayAddress;
           // Trigger automatic search with coords
           handleSearchLocation(null, latitude, longitude);
         }
      }
    } catch(e) {
      console.error("Silent location update failed", e);
    } finally {
      enableInput();
    }
  }, (err) => {
    console.warn("Silent geolocation failed", err);
    enableInput();
  }, { enableHighAccuracy: true, timeout: 10000 });
}

// Ensure initMap is completely executed upon load
document.addEventListener('DOMContentLoaded', () => {
    const locInput = document.getElementById('loc-search-input');
    const locBtn = document.getElementById('loc-search-btn');
    if (locInput) locInput.disabled = true;
    if (locBtn) locBtn.style.display = 'none';

    if (typeof initMap === 'function') initMap();
    checkLocationPermission();

    // Debounce logic for search input
    let typingTimer;
    const doneTypingInterval = 2000;
    
    if (locInput) {
      locInput.addEventListener('input', () => {
        if (locBtn) locBtn.style.display = 'none';
        clearTimeout(typingTimer);
        if (locInput.value) {
          typingTimer = setTimeout(() => {
            if (locBtn) locBtn.style.display = 'flex';
          }, doneTypingInterval);
        }
      });
    }
});
