/**
 * WebMaps — OpenStreetMap / Leaflet Integration
 * Handles: map initialization, search, route rendering, listing markers, and UI enhancements
 */

let map;
let markers = [];
let routeLayer;

// Initialize Leaflet map
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // Default: Mumbai
  map = L.map('map', {
    zoomControl: false // we can add it custom if needed
  }).setView([19.076, 72.877], 12);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Set OSM free tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Try geolocation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        // We do NOT call revealMap() here anymore, map stays hidden behind overlay
      },
      () => {},
      { timeout: 5000 }
    );
  }
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
async function handleSearchLocation(e) {
  e.preventDefault();
  const query = document.getElementById('loc-search-input').value.trim();
  if (!query) return;

  const category = document.getElementById('loc-filter-category') ? document.getElementById('loc-filter-category').value : '';
  const rating = document.getElementById('loc-filter-rating') ? document.getElementById('loc-filter-rating').value : '';
  const distance = document.getElementById('loc-filter-distance') ? document.getElementById('loc-filter-distance').value : '';
  const price = document.getElementById('loc-filter-price') ? document.getElementById('loc-filter-price').value : '';

  hideMapNotice();
  setLoading('loc-search-btn', true);
  clearMarkers();

  try {
    const qs = new URLSearchParams({
      q: query, category, rating, distance, price
    }).toString();

    const res = await fetch(`/api/maps/search/?${qs}`);
    const data = await res.json();

    if (data.error) {
      Modal.error(data.error, 'Search Failed');
      setLoading('loc-search-btn', false);
      return;
    }

    if (data.start) {
      map.setView([data.start.lat, data.start.lng], 13);
      revealMap();
    }

    data.listings.forEach(listing => addMarker(listing.lat, listing.lng, listing));
    setResultsPanel(data.listings);
    setLoading('loc-search-btn', false);
  } catch (err) {
    console.error(err);
    setLoading('loc-search-btn', false);
    Modal.error('Search failed. Please try again.', 'Error');
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

  const iconUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300d4ff" width="24px" stroke="%23ffffff" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  
  const customIcon = L.icon({
    iconUrl: iconUrl,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
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

  if (listings.length === 0) {
    panel.innerHTML = ''; // Keep sidebar clean
    showMapNotice('No Results Found', "We couldn't find any listings matching your search. Try adjusting your filters or area.");
    return;
  }

  hideMapNotice();
  panel.innerHTML = listings.map(l => `
    <a href="${l.detail_url}" class="listing-card" style="display:block;text-decoration:none;margin-bottom:12px;background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05)">
      <h3 style="margin:0 0 6px 0;color:var(--text);font-size:1.1rem">${l.company_name}</h3>
      <p style="margin:0 0 8px 0;color:var(--text-muted);font-size:0.85rem">${l.short_description}</p>
      <div style="font-size:0.75rem;color:#00d4ff">📍 ${l.distance_km} km</div>
    </a>
  `).join('');
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
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = 'Wait...';
    btn.disabled = true;
    
    if (resultsPanel) {
      resultsPanel.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line title"></div><div class="skeleton-line text"></div><div class="skeleton-line short"></div></div>
      `;
    }
  } else {
    btn.innerHTML = btn.dataset.original || 'Search';
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
