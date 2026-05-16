/* Auth Base Logic — Premium Identity Portal */

document.addEventListener('DOMContentLoaded', () => {
    // Password Visibility Toggle
    const pwdToggles = document.querySelectorAll('.pwd-toggle');
    pwdToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i class="material-icons" style="font-size:18px;">visibility_off</i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i class="material-icons" style="font-size:18px;">visibility</i>';
                }
            }
        });
    });

    // Form Loading State
    const authForms = document.querySelectorAll('form');
    authForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const btn = form.querySelector('.auth-btn-primary');
            if (btn) {
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="loading-spinner"></span> AUTHENTICATING...';
                
                // Note: Actual submission happens after this
            }
        });
    });
});
