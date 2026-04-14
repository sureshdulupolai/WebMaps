document.addEventListener('DOMContentLoaded', function () {
    // 01. PRIMARY DOM REFERENCES
    const form = document.getElementById('listing-form');
    const latInput = document.getElementById('id_latitude');
    const lngInput = document.getElementById('id_longitude');
    const overlay = document.getElementById('location-req-overlay');
    const verifyBtn = document.getElementById('verify-coords-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-listing-btn');
    const progressLine = document.getElementById('progress-line');
    const steps = document.querySelectorAll('.wizard-step');
    const categories = document.querySelectorAll('.step-node');
    const summaryTextarea = document.getElementById('summary-textarea');
    const charDisplay = document.getElementById('char-count');
    const tabUpload = document.getElementById('btn-tab-upload');
    const tabPaste = document.getElementById('btn-tab-paste');
    const uploadBox = document.getElementById('protocol-upload-container');
    const pasteBox = document.getElementById('protocol-paste-container');
    const processBtn = document.getElementById('process-protocol-btn');
    const servicesTbody = document.getElementById('services-tbody');
    const hiddenJson = document.getElementById('hidden-services-json');
    const textInput = document.getElementById('protocol-text-input');
    const fileInput = document.getElementById('id_service_file');

    // 02. STATE & CONSTANTS
    let currentStep = 1;
    let parsedServices = [];
    let marker;
    const STORAGE_KEY = 'webmaps_pending_listing';

    // 03. WIZARD NAVIGATION & STATE
    function updateWizard() {
        steps.forEach(s => s.classList.remove('active'));
        const targetStep = document.getElementById(`step-${currentStep}`);
        if (targetStep) targetStep.classList.add('active');

        categories.forEach(node => {
            const stepNum = parseInt(node.dataset.step);
            node.classList.remove('active', 'completed');
            if (stepNum === currentStep) node.classList.add('active');
            if (stepNum < currentStep) node.classList.add('completed');
        });

        if (progressLine) progressLine.style.width = `${(currentStep - 1) * 33.33}%`;
        if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';

        if (currentStep === 4) {
            nextBtn.style.display = 'none';
            renderSummary();
        } else {
            nextBtn.style.display = 'block';
            nextBtn.textContent = currentStep === 3 ? 'Review & Finish' : 'Continue to Next Step';
        }

        // Special: Invalidate map size if moving to step 1
        if (currentStep === 1 && typeof map !== 'undefined') {
            setTimeout(() => map.invalidateSize(), 100);
        }

        saveToLocal();
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (validateCurrentStep()) {
                currentStep++;
                updateWizard();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentStep--;
            updateWizard();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function validateCurrentStep() {
        const activeStep = document.getElementById(`step-${currentStep}`);
        const required = activeStep.querySelectorAll('[required]');
        let valid = true;
        required.forEach(el => {
            if (!el.value.trim()) {
                el.style.borderColor = 'var(--danger)';
                valid = false;
            } else {
                el.style.borderColor = 'var(--border)';
            }
        });

        if (currentStep === 1) {
            if (!latInput.value || !lngInput.value) {
                alert("Please select your business location on the map.");
                valid = false;
            }
            if (summaryTextarea && summaryTextarea.value.length > 300) {
                alert("Executive Summary cannot exceed 300 characters.");
                valid = false;
            }
        }

        if (currentStep === 2 && parsedServices.length === 0) {
            alert("Please parse your service protocol first.");
            valid = false;
        }

        return valid;
    }

    // 04. LOCALSTORAGE PERSISTENCE
    function saveToLocal() {
        if (!form) return;
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (key !== 'csrfmiddlewaretoken' && key !== 'service_file') {
                data[key] = value;
            }
        });
        data.currentStep = currentStep;
        data.parsedServices = parsedServices;
        data.operatingHours = getScheduleData ? getScheduleData() : null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function loadFromLocal() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const data = JSON.parse(saved);

        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) input.value = data[key];
        });

        if (data.parsedServices) {
            parsedServices = data.parsedServices;
            renderReviewTable();
            const revSection = document.getElementById('protocol-review-section');
            if (revSection) revSection.classList.remove('d-none');
        }

        if (data.operatingHours && typeof restoreSchedule === 'function') {
            restoreSchedule(data.operatingHours);
        }

        currentStep = data.currentStep || 1;
        updateWizard();
    }

    // 05. MAP LOGIC (Step 1)
    let initialLat = (latInput && parseFloat(latInput.value)) || 19.076;
    let initialLng = (lngInput && parseFloat(lngInput.value)) || 72.877;

    const mapElement = document.getElementById('listing-map');
    let map;

    if (mapElement) {
        map = L.map('listing-map', { zoomControl: false, attributionControl: false }).setView([initialLat, initialLng], 12);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        if (latInput && latInput.value && lngInput && lngInput.value) {
            marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
        }

        // Geolocation Auto-Detect
        if ("geolocation" in navigator && latInput && !latInput.value) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude } = pos.coords;
                latInput.value = latitude.toFixed(6);
                lngInput.value = longitude.toFixed(6);

                map.setView([latitude, longitude], 16);
                if (marker) marker.setLatLng([latitude, longitude]);
                else {
                    marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
                    marker.on('dragend', updateCoords);
                }
                saveToLocal();
            }, (err) => {
                console.warn("Geolocation denied or failed.", err);
            }, { enableHighAccuracy: true });
        }

        map.on('click', function (e) {
            const { lat, lng } = e.latlng;
            if (marker) marker.setLatLng([lat, lng]);
            else {
                marker = L.marker([lat, lng], { draggable: true }).addTo(map);
                marker.on('dragend', updateCoords);
            }
            updateCoords({ target: marker });
        });
    }

    function updateCoords(e) {
        if (!latInput || !lngInput) return;
        const pos = e.target.getLatLng();
        latInput.value = pos.lat.toFixed(6);
        lngInput.value = pos.lng.toFixed(6);
        saveToLocal();
    }

    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            if (latInput && latInput.value && lngInput && lngInput.value) {
                map.flyTo([latInput.value, lngInput.value], 18, { duration: 1.5 });
            }
        });
    }

    // 06. ENHANCED PARSER (Step 2)
    if (tabUpload) {
        tabUpload.addEventListener('click', () => {
            tabUpload.classList.add('active'); tabPaste.classList.remove('active');
            uploadBox.classList.remove('d-none'); pasteBox.classList.add('d-none');
        });
    }

    if (tabPaste) {
        tabPaste.addEventListener('click', () => {
            tabPaste.classList.add('active'); tabUpload.classList.remove('active');
            pasteBox.classList.remove('d-none'); uploadBox.classList.add('d-none');
        });
    }

    if (processBtn) {
        processBtn.addEventListener('click', async () => {
            let content = "";
            if (!pasteBox.classList.contains('d-none')) {
                content = textInput ? textInput.value : "";
            } else if (fileInput && fileInput.files.length > 0) {
                content = await fileInput.files[0].text();
            }

            if (!content) { alert("Please provide protocol data first."); return; }
            parseData(content);
        });
    }

    function parseData(text) {
        const lines = text.split('\n');
        const pattern = /^([^=]+)\s*=\s*([^(\n]+?)(?:\s*\(([^)]+)\))?\s*$/;

        parsedServices = [];
        lines.forEach(line => {
            const m = line.trim().match(pattern);
            if (m) {
                parsedServices.push({
                    name: m[1].trim(),
                    price: m[2].trim().replace(/[^\d,.₹$]/g, ''),
                    categories: m[3] ? m[3].split(',').map(c => c.trim()) : ["General"]
                });
            }
        });
        renderReviewTable();
        const revSection = document.getElementById('protocol-review-section');
        if (revSection) revSection.classList.remove('d-none');
        updateHiddenInput();
    }

    function renderReviewTable() {
        if (!servicesTbody) return;
        servicesTbody.innerHTML = '';
        parsedServices.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td class="px-4 py-3"><input type="text" class="input-line edit-name" value="${s.name}" data-idx="${idx}"></td>
            <td class="px-4 py-3"><input type="text" class="input-line edit-price" value="${s.price}" data-idx="${idx}"></td>
            <td class="px-4 py-3"><input type="text" class="input-line edit-cats" value="${s.categories.join(', ')}" data-idx="${idx}"></td>
            <td class="px-4 py-3 text-right"><button type="button" class="btn-text text-danger row-delete" data-idx="${idx}">&times;</button></td>
          `;
            servicesTbody.appendChild(tr);
        });

        servicesTbody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.dataset.idx;
                if (e.target.classList.contains('edit-name')) parsedServices[idx].name = e.target.value;
                if (e.target.classList.contains('edit-price')) parsedServices[idx].price = e.target.value;
                if (e.target.classList.contains('edit-cats')) parsedServices[idx].categories = e.target.value.split(',').map(c => c.trim());
                updateHiddenInput();
            });
        });

        servicesTbody.querySelectorAll('.row-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                parsedServices.splice(e.target.dataset.idx, 1);
                renderReviewTable();
                updateHiddenInput();
            });
        });
    }

    function updateHiddenInput() {
        if (hiddenJson) hiddenJson.value = JSON.stringify(parsedServices);
        saveToLocal();
    }

    // 07. SCHEDULE BUILDER (Step 3)
    const scheduleContainer = document.getElementById('schedule-container');
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    function initSchedule() {
        if (!scheduleContainer) return;
        scheduleContainer.innerHTML = '';
        dayNames.forEach(day => {
            const row = document.createElement('div');
            row.className = 'day-row';
            row.innerHTML = `
            <div class="day-label">${day}</div>
            <div class="time-range">
              <input type="time" class="time-input start-time" value="09:00">
              <span class="text-secondary opacity-30">—</span>
              <input type="time" class="time-input end-time" value="18:00">
            </div>
            <div class="day-toggle active" data-day="${day}"></div>
          `;
            scheduleContainer.appendChild(row);
        });

        document.querySelectorAll('.day-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                saveToLocal();
            });
        });

        document.querySelectorAll('.time-input').forEach(input => {
            input.addEventListener('change', saveToLocal);
        });
    }

    function getScheduleData() {
        const data = {};
        const rows = document.querySelectorAll('.day-row');
        if (rows.length === 0) return null;
        
        rows.forEach(row => {
            const day = row.querySelector('.day-label').textContent;
            const isOpen = row.querySelector('.day-toggle').classList.contains('active');
            data[day] = {
                is_open: isOpen,
                open: row.querySelector('.start-time').value,
                close: row.querySelector('.end-time').value
            };
        });
        const hoursInput = document.getElementById('id_operating_hours');
        if (hoursInput) hoursInput.value = JSON.stringify(data);
        return data;
    }

    function restoreSchedule(stored) {
        document.querySelectorAll('.day-row').forEach(row => {
            const day = row.querySelector('.day-label').textContent;
            if (stored[day]) {
                if (!stored[day].is_open) row.querySelector('.day-toggle').classList.remove('active');
                row.querySelector('.start-time').value = stored[day].open;
                row.querySelector('.end-time').value = stored[day].close;
            }
        });
    }

    // 08. SUMMARY & SUBMIT (Step 4)
    function renderSummary() {
        const sumContent = document.getElementById('summary-content');
        if (!sumContent) return;
        const companyName = form.querySelector('[name="company_name"]').value;
        const servicesCount = parsedServices.length;

        sumContent.innerHTML = `
          <div class="mb-4"><strong class="text-primary">Company:</strong> ${companyName}</div>
          <div class="mb-4"><strong class="text-primary">Services:</strong> ${servicesCount} items parsed and reviewed.</div>
          <div class="mb-4"><strong class="text-primary">Location:</strong> Locked at [${latInput.value}, ${lngInput.value}]</div>
          <div class="text-xs text-muted">Please double-check your service prices and categories before submission. You can go back to any step by clicking "Back".</div>
        `;
    }

    if (form) {
        form.addEventListener('submit', () => {
            localStorage.removeItem(STORAGE_KEY);
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="loading-spinner"></span> Initializing...';
            }
        });
    }

    // 09. CHAR COUNTER
    function updateCharCount() {
        if (!summaryTextarea || !charDisplay) return;
        const len = summaryTextarea.value.length;
        charDisplay.textContent = len;
        charDisplay.style.color = len >= 300 ? 'var(--danger)' : 'var(--text-secondary)';
    }

    if (summaryTextarea) {
        summaryTextarea.addEventListener('input', () => {
            updateCharCount();
            saveToLocal();
        });
    }

    // 10. PROTOCOL MODAL
    const viewSampleBtn = document.getElementById('view-sample-btn');
    const closeSampleBtn = document.getElementById('close-sample-btn');
    const sampleModal = document.getElementById('sample-modal');

    if (viewSampleBtn) {
        viewSampleBtn.addEventListener('click', () => {
            if (sampleModal) sampleModal.style.display = 'flex';
        });
    }
    if (closeSampleBtn) {
        closeSampleBtn.addEventListener('click', () => {
            if (sampleModal) sampleModal.style.display = 'none';
        });
    }

    // 11. INITIALIZE
    initSchedule();
    loadFromLocal();
    updateCharCount();
    updateWizard();
});
