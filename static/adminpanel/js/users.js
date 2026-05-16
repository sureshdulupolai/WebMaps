/* Identity Control — Users Logic */

let currentDeleteId = null;

function triggerUserDelete(userId, username) {
    currentDeleteId = userId;
    const usernameEl = document.getElementById('target-username');
    const modalEl = document.getElementById('deleteModal');
    const inputEl = document.getElementById('confirm-input');

    if (usernameEl) usernameEl.innerText = username;
    if (modalEl) modalEl.style.display = 'grid';
    if (inputEl) {
        inputEl.value = '';
        validateDeleteInput();
    }
}

function closeDeleteModal() {
    const modalEl = document.getElementById('deleteModal');
    if (modalEl) modalEl.style.display = 'none';
    currentDeleteId = null;
}

function validateDeleteInput() {
    const input = document.getElementById('confirm-input');
    const btn = document.getElementById('confirm-delete-btn');
    if (input && btn) {
        if (input.value === 'DELETE') {
            btn.classList.remove('opacity-50', 'pointer-events-none');
            btn.style.cursor = 'pointer';
        } else {
            btn.classList.add('opacity-50', 'pointer-events-none');
            btn.style.cursor = 'not-allowed';
        }
    }
}

function executeDelete() {
    if (!currentDeleteId) return;
    const form = document.getElementById('global-delete-form');
    if (form) {
        // Construct the URL dynamically based on the current user ID
        form.action = `/adminpanel/users/${currentDeleteId}/delete/`;
        form.submit();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmInput = document.getElementById('confirm-input');
    if (confirmInput) {
        confirmInput.addEventListener('input', validateDeleteInput);
    }
});
