/* Business Details — Listing Detail Logic */

async function handleDeleteBusiness(slug) {
    if (window.systemModal) {
        const confirmed = await window.systemModal.show({
            title: 'CRITICAL: DELETE BUSINESS',
            message: 'You are about to permanently remove this business and all its associated data.',
            rationale: 'THIS ACTION IS IRREVERSIBLE. YOU CANNOT UNDO THIS.',
            verifyPhrase: 'delete',
            confirmText: 'DELETE PERMANENTLY',
            confirmClass: 'btn-danger-glow'
        });
        
        if (confirmed) {
            const form = document.getElementById(`delete-form-${slug}`);
            if (form) form.submit();
        }
    } else {
        if (confirm('Are you sure you want to permanently delete this business?')) {
            const form = document.getElementById(`delete-form-${slug}`);
            if (form) form.submit();
        }
    }
}

function toggleRejectForm() {
    const form = document.getElementById('reject-form');
    if (form) {
        form.classList.toggle('d-none');
    }
}
