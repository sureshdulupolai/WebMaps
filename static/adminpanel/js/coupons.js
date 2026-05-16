/* Promotions & Coupons — Logic */

document.addEventListener('DOMContentLoaded', () => {
    // ─── DROPDOWN COMPONENT ───
    function initDropdown(id, hiddenId, onSelect = null) {
        const container = document.getElementById(id);
        if (!container) return;
        const trigger = container.querySelector('.dropdown-trigger');
        const menu = container.querySelector('.dropdown-menu');
        const hidden = document.getElementById(hiddenId);
        const selectedText = container.querySelector('.selected-text');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        });

        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const val = item.getAttribute('data-value');
                const name = item.getAttribute('data-name');
                hidden.value = val;
                selectedText.textContent = item.textContent.trim();
                menu.classList.remove('show');
                if (onSelect) onSelect(val, name);
                updatePreview();
            });
        });
    }

    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    });

    // ─── CONDITIONAL LOGIC ───
    const grads = {
        all: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        specific: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)',
        hidden: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)'
    };

    // Toggle Threshold Field
    function toggleThreshold(val) {
        const threshold = document.getElementById('threshold-container');
        if (threshold) {
            if (val === 'fixed') {
                threshold.classList.remove('hidden-field');
            } else {
                threshold.classList.add('hidden-field');
            }
        }
    }

    // Toggle User Selector Field
    function toggleUserSelector(val) {
        const sel = document.getElementById('user-selector-container');
        const card = document.getElementById('preview-bank-card');
        if (card) card.style.background = grads[val];

        if (sel) {
            if (val === 'specific' || val === 'hidden') {
                sel.classList.remove('hidden-field');
            } else {
                sel.classList.add('hidden-field');
                const hiddenUser = document.getElementById('hidden-user');
                if (hiddenUser) hiddenUser.value = '';
                const selectedUserName = document.getElementById('selected-user-name');
                if (selectedUserName) selectedUserName.textContent = '-- Select User Account --';
                const previewUserText = document.getElementById('preview-user-text');
                if (previewUserText) previewUserText.textContent = 'PUBLIC ACCESS';
            }
        }
    }

    // Initialize Dropdowns
    initDropdown('dropdown-type', 'hidden-type', toggleThreshold);
    initDropdown('dropdown-target', 'hidden-target', toggleUserSelector);
    initDropdown('dropdown-user', 'hidden-user', (val, name) => {
        const previewUserText = document.getElementById('preview-user-text');
        if (previewUserText) previewUserText.textContent = name || 'PUBLIC ACCESS';
    });

    // ─── GEN LOGIC ───
    const btnGenerate = document.getElementById('btn-generate');
    const inputCode = document.getElementById('input-code');

    if (btnGenerate && inputCode) {
        btnGenerate.addEventListener('click', () => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 12; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
            inputCode.value = code;
            updatePreview();
        });
    }

    // ─── PREVIEW SYNC ───
    const inputValue = document.getElementById('input-value');
    const previewCodeText = document.getElementById('preview-code-text');
    const previewValueText = document.getElementById('preview-value-text');

    function updatePreview() {
        if (previewCodeText && inputCode) {
            previewCodeText.textContent = inputCode.value.toUpperCase() || 'WEBMAPS-GLOBAL';
        }
        if (previewValueText) {
            const hiddenType = document.getElementById('hidden-type');
            const type = hiddenType ? hiddenType.value : 'percentage';
            const val = (inputValue && inputValue.value) ? inputValue.value : '10';
            previewValueText.textContent = type === 'percentage' ? `${val}% OFF` : `₹${val} OFF`;
        }
    }

    if (inputCode) inputCode.addEventListener('input', updatePreview);
    if (inputValue) inputValue.addEventListener('input', updatePreview);

    // Initial State Sync
    const hiddenType = document.getElementById('hidden-type');
    if (hiddenType) toggleThreshold(hiddenType.value);
    
    const hiddenTarget = document.getElementById('hidden-target');
    if (hiddenTarget) toggleUserSelector(hiddenTarget.value);
    
    updatePreview();
});
