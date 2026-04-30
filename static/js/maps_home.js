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

function setInputLoading(loading) {
  const input = document.getElementById('loc-search-input');
  if (!input) return;
  
  if (loading) {
    input.disabled = true;
    input.setAttribute('data-old-placeholder', input.placeholder);
    input.placeholder = "⌛ Refining GPS Accuracy...";
    input.classList.add('loading-state');
  } else {
    input.disabled = false;
    const old = input.getAttribute('data-old-placeholder');
    if (old) input.placeholder = old;
    input.classList.remove('loading-state');
  }
}

async function handleLocationEnable() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  // Show fetching overlay
  const overlay = document.getElementById('fetching-overlay');
  if (overlay) overlay.classList.remove('hidden');

  setInputLoading(true);

  let detected = false;
  let bestCoords = null;

  // Function to finalize and clean up
  async function complete(lat, lng) {
    if (detected) return;
    detected = true;

    // Stop all watchers/timeouts
    if (window.activeWatcher) navigator.geolocation.clearWatch(window.activeWatcher);
    if (window.activeLockTimeout) clearTimeout(window.activeLockTimeout);
    
    hideFetchingOverlay();

    if (!lat || !lng) {
       setInputLoading(false);
       return;
    }

    const input = document.getElementById('loc-search-input');
    const sBtn = document.getElementById('loc-search-btn');

    try {
      // Resolve address
      const response = await fetch(NOMINATIM_URL.replace('{lat}', lat).replace('{lon}', lng));
      const data = await response.json();
      if (data && data.address) {
        const a = data.address;
        const main = a.road || a.neighbourhood || a.suburb || a.residential || a.city_district || '';
        const city = a.city || a.town || a.village || a.state_district || '';
        const displayAddress = main && city ? `${main}, ${city}` : (data.display_name.split(',').slice(0, 3).join(', ') || "Current Location");

        if (input) {
          input.value = displayAddress;
          input.setAttribute('data-auto-filled', 'true');
          input.setAttribute('data-lat', lat);
          input.setAttribute('data-lng', lng);
        }
        if (sBtn) {
          sBtn.style.display = 'flex';
          sBtn.style.animation = 'fadeIn 0.3s ease-out';
        }
        localStorage.setItem(LOCATION_OVERLAY_KEY, 'true');
      }
    } catch (err) {
      console.error("Address resolution failed:", err);
    } finally {
      setInputLoading(false);
    }
  }

  // 1. FAST ATTEMPT: Get current position immediately
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      bestCoords = { latitude, longitude, accuracy };
      // If accuracy is good enough, complete immediately
      if (accuracy < 150) complete(latitude, longitude);
    },
    (err) => console.warn("Initial getCurrentPosition failed", err),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );

  // 2. REFINEMENT ATTEMPT: Watch for better accuracy
  window.activeWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (typeof updateUserLocation === 'function') {
        updateUserLocation(latitude, longitude, accuracy);
      }
      if (!bestCoords || accuracy < bestCoords.accuracy) {
        bestCoords = { latitude, longitude, accuracy };
      }
      if (accuracy < 80) complete(latitude, longitude); // Perfect lock
    },
    (err) => {
       console.error("WatchPosition error:", err);
       // Only fail if we don't have ANY bestCoords yet
       if (!bestCoords) {
         complete(null, null);
         const locOverlay = document.getElementById('location-overlay');
         if (locOverlay) locOverlay.classList.remove('hidden');
       }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  // 3. SAFETY TIMEOUT: Always close the overlay after 4 seconds
  window.activeLockTimeout = setTimeout(() => {
    if (!detected) {
      if (bestCoords) {
        complete(bestCoords.latitude, bestCoords.longitude);
      } else {
        complete(null, null); // Hide overlay even if no location found
      }
    }
  }, 4000);
}

function hideFetchingOverlay() {
  const overlay = document.getElementById('fetching-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function cancelLocationFetch() {
  if (window.activeWatcher) navigator.geolocation.clearWatch(window.activeWatcher);
  if (window.activeLockTimeout) clearTimeout(window.activeLockTimeout);
  hideFetchingOverlay();
  setInputLoading(false);
}

function closeLocationOverlay() {
  const overlay = document.getElementById('location-overlay');
  if (overlay) overlay.classList.add('hidden');
  setInputLoading(false);
}

function initSearchEnhancements() {
  const input = document.getElementById('loc-search-input');
  const btn = document.getElementById('loc-search-btn');
  const suggestionsBox = document.getElementById('search-suggestions');
  let searchTimeout;
  let suggestionTimeout;

  if (!input || !btn || !suggestionsBox) return;

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    btn.style.display = 'none';
    clearTimeout(searchTimeout);
    if (query.length > 2) {
      searchTimeout = setTimeout(() => {
        btn.style.display = 'flex';
        btn.style.animation = 'fadeIn 0.3s ease-out';
      }, 200);
    }

    clearTimeout(suggestionTimeout);
    if (query.length > 2) {
      suggestionTimeout = setTimeout(async () => {
        try {
          let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&countrycodes=in`;
          if (window.currentUserLat && window.currentUserLng) {
            url += `&lat=${window.currentUserLat}&lon=${window.currentUserLng}`;
          }
          const res = await fetch(url);
          const data = await res.json();
          renderSuggestions(data);
        } catch (err) {
          console.warn("Suggestions fetch failed:", err);
        }
      }, 200);
    } else {
      suggestionsBox.classList.remove('active');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchLocation(e);
      suggestionsBox.classList.remove('active');
    }
  });

  function renderSuggestions(data) {
    if (!data || data.length === 0) {
      suggestionsBox.classList.remove('active');
      return;
    }

    suggestionsBox.innerHTML = data.map(item => {
      const name = item.display_name.split(',')[0];
      const sub = item.display_name.split(',').slice(1, 3).join(',');
      const safeName = item.display_name.replace(/'/g, "\\'");
      return `
        <div class="suggestion-item" onclick="selectSuggestion('${safeName}', ${item.lat}, ${item.lon})">
          <div class="suggestion-icon">📍</div>
          <div class="suggestion-content">
            <div style="font-weight:700; color:#fff; font-size:14px;">${name}</div>
            <div style="font-size:11px; opacity:0.6;">${sub}</div>
          </div>
        </div>
      `;
    }).join('');
    suggestionsBox.classList.add('active');
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.remove('active');
    }
  });
}

function selectSuggestion(name, lat, lon) {
  const input = document.getElementById('loc-search-input');
  const suggestionsBox = document.getElementById('search-suggestions');
  if (input) {
    input.value = name;
    input.setAttribute('data-lat', lat);
    input.setAttribute('data-lng', lon);
  }
  if (suggestionsBox) suggestionsBox.classList.remove('active');
  handleSearchLocation(null, lat, lon);
  const btn = document.getElementById('loc-search-btn');
  if (btn) btn.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  initSearchEnhancements();
  if (typeof initMap === 'function') initMap();
});

// Expose globals
window.selectSuggestion = selectSuggestion;
window.handleLocationEnable = handleLocationEnable;
window.closeLocationOverlay = closeLocationOverlay;
window.cancelLocationFetch = cancelLocationFetch;
window.toggleTab = toggleTab;
window.switchView = switchView;
