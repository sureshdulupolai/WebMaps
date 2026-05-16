/* Business Entity Registry — Listings Logic */

async function handleDelete(slug, name) {
    if (window.systemModal) {
        const confirmed = await window.systemModal.show({
            title: 'CRITICAL: PURGE ENTITY',
            message: `You are about to permanently remove "${name}" from the commercial registry.`,
            rationale: 'THIS ACTION BYPASSES THE ARCHIVE AND CANNOT BE REVERSED.',
            verifyPhrase: 'delete',
            confirmText: 'PURGE REGISTRY ENTRY',
            confirmClass: 'btn-danger'
        });
        
        if (confirmed) {
            const form = document.getElementById(`delete-form-${slug}`);
            if (form) form.submit();
        }
    } else {
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
            const form = document.getElementById(`delete-form-${slug}`);
            if (form) form.submit();
        }
    }
}
