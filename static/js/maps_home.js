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

function clearActiveGeolocation() {
  if (window.activeWatcher) navigator.geolocation.clearWatch(window.activeWatcher);
  if (window.activeLockTimeout) clearTimeout(window.activeLockTimeout);
  window.activeWatcher = null;
  window.activeLockTimeout = null;
}

async function handleLocationEnable() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  // Clear any existing attempts
  clearActiveGeolocation();

  // Reset UI
  // Reset UI states
  const overlay = document.getElementById('fetching-overlay');
  if (overlay) overlay.classList.remove('hidden');

  const fetchingState = document.getElementById('fetching-state');
  const errorState = document.getElementById('error-state');
  if (fetchingState) fetchingState.classList.remove('hidden');
  if (errorState) errorState.classList.add('hidden');

  const accVal = document.getElementById('accuracy-value');
  const accProgress = document.getElementById('accuracy-progress-bar');
  
  if (accVal) accVal.textContent = "Requesting Access...";
  if (accProgress) accProgress.style.width = "5%";

  setInputLoading(true);

  let detected = false;
  let bestCoords = null;

  // Function to finalize and clean up
  window.completeLocationFetch = async function(lat, lng) {
    if (detected) return;
    
    // Stop looking for location, but keep modal open while we resolve the address
    clearActiveGeolocation();

    if (!lat || !lng) {
      detected = true;
      hideFetchingOverlay();
      setInputLoading(false);
      return;
    }

    const input = document.getElementById('loc-search-input');
    const sBtn = document.getElementById('loc-search-btn');

    // 1. Resolve Address FIRST while user still sees "Refining..."
    try {
      const response = await fetch(NOMINATIM_URL.replace('{lat}', lat).replace('{lon}', lng));
      const data = await response.json();
      
      let displayAddress = "Current Location";
      if (data && data.address) {
        const a = data.address;
        const main = a.road || a.neighbourhood || a.suburb || a.residential || a.city_district || '';
        const city = a.city || a.town || a.village || a.state_district || '';
        displayAddress = main && city ? `${main}, ${city}` : (data.display_name.split(',').slice(0, 3).join(', ') || "Current Location");
      }

      // 2. Update Input BEFORE hiding overlay
      if (input) {
        input.value = displayAddress;
        input.setAttribute('data-lat', lat);
        input.setAttribute('data-lng', lng);
        input.setAttribute('data-auto-filled', 'true');
      }
      if (sBtn) {
        sBtn.style.display = 'flex';
      }
      
      localStorage.setItem(LOCATION_OVERLAY_KEY, 'true');
      
      // Trigger search automatically if defined
      if (typeof handleSearchLocation === 'function') {
        handleSearchLocation(null, lat, lng);
      }

    } catch (err) {
      console.warn("Address resolution failed:", err);
      // Fallback if network fails
      if (input) {
        input.value = "Current Location";
        input.setAttribute('data-lat', lat);
        input.setAttribute('data-lng', lng);
      }
    } finally {
      detected = true;
      // If successful, we can hide the whole overlay
      hideFetchingOverlay(); 
      setInputLoading(false);
    }
  };

  function showLocationError(message) {
    const fetchingState = document.getElementById('fetching-state');
    const errorState = document.getElementById('error-state');
    const errorMsg = document.getElementById('location-error-msg');
    
    if (fetchingState) fetchingState.classList.add('hidden');
    if (errorState) errorState.classList.remove('hidden');
    if (errorMsg) errorMsg.textContent = message;
    
    setInputLoading(false);
    clearActiveGeolocation();
  }

  // UI Update Helper
  function updateAccuracyUI(accuracy) {
    if (accVal) accVal.textContent = `${Math.round(accuracy)} meters`;
    
    // Progress calculation: 
    // We want the bar to fill as it gets closer to 40m.
    // Let's use a logarithmic-like scale so it moves even for large numbers but speeds up at the end.
    if (accProgress) {
      let progress = 0;
      if (accuracy > 1000) {
        progress = 5 + (1 - Math.min(1, accuracy / 200000)) * 20; // 5% to 25% for 200km down to 1km
      } else if (accuracy > 100) {
        progress = 25 + (1 - (accuracy - 100) / 900) * 45; // 25% to 70% for 1km down to 100m
      } else {
        progress = 70 + (1 - (accuracy - 40) / 60) * 30; // 70% to 100% for 100m down to 40m
      }
      accProgress.style.width = `${Math.max(5, Math.min(100, progress))}%`;
    }

    // Auto-complete if accuracy is excellent (< 50m)
    if (accuracy < 50 && !detected) {
       window.completeLocationFetch(window.bestCoords.latitude, window.bestCoords.longitude);
    }
  }

  window.bypassTimerSet = false;

  // 1. FAST ATTEMPT
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      window.bestCoords = { latitude, longitude, accuracy };
      updateAccuracyUI(accuracy);
      if (typeof updateUserLocation === 'function') {
        updateUserLocation(latitude, longitude, accuracy);
      }
      // If accuracy is already perfect, complete immediately
      if (accuracy < 40) window.completeLocationFetch(latitude, longitude);
    },
    (err) => console.warn("Initial getCurrentPosition failed", err),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );

  // 2. REFINEMENT ATTEMPT
  window.activeWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      updateAccuracyUI(accuracy);
      if (typeof updateUserLocation === 'function') {
        updateUserLocation(latitude, longitude, accuracy);
      }
      if (!window.bestCoords || accuracy < window.bestCoords.accuracy) {
        window.bestCoords = { latitude, longitude, accuracy };
      }
      // CRITICAL: Only auto-dismiss when accuracy is very high (< 35 meters)
      if (accuracy < 35) window.completeLocationFetch(latitude, longitude);
    },
    (err) => {
      console.error("WatchPosition error:", err);
      if (!window.bestCoords) {
        window.completeLocationFetch(null, null);
        const locOverlay = document.getElementById('location-overlay');
        if (locOverlay) locOverlay.classList.remove('hidden');
      }
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );

  // 3. SAFETY TIMEOUT: Close overlay after 25 seconds if we have a good lock
  window.activeLockTimeout = setTimeout(() => {
    if (!detected) {
      if (window.bestCoords && window.bestCoords.accuracy < 300) {
        // Only use if accuracy is decent (< 300m)
        window.completeLocationFetch(window.bestCoords.latitude, window.bestCoords.longitude);
      } else {
        // If still bad after 25s, show error in card
        showLocationError("GPS Signal is weak. Please move to an open area and try again.");
      }
    }
  }, 25000);
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

function closeMapClickOverlay() {
  const overlay = document.getElementById('confirm-map-click-overlay');
  if (overlay) overlay.classList.add('hidden');
}

window.handleMapClick = async function(lat, lng) {
  const overlay = document.getElementById('confirm-map-click-overlay');
  const addrEl = document.getElementById('map-click-address');
  const confirmBtn = document.getElementById('confirm-map-btn');
  
  if (overlay) overlay.classList.remove('hidden');
  if (addrEl) addrEl.textContent = "Fetching address...";
  
  let displayAddress = "Selected Location";
  
  try {
    const response = await fetch(NOMINATIM_URL.replace('{lat}', lat).replace('{lon}', lng));
    const data = await response.json();
    if (data && data.display_name) {
      const a = data.address;
      const main = a.road || a.neighbourhood || a.suburb || a.residential || a.city_district || '';
      const city = a.city || a.town || a.village || a.state_district || '';
      displayAddress = main && city ? `${main}, ${city}` : (data.display_name.split(',').slice(0, 3).join(', ') || "Selected Location");
    }
  } catch (err) {
    console.warn("Address resolution failed:", err);
  }
  
  if (addrEl) addrEl.textContent = displayAddress;
  
  confirmBtn.onclick = () => {
    const input = document.getElementById('loc-search-input');
    const sBtn = document.getElementById('loc-search-btn');
    if (input) {
      input.value = displayAddress;
      input.setAttribute('data-lat', lat);
      input.setAttribute('data-lng', lng);
      input.setAttribute('data-auto-filled', 'true');
    }
    if (sBtn) sBtn.style.display = 'flex';
    closeMapClickOverlay();
    
    // Optionally trigger search
    if (typeof handleSearchLocation === 'function') {
      handleSearchLocation(null, lat, lng);
    }
  };
};

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
window.closeMapClickOverlay = closeMapClickOverlay;
window.cancelLocationFetch = cancelLocationFetch;
window.toggleTab = toggleTab;
window.switchView = switchView;
