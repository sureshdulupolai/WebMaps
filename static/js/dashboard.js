document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('archive-modal');
    const triggers = document.querySelectorAll('.trigger-archive');
    const closeBtns = document.querySelectorAll('.btn-close-archive');
    const confirmInput = document.getElementById('archive-confirm-input');
    const confirmBtn = document.getElementById('btn-confirm-archive');
    const archiveForm = document.getElementById('archive-form');
    
    const targetName = document.getElementById('archive-target-name');
    const targetStatus = document.getElementById('archive-target-status');

    // 01. OPEN MODAL
    triggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const slug = trigger.dataset.slug;
            const name = trigger.dataset.name;
            const status = trigger.dataset.status;

            targetName.textContent = name;
            targetStatus.textContent = status;
            archiveForm.action = `/hosts/delete/${slug}/`;
            
            // Reset input and button
            confirmInput.value = '';
            confirmBtn.disabled = true;
            confirmBtn.classList.remove('ready');

            modal.style.display = 'flex';
            confirmInput.focus();
        });
    });

    // 02. CLOSE MODAL
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // 03. VERIFICATION LOGIC
    confirmInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        if (value === 'delete') {
            confirmBtn.disabled = false;
            confirmBtn.classList.add('ready');
        } else {
            confirmBtn.disabled = true;
            confirmBtn.classList.remove('ready');
        }
    });
});
