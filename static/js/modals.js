/**
 * WebMaps — Custom Modal System
 * Replaces browser's window.alert(), window.confirm(), window.prompt()
 */

class WebMapsModal {
  constructor() {
    this._overlay = null;
    this._resolveCallback = null;
    this._init();
  }

  _init() {
    const div = document.createElement('div');
    div.id = 'wm-modal-overlay';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-icon" id="wm-modal-icon"></div>
        <div class="modal-title" id="wm-modal-title"></div>
        <div class="modal-message" id="wm-modal-message"></div>
        <div class="modal-actions" id="wm-modal-actions"></div>
      </div>
    `;
    document.body.appendChild(div);
    this._overlay = div;

    // Close on overlay click
    div.addEventListener('click', (e) => {
      if (e.target === div) this._close(null);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._overlay.classList.contains('active')) {
        this._close(null);
      }
    });
  }

  _open(type, title, message, buttons) {
    return new Promise((resolve) => {
      this._resolveCallback = resolve;

      const iconMap = {
        success: { ico: '✓', cls: 'success' },
        error:   { ico: '✗', cls: 'error' },
        warning: { ico: '⚠', cls: 'warning' },
        info:    { ico: 'ℹ', cls: 'info' },
        confirm: { ico: '?', cls: 'warning' },
      };

      const { ico, cls } = iconMap[type] || iconMap.info;

      document.getElementById('wm-modal-icon').innerHTML = ico;
      document.getElementById('wm-modal-icon').className = `modal-icon ${cls}`;
      document.getElementById('wm-modal-title').textContent = title;
      document.getElementById('wm-modal-message').textContent = message;

      const actionsEl = document.getElementById('wm-modal-actions');
      actionsEl.innerHTML = '';

      buttons.forEach(({ label, value, variant }) => {
        const btn = document.createElement('button');
        btn.className = `btn btn-${variant || 'outline'}`;
        btn.textContent = label;
        btn.addEventListener('click', () => this._close(value));
        actionsEl.appendChild(btn);
      });

      this._overlay.classList.add('active');
    });
  }

  _close(value) {
    this._overlay.classList.remove('active');
    if (this._resolveCallback) {
      this._resolveCallback(value);
      this._resolveCallback = null;
    }
  }

  alert(message, title = 'Notice', type = 'info') {
    return this._open(type, title, message, [
      { label: 'OK', value: true, variant: 'primary' }
    ]);
  }

  success(message, title = 'Success') {
    return this._open('success', title, message, [
      { label: 'Continue', value: true, variant: 'success' }
    ]);
  }

  error(message, title = 'Error') {
    return this._open('error', title, message, [
      { label: 'OK', value: false, variant: 'danger' }
    ]);
  }

  warning(message, title = 'Warning') {
    return this._open('warning', title, message, [
      { label: 'OK', value: true, variant: 'primary' }
    ]);
  }

  confirm(message, title = 'Are you sure?') {
    return this._open('confirm', title, message, [
      { label: 'Cancel', value: false, variant: 'outline' },
      { label: 'Confirm', value: true, variant: 'danger' }
    ]);
  }
}

// Global instance
const Modal = new WebMapsModal();
window.Modal = Modal;

// ─── CSRF HELPER ─────────────────────────────────────
function getCsrf() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

window.getCsrf = getCsrf;
