/**
 * WebMaps — OpenStreetMap / Leaflet Integration
 * Handles: map initialization, search, route rendering, listing markers, and UI enhancements
 */

let map;
let markers = [];
let routeLayer;
let userMarker;
let userAccuracyCircle;
let currentListings = []; // Global store for client-side filtering


// Initialize Leaflet map
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Default: Focused on India for a professional starting view
  map = L.map('map', {
    zoomControl: false 
  }).setView([20.5937, 78.9629], 5);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Set OSM free tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Reveal map immediately
  revealMap();

  // Load all available listings on start for a professional experience
  loadInitialListings();

  // Handle map clicks for location selection
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;
    if (typeof window.handleMapClick === 'function') {
      window.handleMapClick(lat, lng);
    }
  });

}

function revealMap() {
  const emptyState = document.getElementById('map-empty-state');
  const mapEl = document.getElementById('map');
  if (emptyState) {
    emptyState.classList.add('hidden');
  }
  if (mapEl) {
    mapEl.classList.add('map-loaded');
    // Critical: ensure leaflet knows the container changed size
    setTimeout(() => {
      map.invalidateSize({ animate: true });
    }, 200);
  }
}

// ─── SEARCH HANDLERS ─────────────────────────────────

// Location Search Handler
async function handleSearchLocation(e, lat = null, lng = null) {
  if (e) e.preventDefault();
  const input = document.getElementById('loc-search-input');
  const query = input.value.trim();
  
  // Use coordinates from suggestions if available
  const suggestLat = input.getAttribute('data-lat');
  const suggestLng = input.getAttribute('data-lng');
  
  if (!lat && suggestLat) lat = suggestLat;
  if (!lng && suggestLng) lng = suggestLng;

  if (!query && !lat) return;

  const category = document.getElementById('loc-filter-category') ? document.getElementById('loc-filter-category').value : 'All';
  const rating = document.getElementById('loc-filter-rating') ? document.getElementById('loc-filter-rating').value : '';
  const distance = document.getElementById('loc-filter-distance') ? document.getElementById('loc-filter-distance').value : '10';
  const price = document.getElementById('loc-filter-price') ? document.getElementById('loc-filter-price').value : '';

  hideMapNotice();
  setLoading('loc-search-btn', true);
  clearMarkers();

  try {
    const params = { q: query, category, rating, distance, price };
    if (lat && lng) {
      params.lat = lat;
      params.lng = lng;
    }
    const qs = new URLSearchParams(params).toString();

    const res = await fetch(`/api/maps/search/?${qs}`);
    const data = await res.json();

    if (data.error) {
      // Clear data attributes so next search is fresh
      input.removeAttribute('data-lat');
      input.removeAttribute('data-lng');
      
      if (e) Modal.error(data.error, 'Search Failed');
      setLoading('loc-search-btn', false);
      return;
    }

    if (data.start) {
      map.setView([data.start.lat, data.start.lng], 16);
      
      const redPinSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4d4d" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1"/></svg>`;
      
      const redIcon = L.icon({
        iconUrl: redPinSvg,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -32],
        shadowUrl: ''
      });

      const searchMarker = L.marker([data.start.lat, data.start.lng], {
        icon: redIcon,
        zIndexOffset: 500
      }).addTo(map).bindPopup('<b>Searched Location</b><br>' + query);
      markers.push(searchMarker);
      
      revealMap();
    }

    data.listings.forEach(listing => addMarker(listing.lat, listing.lng, listing));
    currentListings = data.listings; // Store globally
    setResultsPanel(data.listings);
    setLoading('loc-search-btn', false);
  } catch (err) {
    console.error(err);
    setLoading('loc-search-btn', false);
    if (e) Modal.error('Search failed. Please try again.', 'Error');
  }
}


// Route Search Handler
async function handleSearchRoute(e) {
  e.preventDefault();
  const startQuery = document.getElementById('route-from').value.trim();
  const endQuery = document.getElementById('route-to').value.trim();
  if (!startQuery || !endQuery) return;

  const category = document.getElementById('route-filter-category') ? document.getElementById('route-filter-category').value : '';
  const distance = document.getElementById('route-filter-distance') ? document.getElementById('route-filter-distance').value : '';

  hideMapNotice();
  setLoading('route-search-btn', true);
  clearMarkers();

  try {
    const qs = new URLSearchParams({
      from: startQuery, to: endQuery, category, distance
    }).toString();

    const res = await fetch(`/api/maps/route/?${qs}`);
    const data = await res.json();

    if (data.error) {
      Modal.error(data.error, 'Routing Failed');
      setLoading('route-search-btn', false);
      return;
    }

    if (data.start && data.end) {
      drawRoute(data.start.lat, data.start.lng, data.end.lat, data.end.lng);
      revealMap();
    }

    data.listings.forEach(listing => addMarker(listing.lat, listing.lng, listing));
    currentListings = data.listings; // Store globally
    setResultsPanel(data.listings);
    setLoading('route-search-btn', false);
  } catch (err) {
    console.error(err);
    setLoading('route-search-btn', false);
    Modal.error('Route search failed. Please try again.', 'Error');
  }
}

// ─── ROUTE DRAWING (OSRM) ────────────────────────────
async function drawRoute(start_lat, start_lng, end_lat, end_lng) {
  if (routeLayer) {
    map.removeLayer(routeLayer);
  }

  // OSRM requires coords in [longitude, latitude] form
  const url = `https://router.project-osrm.org/route/v1/driving/${start_lng},${start_lat};${end_lng},${end_lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes.length > 0) {
      const geojsonRoute = data.routes[0].geometry;
      routeLayer = L.geoJSON(geojsonRoute, {
        style: { color: '#6c63ff', weight: 5, opacity: 0.8 }
      }).addTo(map);

      // Add Start/End pins
      const startIcon = L.divIcon({ className: 'custom-icon', html: '🔵', iconSize: [20, 20] });
      const endIcon = L.divIcon({ className: 'custom-icon', html: '🔴', iconSize: [20, 20] });
      
      const startMarker = L.marker([start_lat, start_lng], { icon: startIcon }).addTo(map).bindPopup('Start');
      const endMarker = L.marker([end_lat, end_lng], { icon: endIcon }).addTo(map).bindPopup('End');
      markers.push(startMarker, endMarker);

      map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
    }
  } catch(e) {
    console.error("OSRM Route Error: ", e);
  }
}

// ─── LISTING MARKERS ─────────────────────────────────
function addMarker(lat, lng, titleOrListing) {
  // Can pass title string or listing object for detailed popup
  const isListing = typeof titleOrListing === 'object';
  const title = isListing ? titleOrListing.company_name : titleOrListing;

  // Professional Blue Pin SVG (Matches Listing Page style but SVG for robustness)
  const bluePinSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233b82f6" width="32" height="32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1"/></svg>`;
  
  const customIcon = L.icon({
    iconUrl: bluePinSvg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
    shadowUrl: ''
  });



  const marker = L.marker([lat, lng], { title: title, icon: customIcon }).addTo(map);

  if (isListing) {
    const popupContent = `
      <div class="custom-popup-content">
        <h4 class="popup-title">${titleOrListing.company_name}</h4>
        <p class="popup-desc">${titleOrListing.short_description}</p>
        <div class="popup-footer">
          <span class="popup-distance">📍 ${titleOrListing.distance_km} km</span>
          <a href="${titleOrListing.detail_url}" class="popup-link">Inspect</a>
        </div>
      </div>
    `;
    marker.bindPopup(popupContent, { maxWidth: 280, className: 'premium-popup' });
    marker.on('click', () => {
      if (typeof WMTracker !== 'undefined') WMTracker.trackClick(titleOrListing.slug);
    });
  } else {
    marker.bindPopup(`<div class="p-2 font-bold">${title}</div>`);
  }

  markers.push(marker);
}

// ─── RESULTS PANEL ───────────────────────────────────
function setResultsPanel(listings) {
  const panel = document.getElementById('results-panel');
  if (!panel) return;

  if (!listings || listings.length === 0) {
    panel.innerHTML = `
      <div class="product-empty-state">
        <div class="product-empty-icon">📂</div>
        <h3 class="product-empty-title">No Listings Found</h3>
        <p class="product-empty-text">We couldn't find any data matching your current filters or location. Try adjusting your search criteria.</p>
      </div>
    `;
    return;
  }

  hideMapNotice();
  panel.innerHTML = listings.map(l => `
    <a href="${l.detail_url}" class="listing-card" style="display:flex; flex-direction:column; text-decoration:none; background:rgba(255,255,255,0.03); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); transition:all 0.3s ease;">
      <h3 style="margin:0 0 8px 0; color:var(--text); font-size:1.15rem; font-weight:700;">${l.company_name}</h3>
      <p style="margin:0 0 12px 0; color:var(--text-muted); font-size:0.9rem; line-height:1.4; flex-grow:1;">${l.short_description}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
        <span style="font-size:0.8rem; color:#00d4ff; font-weight:600;">📍 ${l.distance_km} km</span>
        <span style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; color:white;">View Details</span>
      </div>
    </a>
  `).join('');
}

/**
 * Client-side filtering for the Product View
 */
function applyProductFilters() {
  const queryInput = document.getElementById('prod-filter-search');
  const query = queryInput.value.toLowerCase().trim();
  const category = document.getElementById('prod-filter-category').value;
  const clearBtn = document.getElementById('prod-search-clear');

  if (clearBtn) {
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
  }

  const filtered = currentListings.filter(l => {
    const matchesQuery = !query || 
           (l.company_name || '').toLowerCase().includes(query) || 
           (l.short_description || '').toLowerCase().includes(query) || 
           (l.category_name || '').toLowerCase().includes(query) ||
           (l.services || []).join(' ').toLowerCase().includes(query);
    
    const matchesCategory = category === 'All' || l.category_name === category;

    return matchesQuery && matchesCategory;
  });

  renderProductResults(filtered);
}

function renderProductResults(listings) {
  const panel = document.getElementById('results-panel');
  if (!panel) return;

  if (listings.length === 0) {
    panel.innerHTML = `
      <div class="product-empty-state">
        <div class="product-empty-icon">🔍</div>
        <h3 class="product-empty-title">No Matches Found</h3>
        <p class="product-empty-text">Your filters are too restrictive. Try searching for something else or clearing the inputs.</p>
      </div>
    `;
    return;
  }

  const truncate = (str, n) => {
    if (!str) return '';
    return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
  };

  panel.innerHTML = listings.map(l => `
    <a href="${l.detail_url}" class="listing-card-premium" style="text-decoration:none;">
      <div class="card-content">
        <div class="card-main">
          <h3 class="card-title">${truncate(l.company_name, 20)}</h3>
          <p class="card-desc">${truncate(l.short_description || 'No description available.', 85)}</p>
        </div>
        <div class="card-footer">
          <div class="card-rating-footer" title="${l.average_rating} stars">
            <span class="rating-stars">${renderStars(l.average_rating)}</span>
          </div>
        </div>
      </div>
    </a>
  `).join('');
}

function renderSkeleton() {
  const panel = document.getElementById('results-panel');
  if (!panel) return;
  panel.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card-premium">
      <div class="skeleton-main">
        <div class="skeleton-title"></div>
        <div class="skeleton-desc"></div>
        <div class="skeleton-desc" style="width: 60%"></div>
      </div>
      <div class="skeleton-footer">
        <div class="skeleton-tag"></div>
        <div class="skeleton-circle"></div>
      </div>
    </div>
  `).join('');
}

function clearProductSearch() {
  const input = document.getElementById('prod-filter-search');
  if (input) {
    input.value = '';
    applyProductFilters();
  }
}

function showMapNotice(title, message) {
  const notice = document.getElementById('map-notice');
  if (!notice) return;
  notice.querySelector('h3').textContent = title;
  notice.querySelector('p').textContent = message;
  notice.classList.add('active');
}

function hideMapNotice() {
  const notice = document.getElementById('map-notice');
  if (notice) notice.classList.remove('active');
}

// ─── HELPERS ─────────────────────────────────────────
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

function setLoading(btnId, state) {
  const btn = document.getElementById(btnId);
  const resultsPanel = document.getElementById('results-panel');
  if (!btn) return;
  
  if (state) {
    btn.style.display = 'none';
    btn.disabled = true;
    
    if (resultsPanel) {
      resultsPanel.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
      `;
    }
  } else {
    btn.style.display = '';
    btn.disabled = false;
  }
}

// ─── CUSTOM UI INITIALIZERS ────────────────────────
function initCustomSelects() {
  const selects = document.querySelectorAll('select.form-control, select.form-control-premium');
  selects.forEach(select => {
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    const selectedOption = select.options[select.selectedIndex];
    trigger.textContent = selectedOption ? selectedOption.textContent : 'Select...';
    wrapper.appendChild(trigger);

    const optionsList = document.createElement('ul');
    optionsList.className = 'custom-select-options';
    
    Array.from(select.options).forEach((option, index) => {
      const li = document.createElement('li');
      li.className = 'custom-option' + (option.selected ? ' selected' : '');
      li.textContent = option.textContent;
      li.dataset.value = option.value;
      
      li.addEventListener('click', function(e) {
        e.stopPropagation();
        select.selectedIndex = index;
        trigger.textContent = option.textContent;
        
        wrapper.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
      });
      optionsList.appendChild(li);
    });
    wrapper.appendChild(optionsList);

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });
  });

  document.addEventListener('click', function() {
    document.querySelectorAll('.custom-select-wrapper').forEach(w => {
      w.classList.remove('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', initCustomSelects);

function initDetailMap(lat, lng, companyName) {
  const mapEl = document.getElementById('detail-map');
  if (!mapEl) return;

  const detailMap = L.map('detail-map', { zoomControl: false }).setView([lat, lng], 15);
  L.control.zoom({ position: 'bottomright' }).addTo(detailMap);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(detailMap);

  L.marker([lat, lng]).addTo(detailMap).bindPopup(`<b>${companyName}</b>`).openPopup();
}

/**
 * Updates or creates the user's "Blue Dot" location marker and accuracy circle.
 * High-accuracy real-time positioning.
 */
function updateUserLocation(lat, lng, accuracy) {
  if (!map) return;

  // Store for global access (e.g. search suggestions)
  window.currentUserLat = lat;
  window.currentUserLng = lng;

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: '<div class="user-location-pulse"></div><div class="user-location-dot"></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000, // Always on top
      title: 'Your Location'
    }).addTo(map).bindPopup('You are here');
  }

  // Update accuracy circle
  if (userAccuracyCircle) {
    userAccuracyCircle.setLatLng([lat, lng]);
    userAccuracyCircle.setRadius(accuracy);
  } else {
    userAccuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 1,
      interactive: false
    }).addTo(map);
  }
}

async function loadInitialListings() {
  renderSkeleton();
  try {
    const res = await fetch('/api/maps/all/');
    const data = await res.json();
    if (data.listings) {
      data.listings.forEach(listing => addMarker(listing.lat, listing.lng, listing));
      currentListings = data.listings; // Store for product view
      renderProductResults(data.listings); // Populate product view immediately
    }
  } catch (err) {
    console.warn("Could not load initial listings:", err);
  }
}

window.applyProductFilters = applyProductFilters;

