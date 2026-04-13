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
  const notifMarkReadBtn = document.getElementById('notif-mark-read');
  const notifBadge = document.getElementById('notif-badge');

  if (notifMarkReadBtn) {
    notifMarkReadBtn.addEventListener('click', () => {
      const csrfElement = document.querySelector('[name=csrfmiddlewaretoken]');
      const csrfToken = csrfElement ? csrfElement.value : '';

      fetch('/notifications/mark-read/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken
        }
      }).then(() => {
        if (notifBadge) {
          notifBadge.classList.add('d-none');
        }
      }).catch(err => console.error("Failed to mark notifications read", err));
    });
  }
});
