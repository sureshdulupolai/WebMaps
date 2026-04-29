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
    const saveDraftBtn = document.getElementById('save-draft-btn');
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
    const fileDropArea = document.getElementById('file-drop-area');
    const fileStatus = document.getElementById('file-status');

    // 02. STATE & CONSTANTS
    const container = document.querySelector('.container');
    const needsPayment = container && container.dataset.needsPayment === 'true';
    let currentStep = needsPayment ? 4 : 1;
    let parsedServices = [];
    let marker;
    
    // Calculate listing-specific STORAGE_KEY
    const initialDataEl = document.getElementById('listing-initial-data');
    let initialData = null;
    if (initialDataEl) {
        try {
            initialData = JSON.parse(initialDataEl.textContent);
        } catch (e) {
            console.error("Critical: Initial data block is malformed.", e);
        }
    }

    const STORAGE_KEY = initialData && initialData.slug 
        ? `webmaps_edit_${initialData.slug}` 
        : 'webmaps_new_listing';

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
        
        // Disable 'Back' if we are forcing payment
        if (prevBtn) {
            if (needsPayment && currentStep === 4) {
                prevBtn.style.visibility = 'hidden';
            } else {
                prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
            }
        }

        if (currentStep === 4) {
            nextBtn.style.display = 'none';
            renderSummary();
            if (needsPayment) {
                const sumContent = document.getElementById('summary-content');
                if (sumContent) sumContent.innerHTML = `<div class="alert alert-warning mb-6">Subscription Required: Please complete the payment to re-activate this listing and save your changes.</div>` + sumContent.innerHTML;
            }
        } else {
            nextBtn.style.display = 'block';
            nextBtn.textContent = currentStep === 3 ? 'Review & Finish' : 'Continue to Next Step';
        }

        // Special: Invalidate map size if moving to step 1
        if (currentStep === 1 && typeof map !== 'undefined') {
            setTimeout(() => map.invalidateSize(), 150);
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
                showDialog("Location Needed", "Please select your business location on the map.");
                valid = false;
            }
            if (summaryTextarea && summaryTextarea.value.length > 300) {
                showDialog("Text Too Long", "Executive Summary cannot exceed 300 characters.");
                valid = false;
            }
        }

        if (currentStep === 2 && parsedServices.length === 0) {
            showDialog("Information Required", "Please parse your service protocol first.");
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
        let data = saved ? JSON.parse(saved) : null;

        // If no saved data but we have initial database data, HYDRATE first time
        if (!data && initialData) {
            console.log("Hydrating wizard state from database...");
            
            // Group services back for the UI
            const grouped = {};
            initialData.services.forEach(item => {
                const key = `${item.name}|${item.price}`;
                if (!grouped[key]) {
                    grouped[key] = { name: item.name, price: item.price, categories: [] };
                }
                grouped[key].categories.push(item.category);
            });

            data = {
                currentStep: 1,
                parsedServices: Object.values(grouped),
                operatingHours: initialData.operating_hours || null
            };
            // Seed localStorage with database state
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        if (!data) return;

        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) input.value = data[key];
        });

        if (data.parsedServices) {
            parsedServices = data.parsedServices;
            renderReviewTable();
            const revSection = document.getElementById('protocol-review-section');
            if (revSection) {
                revSection.classList.remove('d-none');
                updateHiddenInput();
            }
        }

        if (data.operatingHours && typeof restoreSchedule === 'function') {
            restoreSchedule(data.operatingHours);
            const hoursInput = document.getElementById('id_operating_hours');
            if (hoursInput) hoursInput.value = JSON.stringify(data.operatingHours);
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

    // --- File Dropzone Logic ---
    if (fileDropArea) {
        fileDropArea.addEventListener('click', () => fileInput.click());

        fileDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropArea.classList.add('dragover');
        });

        fileDropArea.addEventListener('dragleave', () => {
            fileDropArea.classList.remove('dragover');
        });

        fileDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (fileInput.files.length > 0) {
                handleFileSelection(fileInput.files[0]);
            }
        });
    }

    async function handleFileSelection(file) {
        if (!file) return;
        fileStatus.innerHTML = `⌛ Parsing <strong>${file.name}</strong>...`;
        fileDropArea.classList.add('active');

        try {
            // Read file content
            const content = await file.text();
            parseData(content);
            fileStatus.innerHTML = `✅ <strong>${file.name}</strong> parsed successfully.`;
        } catch (err) {
            console.error(err);
            fileStatus.innerHTML = `❌ Error parsing <strong>${file.name}</strong>.`;
            alert("Could not read file. Please ensure it's a valid text-based file.");
        } finally {
            setTimeout(() => {
                fileDropArea.classList.remove('active');
            }, 2000);
        }
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
    function renderSummary(isDraft = false) {
        const sumContent = document.getElementById('summary-content');
        const pricingContainer = document.getElementById('pricing-breakdown-container');
        if (!sumContent || !pricingContainer) return;

        const companyName = form.querySelector('[name="company_name"]').value;
        const servicesCount = parsedServices.length;

        sumContent.innerHTML = `
          <div class="mb-4"><strong class="text-primary">Company:</strong> ${companyName}</div>
          <div class="mb-4"><strong class="text-primary">Services:</strong> ${servicesCount} items parsed and reviewed.</div>
          <div class="mb-4"><strong class="text-primary">Location:</strong> Locked at [${latInput.value}, ${lngInput.value}]</div>
        `;

        // Calculate Pricing
        const selectedPlan = form.querySelector('.plan-card.active');
        if (selectedPlan) {
            pricingContainer.classList.remove('d-none');
            const baseCost = parseInt(selectedPlan.dataset.amount);
            const platformFee = 2; 
            
            let updateFee = 0;
            const isEdit = initialData && initialData.slug;
            const updateCountInput = document.getElementById('id_update_count');
            const currentUpdateCount = updateCountInput ? parseInt(updateCountInput.value) : 0;
            
            // Surcharge only if not a draft and limit reached
            if (isEdit && currentUpdateCount >= 2 && !isDraft) {
                updateFee = 20;
            }

            const taxableAmount = baseCost + updateFee;
            const cgst = taxableAmount * 0.09;
            const sgst = taxableAmount * 0.09;
            const total = taxableAmount + cgst + sgst + platformFee;

            pricingContainer.innerHTML = `
                <div class="pricing-breakdown">
                    <div class="breakdown-row"><span>Base Plan Cost</span><span>₹${baseCost}</span></div>
                    ${updateFee > 0 ? `<div class="breakdown-row"><span>Update Surcharge</span><span>₹${updateFee}</span></div>` : ''}
                    <div class="breakdown-row"><span>Platform Fee</span><span>₹${platformFee}</span></div>
                    <div class="breakdown-row"><span>CGST (9%)</span><span>₹${cgst.toFixed(2)}</span></div>
                    <div class="breakdown-row"><span>SGST (9%)</span><span>₹${sgst.toFixed(2)}</span></div>
                    <div class="breakdown-row total"><span>Amount Payable</span><span>₹${total.toFixed(2)}</span></div>
                </div>
            `;
        } else {
            pricingContainer.classList.add('d-none');
        }
    }

    // --- Save Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
            if (!validateCurrentStep()) return;
            
            const updateCountInput = document.getElementById('id_update_count');
            const currentUpdateCount = updateCountInput ? parseInt(updateCountInput.value) : 0;
            
            if (currentUpdateCount >= 2) {
                const totalUpdateFee = (20 * 1.18 + 2).toFixed(2);
                showDialog(
                    "Limit Reached", 
                    `You have already used your 2 free updates. To save these changes, you can proceed with a single update payment of ₹${totalUpdateFee} or select a subscription plan.`,
                    'warning',
                    null,
                    {
                        label: `Pay ₹${totalUpdateFee} & Update`,
                        callback: () => {
                            const planRadio = form.querySelector('[name="plan_id"]');
                            if (planRadio) {
                                submitBtn.click();
                            } else {
                                // Scroll to plans
                                window.scrollTo({ top: document.querySelector('.plans-grid').offsetTop - 100, behavior: 'smooth' });
                                showDialog("Select Plan", "Please select a plan to proceed with the paid update.");
                            }
                        }
                    }
                );
                return;
            }

            saveDraftBtn.disabled = true;
            saveDraftBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';

            try {
                const formData = new FormData(form);
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const result = await response.json();
                if (response.ok) {
                    const remaining = 2 - (currentUpdateCount + 1);
                    const msg = remaining > 0 
                        ? `Draft saved! You have ${remaining} free update${remaining > 1 ? 's' : ''} remaining.`
                        : "Draft saved! This was your last free update. Future changes will require a small fee.";
                    
                    showDialog("Success", msg, 'success', () => {
                        window.location.href = '/hosts/dashboard/';
                    });
                } else {
                    showDialog("Error", result.errors ? Object.values(result.errors).join('\n') : "Failed to save draft.");
                }
            } catch (err) {
                showDialog("Error", "Network error while saving draft.");
            } finally {
                saveDraftBtn.disabled = false;
                saveDraftBtn.innerHTML = 'Save Draft';
            }
        });
    }

    // --- Custom Dialog ---
    function showDialog(title, message, type = 'error', onConfirm = null, secondaryAction = null) {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const icon = type === 'success' ? '✅' : (type === 'info' ? 'ℹ️' : '⚠️');
        
        overlay.innerHTML = `
            <div class="custom-dialog">
                <button class="dialog-close">&times;</button>
                <div class="dialog-icon" style="font-size: 2rem;">${icon}</div>
                <h3 class="h4 mb-2">${title}</h3>
                <p class="text-sm text-secondary mb-6">${message}</p>
                <div class="d-flex gap-3">
                    <button class="btn btn-outline btn-sm w-full cancel-btn">Cancel</button>
                    <button class="btn btn-primary btn-sm w-full confirm-btn">${secondaryAction ? secondaryAction.label : 'OK'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const close = () => {
            overlay.remove();
        };
        
        overlay.querySelector('.dialog-close').onclick = close;
        overlay.querySelector('.cancel-btn').onclick = close;
        overlay.querySelector('.confirm-btn').onclick = () => {
            overlay.remove();
            if (secondaryAction && secondaryAction.callback) {
                secondaryAction.callback();
            } else if (onConfirm) {
                onConfirm();
            }
        };
    }

    // 10. PLAN SELECTION LOGIC
    const planCards = document.querySelectorAll('.plan-card');
    planCards.forEach(card => {
        card.addEventListener('click', () => {
            planCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            card.querySelector('input').checked = true;
            saveToLocal();
            renderSummary(); // Re-calculate pricing
        });
    });

    // 11. RAZORPAY & SUBMISSION
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!validateCurrentStep()) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Saving Listing...';

            try {
                // 1. Check plan selection FIRST (so backend knows this is a paid update)
                const selectedPlan = form.querySelector('[name="plan_id"]:checked');
                if (!selectedPlan) {
                    showDialog("Plan Required", "Please select a subscription plan to continue.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay & Initialize Listing';
                    return;
                }
                const planId = selectedPlan.value;

                // 2. Save listing via AJAX
                const formData = new FormData(form);
                const response = await fetch(window.location.href, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const result = await response.json();
                if (!response.ok) {
                    showDialog("Update Blocked", Object.values(result.errors || {e: "Error saving listing"}).join('\n'));
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay & Initialize Listing';
                    return;
                }

                const activeSlug = result.slug || slug;

                // 3. Initiate Payment
                submitBtn.innerHTML = '<span class="loading-spinner"></span> Creating Order...';
                const payInitResp = await fetch(`/payments/initiate/${activeSlug}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: `plan_id=${planId}`
                });

                const payInfo = await payInitResp.json();
                if (!payInitResp.ok) throw new Error(payInfo.error || "Order creation failed");

                // 3. Open Razorpay
                const options = {
                    key: document.querySelector('[data-rzp-key]').dataset.rzpKey,
                    amount: payInfo.amount,
                    currency: payInfo.currency,
                    name: "WebMaps",
                    description: `Subscription for ${payInfo.listing_name}`,
                    order_id: payInfo.order_id,
                    handler: async function (response) {
                        submitBtn.innerHTML = '<span class="loading-spinner"></span> Verifying...';
                        const verifyResp = await fetch('/payments/verify/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                listing_slug: activeSlug,
                                plan_id: planId
                            })
                        });

                        const verifyResult = await verifyResp.json();
                        if (verifyResult.status === 'success') {
                            localStorage.removeItem(STORAGE_KEY);
                            window.location.href = verifyResult.redirect || '/hosts/dashboard/';
                        } else {
                            showDialog("Payment Error", "Payment verification failed. Please contact support.");
                            submitBtn.disabled = false;
                        }
                    },
                    prefill: {
                        name: "",
                        email: ""
                    },
                    theme: { color: "#6366f1" },
                    modal: {
                        ondismiss: function() {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Pay & Initialize Listing';
                        }
                    }
                };

                const rzp = new Razorpay(options);
                rzp.open();

            } catch (err) {
                console.error(err);
                showDialog("Execution Error", err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Pay & Initialize Listing';
            }
        });
    }

    // 12. CHAR COUNTER
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

    // 13. PROTOCOL MODAL
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

    // 14. INITIALIZE
    initSchedule();
    loadFromLocal();
    updateCharCount();
    updateWizard();
});
