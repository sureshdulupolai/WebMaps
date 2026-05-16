(function() {
    // ════════════════════════════════════════════════════════════
    // WebMaps Strategic Confirmation Intelligence
    // ════════════════════════════════════════════════════════════
    var overlay = document.createElement('div');
    overlay.id = 'wm-confirm-overlay';
    overlay.innerHTML = `
        <div id="wm-confirm-modal">
            <div id="wm-confirm-icon-wrap">
                <span class="material-icons" id="wm-confirm-icon">warning</span>
            </div>
            <h3 id="wm-confirm-title">Confirm Action</h3>
            <p id="wm-confirm-msg"></p>
            <div id="wm-confirm-rationale"></div>
            <div id="wm-verify-block">
                <span id="wm-verify-label"></span>
                <input id="wm-verify-input" type="text" autocomplete="off" spellcheck="false">
            </div>
            <div id="wm-confirm-footer">
                <button class="wm-btn" id="wm-btn-cancel">Cancel</button>
                <button class="wm-btn" id="wm-btn-confirm">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window.systemModal = {
        show: function(opts) {
            var ov      = document.getElementById('wm-confirm-overlay');
            var title   = document.getElementById('wm-confirm-title');
            var msg     = document.getElementById('wm-confirm-msg');
            var rat     = document.getElementById('wm-confirm-rationale');
            var vBlock  = document.getElementById('wm-verify-block');
            var vLabel  = document.getElementById('wm-verify-label');
            var vInput  = document.getElementById('wm-verify-input');
            var btnConf = document.getElementById('wm-btn-confirm');
            var btnCan  = document.getElementById('wm-btn-cancel');

            title.innerText   = opts.title    || 'Confirm Action';
            msg.innerText     = opts.message   || 'Are you sure?';
            rat.innerText     = opts.rationale || '';
            rat.style.display = opts.rationale ? 'block' : 'none';
            btnConf.innerText = opts.confirmText || 'CONFIRM';

            if (opts.confirmClass === 'btn-primary') {
                btnConf.style.background = '#a855f7';
                btnConf.style.boxShadow  = '0 4px 20px rgba(168,85,247,0.3)';
            } else {
                btnConf.style.background = '#ef4444';
                btnConf.style.boxShadow  = '0 4px 20px rgba(239,68,68,0.3)';
            }

            vInput.value = '';
            if (opts.verifyPhrase) {
                vBlock.style.display = 'block';
                vLabel.innerText     = 'Type "' + opts.verifyPhrase + '" to confirm';
                btnConf.disabled     = true;
                vInput.oninput = function() {
                    btnConf.disabled = vInput.value.toLowerCase() !== opts.verifyPhrase.toLowerCase();
                };
            } else {
                vBlock.style.display = 'none';
                btnConf.disabled     = false;
            }

            ov.classList.add('active');

            return new Promise(function(resolve) {
                btnConf.onclick = function() { ov.classList.remove('active'); resolve(true);  };
                btnCan.onclick  = function() { ov.classList.remove('active'); resolve(false); };
                ov.onclick = function(e) {
                    if (e.target === ov) { ov.classList.remove('active'); resolve(false); }
                };
            });
        }
    };
})();
