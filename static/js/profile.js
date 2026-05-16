document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-profile-btn');
  const saveBtnContainer = saveBtn.parentElement;
  const timerDisplay = document.getElementById('cooldown-timer');
  const banner = document.getElementById('cooldown-banner');
  
  // 1. Cooldown Clock Logic
  let secondsRemaining = parseInt(window.cooldownRemaining || 0);
  if (secondsRemaining > 0 && timerDisplay) {
    const updateTimer = () => {
      if (secondsRemaining <= 0) {
        if (banner) banner.style.display = 'none';
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.style.opacity = '1';
          saveBtn.style.cursor = 'pointer';
        }
        return;
      }
      const h = Math.floor(secondsRemaining / 3600);
      const m = Math.floor((secondsRemaining % 3600) / 60);
      const s = secondsRemaining % 60;
      timerDisplay.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      secondsRemaining--;
      setTimeout(updateTimer, 1000);
    };
    updateTimer();
  }

  // 2. Change Detection Logic
  const inputs = form.querySelectorAll('input[name]');
  const initialValues = {};
  inputs.forEach(input => { initialValues[input.name] = input.value; });

  // Hide button container initially unless there's a cooldown (which already handles it)
  if (secondsRemaining <= 0) {
    saveBtnContainer.style.display = 'none';
  }

  const checkChanges = () => {
    // If cooldown is active, don't show the button even if changed
    if (secondsRemaining > 0) return;

    let hasChanged = false;
    inputs.forEach(input => {
      if (input.value !== initialValues[input.name]) {
        hasChanged = true;
      }
    });

    saveBtnContainer.style.display = hasChanged ? 'block' : 'none';
  };

  inputs.forEach(input => {
    input.addEventListener('input', checkChanges);
  });

  // 3. Loading State on Submit
  form.addEventListener('submit', function() {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.7';
    saveBtn.innerHTML = '<span class="loading-spinner" style="margin-right: 10px; width: 14px; height: 14px;"></span> Saving Changes...';
  });
});
