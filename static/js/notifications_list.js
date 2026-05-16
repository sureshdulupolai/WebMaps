let toastTimeout;
let isCopying = false;

function showToast(message) {
  const container = document.getElementById('activity-toast-container');
  
  // Clear existing toasts to prevent flooding
  container.innerHTML = '';
  if (toastTimeout) clearTimeout(toastTimeout);

  const toast = document.createElement('div');
  toast.className = 'toast-notif';
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.9)';
    toast.style.transition = 'all 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function copyToClipboard(text) {
  if (isCopying) return; // Prevent multiple clicks
  
  isCopying = true;
  // Add visual block class to the cards
  document.querySelectorAll('.coupon-left-section').forEach(el => el.classList.add('copy-disabled'));

  navigator.clipboard.writeText(text).then(() => {
      showToast('Coupon code copied!');
      
      // Unlock after 2 seconds
      setTimeout(() => {
        isCopying = false;
        document.querySelectorAll('.coupon-left-section').forEach(el => el.classList.remove('copy-disabled'));
      }, 2000);
  }).catch(err => {
      console.error('Failed to copy: ', err);
      isCopying = false;
      document.querySelectorAll('.coupon-left-section').forEach(el => el.classList.remove('copy-disabled'));
  });
}

async function markAsRead(id) {
  try {
    const response = await fetch(`/notifications/mark-read/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': window.csrfToken }
    });
    if (response.ok) {
      const item = document.getElementById(`notif-${id}`);
      item.classList.remove('unread');
      const readBtn = item.querySelector('.action-pill:not(.danger)');
      if (readBtn) readBtn.remove();
      if (window.fetchNotifications) window.fetchNotifications();
    }
  } catch (err) { console.error(err); }
}

async function deleteNotification(id) {
  const confirmed = await Modal.confirm('Dismiss this activity from your timeline?', 'Dismiss Alert');
  if (!confirmed) return;

  try {
    const response = await fetch(`/notifications/delete/${id}/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': window.csrfToken }
    });
    if (response.ok) {
      const item = document.getElementById(`notif-${id}`);
      item.style.opacity = '0';
      item.style.transform = 'scale(0.9)';
      setTimeout(() => {
          item.remove();
          if (document.querySelectorAll('.timeline-item').length === 0) location.reload();
      }, 300);
      if (window.fetchNotifications) window.fetchNotifications();
    }
  } catch (err) { console.error(err); }
}
