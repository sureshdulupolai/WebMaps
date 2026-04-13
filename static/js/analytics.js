/**
 * WebMaps — Analytics Tracker
 * Stores events locally in sessionStorage.
 * Flushes to server every 5 minutes and on tab/browser close.
 */

(function () {
  'use strict';

  const SESSION_KEY = 'wm_analytics_events';
  const SESSION_ID_KEY = 'wm_session_id';
  const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const TRACK_URL = '/api/analytics/track/';

  // ─── Session ID ─────────────────────────────────
  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = 'sess_' + Math.random().toString(36).substr(2, 16) + '_' + Date.now();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  }

  // ─── Event Queue ────────────────────────────────
  function getQueue() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(queue.slice(-200)));
    } catch (e) {
      console.warn('Analytics storage error:', e);
    }
  }

  function addEvent(listingSlug, type, value = 1) {
    if (!listingSlug) return;
    const queue = getQueue();
    queue.push({ listing_slug: listingSlug, type, value, ts: Date.now() });
    saveQueue(queue);
  }

  // ─── Flush to Server ────────────────────────────
  function flush(useBeacon = false) {
    const queue = getQueue();
    if (queue.length === 0) return;

    const payload = JSON.stringify({
      session_id: getSessionId(),
      events: queue,
    });

    if (useBeacon && navigator.sendBeacon) {
      // Used on page close — works even if page is unloading
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(TRACK_URL, blob);
    } else {
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {}); // Silently fail
    }

    // Clear queue after flush
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ─── Auto-flush every 5 minutes ─────────────────
  setInterval(() => flush(false), FLUSH_INTERVAL_MS);

  // ─── Flush on page hide (tab close / navigate away) ─
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush(true); // Use sendBeacon
    }
  });

  // Fallback for older browsers
  window.addEventListener('beforeunload', () => flush(true));

  // ─── Page View Tracking ─────────────────────────
  const listingSlug = document.body.dataset.listingSlug;

  if (listingSlug) {
    addEvent(listingSlug, 'view');

    // Track time spent
    const startTime = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed > 0) {
          addEvent(listingSlug, 'time_spent', elapsed);
        }
      }
    });

    // Track click on "Visit Website"
    document.querySelectorAll('[data-track-click]').forEach(el => {
      el.addEventListener('click', () => {
        addEvent(listingSlug, 'click');
      });
    });

    // Track map open
    document.querySelectorAll('[data-track-map]').forEach(el => {
      el.addEventListener('click', () => {
        addEvent(listingSlug, 'map_open');
      });
    });
  }

  // ─── Public API ─────────────────────────────────
  window.WMTracker = {
    trackClick: (slug) => addEvent(slug, 'click'),
    trackView: (slug) => addEvent(slug, 'view'),
    trackMapOpen: (slug) => addEvent(slug, 'map_open'),
    trackTimeSpent: (slug, seconds) => addEvent(slug, 'time_spent', seconds),
    flush,
  };

})();
