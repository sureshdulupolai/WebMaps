/**
 * main.js - Core UI Interactions and Utilities
 * Validated against WCAG standards.
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- Auto-hide Django Messages (Toasts) ---
  const messages = document.querySelectorAll('.alert');
  if (messages.length > 0) {
    setTimeout(() => {
      messages.forEach(el => {
        el.style.transition = 'opacity 0.4s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
      });
    }, 4000);
  }

  // --- Theme Toggle Logic ---
  const themeBtn = document.getElementById('theme-toggle');
  const moonIcon = document.getElementById('theme-icon-moon');
  const sunIcon = document.getElementById('theme-icon-sun');

  if (themeBtn && moonIcon && sunIcon) {
    // Sync init state
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (currentTheme === 'light') {
      moonIcon.classList.remove('d-none');
      sunIcon.classList.add('d-none');
    } else {
      moonIcon.classList.add('d-none');
      sunIcon.classList.remove('d-none');
    }

    // Toggle handler
    themeBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('wm-theme', 'dark');
        moonIcon.classList.add('d-none');
        sunIcon.classList.remove('d-none');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('wm-theme', 'light');
        moonIcon.classList.remove('d-none');
        sunIcon.classList.add('d-none');
      }
    });

    // Keyboard accessibility for theme toggle
    themeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        themeBtn.click();
      }
    });
  }

  // --- Notification System ---
  const notifBell = document.getElementById('notif-bell');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifBadge = document.getElementById('notif-badge');
  const notifList = document.getElementById('notif-list');
  const notifMarkReadBtn = document.getElementById('notif-mark-read');

  async function fetchNotifications() {
    try {
      const response = await fetch('/notifications/list/');
      if (!response.ok) return;
      const data = await response.json();
      
      if (notifBadge) {
        if (data.unread_count > 0) {
          notifBadge.textContent = data.unread_count;
          notifBadge.classList.remove('d-none');
        } else {
          notifBadge.classList.add('d-none');
        }
      }

      if (notifList) {
        if (data.notifications.length === 0) {
          notifList.innerHTML = '<div class="notif-empty">No notifications</div>';
        } else {
          notifList.innerHTML = data.notifications.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}">
              <div class="notif-message">${n.message}</div>
              <div class="notif-time">${n.created_at}</div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }

  // Make it global for sub-pages
  window.fetchNotifications = fetchNotifications;

  // Initial fetch
  if (notifBell) fetchNotifications();
});
