// 429 Too Many Requests Countdown Logic
document.addEventListener('DOMContentLoaded', () => {
    let total = 60;
    let remaining = total;
    const timerEl = document.getElementById('wait-timer');
    const fillEl = document.getElementById('countdown-fill');

    if (!timerEl || !fillEl) return;

    const tick = () => {
        remaining--;
        if (timerEl) timerEl.innerText = remaining;
        if (fillEl) {
            const pct = (remaining / total) * 100;
            fillEl.style.width = pct + '%';
        }
        if (remaining <= 0) {
            clearInterval(interval);
            if (fillEl) fillEl.style.width = '0%';
        }
    };

    const interval = setInterval(tick, 1000);
});
