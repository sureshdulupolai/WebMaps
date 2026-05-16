/* Diagnostic Center — Errors Logic */

document.addEventListener('DOMContentLoaded', () => {
    // Calculate unique signatures
    const rows = document.querySelectorAll('.diag-row');
    const uniqueSet = new Set();
    rows.forEach(r => {
        const path = r.querySelector('.diag-path').innerText;
        const type = r.querySelector('.badge-diag').innerText;
        uniqueSet.add(type + path);
    });
    const uniqueCountEl = document.getElementById('unique-count');
    if (uniqueCountEl) uniqueCountEl.innerText = uniqueSet.size;

    // Search filtering
    const filterInput = document.getElementById('diag-filter-input');
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            rows.forEach(row => {
                row.style.display = row.dataset.search.includes(query) ? 'table-row' : 'none';
            });
        });
    }

    // Time format cleanup
    document.querySelectorAll('.diag-time').forEach(el => {
        let val = el.dataset.raw;
        if (val) {
            val = val.replace(', 0 minutes', '').replace('minutes', 'm').replace('minute', 'm').replace('hours', 'h').replace('hour', 'h');
            el.innerText = val + ' ago';
        }
    });
});

/**
 * Trace Sidebar logic (JS INJECTION TO BYPASS STACKING CONTEXT)
 */
function showTrace(type, msg, trace) {
    let modal = document.getElementById('diag-trace-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'diag-trace-modal';
        modal.className = 'diag-modal-container';
        modal.innerHTML = `
            <button class="diag-floating-close" onclick="hideTrace()">✕</button>
            <div class="diag-modal-content">
                <div class="diag-modal-header">
                    <div class="diag-modal-title">
                        <h3 id="mt-type-js"></h3>
                        <small id="mt-msg-js" class="text-danger"></small>
                    </div>
                </div>
                <div class="diag-modal-body">
                    <div class="trace-code-wrap">
                        <pre id="mt-trace-js"></pre>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('mt-type-js').innerText = type;
    document.getElementById('mt-msg-js').innerText = msg;
    document.getElementById('mt-trace-js').innerText = trace || "No stack trace dump found.";
    
    const backdrop = document.getElementById('diag-backdrop');
    
    modal.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideTrace() {
    const modal = document.getElementById('diag-trace-modal');
    const backdrop = document.getElementById('diag-backdrop');
    if (modal) modal.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = 'auto';
}

/**
 * Confirm Purge All Logs
 */
async function confirmPurgeAll() {
    if (window.systemModal) {
        const confirmed = await window.systemModal.show({
            title: 'Wipe Kernel Archive',
            message: 'This will purge all existing exception logs. This diagnostic data cannot be recovered.',
            confirmText: 'WIPE ALL',
            verifyPhrase: 'WIPE'
        });
        if (confirmed) document.getElementById('purge-form').submit();
    } else {
        if (confirm('Are you sure you want to purge all logs?')) {
            document.getElementById('purge-form').submit();
        }
    }
}
