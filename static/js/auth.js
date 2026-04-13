document.addEventListener('DOMContentLoaded', () => {

  // --- Password Visibility Toggle ---
  document.querySelectorAll('.pwd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const inputId = this.getAttribute('data-target');
      if(inputId) {
        const input = document.getElementById(inputId);
        const isPassword = input.type === 'password';
        
        input.type = isPassword ? 'text' : 'password';
        
        // Update SVG based on state
        if (isPassword) {
          this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>';
        } else {
          this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
        }
      }
    });

    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // --- Dynamic Form Validation (Login) ---
  const loginForm = document.getElementById('login-form');
  const loginSubmitBtn = document.getElementById('login-submit-btn');

  if (loginForm && loginSubmitBtn) {
    loginForm.addEventListener('input', () => {
      const e = document.getElementById('login-email').value;
      const p = document.getElementById('login-password').value;
      loginSubmitBtn.disabled = !(e && p.length > 0);
    });

    loginForm.addEventListener('submit', function() {
      if(!loginSubmitBtn.disabled) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Authenticating...';
      }
    });
  }

  // --- Bulletproof Registration Validation ---
  const registerForm = document.getElementById('register-form');
  const registerSubmitBtn = document.getElementById('reg-submit-btn');

  if (registerForm && registerSubmitBtn) {
    const originalBtnText = registerSubmitBtn.innerHTML.trim();

    function validateRegistration() {
      const requiredInputs = registerForm.querySelectorAll('input[required]');
      const pwd = document.getElementById('reg-password');
      const confirm = document.getElementById('reg-confirm');
      
      let allFilled = true;
      requiredInputs.forEach(input => {
        if (input.type === 'radio' || input.type === 'checkbox') {
          const group = registerForm.querySelectorAll(`input[name="${input.name}"]`);
          const checked = Array.from(group).some(r => r.checked);
          if (!checked) allFilled = false;
        } else if (!input.value.trim()) {
          allFilled = false;
        }
      });

      const passwordsMatch = !confirm || (pwd.value === confirm.value && pwd.value.length > 0);
      const showMismatch = confirm && confirm.value.length > 0 && pwd.value !== confirm.value;

      registerSubmitBtn.disabled = !(allFilled && passwordsMatch);

      if (showMismatch) {
        confirm.style.borderColor = 'var(--danger)';
        registerSubmitBtn.innerHTML = 'Passwords Mismatch';
        registerSubmitBtn.style.background = 'var(--danger)';
      } else {
        if (confirm) confirm.style.borderColor = '';
        registerSubmitBtn.innerHTML = originalBtnText;
        registerSubmitBtn.style.background = '';
      }
    }

    ['input', 'change', 'paste', 'keyup'].forEach(evt => {
      registerForm.addEventListener(evt, validateRegistration);
    });

    setTimeout(validateRegistration, 100);
    validateRegistration();

    registerForm.addEventListener('submit', function() {
      if(!registerSubmitBtn.disabled) {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.innerHTML = '<span class="loading-spinner mr-2"></span> Finalizing Account...';
      }
    });
  }
});
