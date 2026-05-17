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
    const container = document.querySelector('.host-listing-container');
    const needsPayment = container && container.dataset.needsPayment === 'true';
    const needsSubscription = container && container.dataset.needsSubscription === 'true';
    const hasActiveSub = container && container.dataset.hasSubscription === 'true';
    const currentPlanId = container && container.dataset.currentPlanId;
    let currentStep = needsPayment ? 4 : 1;
    let parsedServices = [];
    let appliedDiscount = 0;
    let appliedCoupon = null;
    let appliedDiscountType = null;
    let appliedDiscountValue = 0;
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

    // Check for ?new=true to clear state for new listings
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('new') === 'true' && !initialData.slug) {
        localStorage.removeItem(STORAGE_KEY);
        console.log("New listing requested: local state cleared.");
    }

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
        
        // Show 'Back' button on all steps except Step 1
        if (prevBtn) {
            prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
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
            const categoryInput = activeStep.querySelector('#id_category_hidden');
            const customSelect = document.getElementById('category-custom-select');
            if (categoryInput && !categoryInput.value) {
                if (customSelect) customSelect.querySelector('.custom-select-trigger').style.borderColor = 'var(--danger)';
                showDialog("Category Required", "Please select a business category.");
                valid = false;
            } else {
                if (customSelect) customSelect.querySelector('.custom-select-trigger').style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }

            const mobileInput = activeStep.querySelector('#id_mobile_number');
            if (mobileInput) {
                const val = mobileInput.value.trim();
                if (val.length !== 10 || /^(\d)\1{9}$/.test(val)) {
                    mobileInput.closest('.mobile-prefix-container').style.borderColor = 'var(--danger)';
                    showDialog("Invalid Mobile", "Please enter a valid 10-digit mobile number.");
                    valid = false;
                } else {
                    mobileInput.closest('.mobile-prefix-container').style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }
            }
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
    function isFormChanged() {
        if (!initialData) return false;

        // 1. Text / select fields
        if ((form.querySelector('[name="company_name"]')?.value || '').trim() !== (initialData.company_name || '').trim()) return true;
        if ((form.querySelector('[name="website_url"]')?.value || '').trim() !== (initialData.website_url || '').trim()) return true;
        if ((form.querySelector('[name="mobile_number"]')?.value || '').trim() !== (initialData.mobile_number || '').trim()) return true;
        if ((form.querySelector('[name="short_description"]')?.value || '').trim() !== (initialData.short_description || '').trim()) return true;
        
        const catVal = form.querySelector('[name="category"]')?.value || '';
        if (catVal && String(catVal) !== String(initialData.category_id || '')) return true;

        // 2. Coordinates (rounding to 6 decimals)
        if (latInput && lngInput && initialData.latitude && initialData.longitude) {
            const currentLat = parseFloat(latInput.value || 0).toFixed(6);
            const currentLng = parseFloat(lngInput.value || 0).toFixed(6);
            const initialLat = parseFloat(initialData.latitude || 0).toFixed(6);
            const initialLng = parseFloat(initialData.longitude || 0).toFixed(6);
            if (currentLat !== initialLat || currentLng !== initialLng) return true;
        }

        // 3. Operating Hours
        const currentHoursStr = document.getElementById('id_operating_hours')?.value || '{}';
        let currentHours = {};
        try { currentHours = JSON.parse(currentHoursStr); } catch(e){}
        const initialHours = initialData.operating_hours || {};
        if (JSON.stringify(currentHours) !== JSON.stringify(initialHours)) return true;

        // 4. Services (group initialData.services to group format and compare)
        const grouped = {};
        const initialServicesList = initialData.services || [];
        initialServicesList.forEach(item => {
            const key = `${item.name}|${item.price}`;
            if (!grouped[key]) {
                grouped[key] = { name: item.name, price: item.price, categories: [] };
            }
            grouped[key].categories.push(item.category);
        });
        const initialGroupedServices = Object.values(grouped);
        
        // Sorting helper for comparison
        const sortServices = (list) => {
            return JSON.stringify((list || []).map(s => ({
                name: s.name,
                price: parseFloat(s.price),
                categories: [...(s.categories || [])].sort()
            })).sort((a,b) => a.name.localeCompare(b.name)));
        };

        if (sortServices(parsedServices) !== sortServices(initialGroupedServices)) return true;

        return false;
    }

    function checkSubmitButtonState() {
        if (!hasActiveSub) return; // Only hide for active subscribers who just want to toggle visibility
        
        const changed = isFormChanged();
        if (submitBtn) {
            if (changed) {
                submitBtn.style.display = '';
            } else {
                submitBtn.style.display = 'none';
            }
        }
    }

    window.webmapsSaveToLocal = function() {
        saveToLocal();
    };

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
        data.operatingHours = typeof getScheduleData === 'function' ? getScheduleData() : null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        checkSubmitButtonState();
    }

    function loadFromLocal() {
        const saved = localStorage.getItem(STORAGE_KEY);
        let data = saved ? JSON.parse(saved) : null;

        // If no saved data but we have initial database data, HYDRATE first time
        if (!data && initialData && initialData.services) {
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
            if (key === 'plan_id') {
                const radio = form.querySelector(`input[name="plan_id"][value="${data[key]}"]`);
                if (radio) {
                    radio.checked = true;
                    // Highlight the card
                    const card = radio.closest('.plan-card');
                    if (card) {
                        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
                        card.classList.add('active');
                    }
                }
            } else {
                const input = form.querySelector(`[name="${key}"]`);
                if (input) input.value = data[key];
            }
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

        if (typeof window.hydrateCategoryDropdown === 'function') {
            window.hydrateCategoryDropdown();
        }

        currentStep = data.currentStep || 1;
        updateWizard();
        renderSummary();
    }
    
    // Make saveToLocal globally available for map logic in HTML
    window.webmapsSaveToLocal = saveToLocal;


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
        const updateCountInput = document.getElementById('id_update_count');
        const currentUpdateCount = updateCountInput ? parseInt(updateCountInput.value) : 0;
        const isEdit = initialData && initialData.slug && initialData.slug.length > 0;
        
        let updateFee = 0;
        if (isEdit && currentUpdateCount >= 2) {
            updateFee = 29; // Exactly ₹29 for paid updates
        }

        if (selectedPlan || (hasActiveSub && updateFee > 0)) {
            pricingContainer.classList.remove('d-none');
            const baseCost = selectedPlan ? parseFloat(selectedPlan.dataset.amount) : 0;

            // --- REFINED CALCULATION LOGIC ---
            // 1. Taxable Subtotal
            // If we are just doing a paid update (updateFee=29), baseCost should be ignored if it's 0
            const rawTaxable = (updateFee > 0 && baseCost === 0) ? updateFee : (baseCost + updateFee);
            
            // 2. Apply Discount to Taxable amount
            // If it's a 100% coupon (appliedDiscount >= baseCost), we waive the whole thing including updateFee
            const isFullDiscount = appliedDiscount >= baseCost && appliedDiscount > 0;
            
            const remainingTaxable = isFullDiscount ? 0 : Math.max(0, rawTaxable - appliedDiscount);
            
            // 3. Calculate Taxes on REMAINING amount
            const cgst = remainingTaxable * 0.09;
            const sgst = remainingTaxable * 0.09;
            
            // 4. Platform Fee (Only if amount > 0)
            const platformFee = remainingTaxable > 0 ? 2 : 0;
            
            const total = (baseCost === 0 && updateFee > 0 && !isFullDiscount) ? 29.00 : (remainingTaxable + cgst + sgst + platformFee);
            const subtotal = (baseCost === 0 && updateFee > 0) ? 29.00 : (rawTaxable + (rawTaxable * 0.18) + (rawTaxable > 0 ? 2 : 0));

            pricingContainer.innerHTML = `
                <div class="pricing-breakdown" style="padding: 24px; background: rgba(0,0,0,0.2); border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                    <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; color:rgba(255,255,255,0.4);">
                        <span>Base Subscription</span><span>₹${baseCost.toFixed(2)}</span>
                    </div>
                    ${updateFee > 0 ? `<div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; color:rgba(255,255,255,0.4);"><span>Update Surcharge (Limit Reached)</span><span>₹${updateFee.toFixed(2)}</span></div>` : ''}
                    
                    <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; color:rgba(255,255,255,0.4);">
                        <span>CGST (9%)</span><span>₹${(total > 29 ? cgst : (total === 29 ? 2.21 : cgst)).toFixed(2)}</span>
                    </div>
                    <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; color:rgba(255,255,255,0.4);">
                        <span>SGST (9%)</span><span>₹${(total > 29 ? sgst : (total === 29 ? 2.21 : sgst)).toFixed(2)}</span>
                    </div>
                    <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px; color:rgba(255,255,255,0.4);">
                        <span>Platform Fee</span><span>₹${(total > 29 ? platformFee : (total === 29 ? 2.00 : platformFee)).toFixed(2)}</span>
                    </div>
                    
                    ${appliedDiscount > 0 ? `
                        <div style="height:1px; background:rgba(255,255,255,0.05); margin:16px 0; border-style:dashed; border-width:1px 0 0 0;"></div>
                        <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px; font-weight:700; color:rgba(255,255,255,0.6);">
                            <span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span>
                        </div>
                        <div class="breakdown-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px; color:#10b981; font-weight:700;">
                            <span>Coupon: ${appliedCoupon} (${appliedDiscountType === 'percentage' && appliedDiscountValue == 100 ? '100% OFF' : (appliedDiscountType === 'percentage' ? appliedDiscountValue + '%' : '₹' + appliedDiscountValue)})</span>
                            <span>-₹${(isFullDiscount ? subtotal : appliedDiscount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="breakdown-row total" style="display:flex; justify-content:space-between; margin-top:20px; padding-top:20px; border-top:2px solid rgba(255,255,255,0.1); font-size:24px; font-weight:900; color:#fff;">
                        <span>Amount Payable</span><span>₹${total.toFixed(2)}</span>
                    </div>
                </div>
            `;

            // Update Submit Button if Free
            if (total <= 0) {
                submitBtn.textContent = 'Host for Free';
                submitBtn.classList.remove('btn-primary');
                submitBtn.classList.add('btn-success');
                submitBtn.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.2)';
            } else {
                submitBtn.textContent = (updateFee > 0 && baseCost === 0) ? 'Pay ₹29 & Update' : 'Pay & Initialize Listing';
                submitBtn.classList.add('btn-primary');
                submitBtn.classList.remove('btn-success');
                submitBtn.style.boxShadow = 'none';
            }
        } else {
            pricingContainer.classList.add('d-none');
        }
    }

    // --- Coupon Logic ---
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponInput = document.getElementById('coupon-code-input');
    const couponFeedback = document.getElementById('coupon-feedback');

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', async () => {
            const code = couponInput.value.trim().toUpperCase();
            const selectedPlan = form.querySelector('.plan-card.active');
            
            if (!code) {
                showCouponFeedback("Please enter a coupon code.", "error");
                return;
            }

            const updateCountInput = document.getElementById('id_update_count');
            const currentUpdateCount = updateCountInput ? parseInt(updateCountInput.value) : 0;
            const isEdit = initialData && initialData.slug && initialData.slug.length > 0;
            const payingUpdateFee = isEdit && currentUpdateCount >= 2;

            const container = document.querySelector('.container');
            const isPayingUpdate = (container?.dataset?.needsPayment || '').toLowerCase() === 'true';
            const hasSub = (container?.dataset?.hasSubscription || '').toLowerCase() === 'true';

            // If no plan selected, allow if it's a paid update OR if they have an active sub
            if (!selectedPlan && !isPayingUpdate && !hasSub) {
                showCouponFeedback("Please select a plan first.", "error");
                return;
            }

            const validationAmount = selectedPlan ? parseFloat(selectedPlan.dataset.amount) : 29.00;

            applyCouponBtn.disabled = true;
            applyCouponBtn.textContent = "Checking...";

            try {
                const response = await fetch('/coupon/validate/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({
                        code: code,
                        amount: validationAmount,
                        listing_slug: initialData ? initialData.slug : null
                    })
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    throw new Error("System returned an invalid response format (HTML). Please contact admin.");
                }

                if (result.valid) {
                    appliedDiscount = parseFloat(result.discount_amount);
                    appliedCoupon = code;
                    appliedDiscountType = result.discount_type;
                    appliedDiscountValue = parseFloat(result.discount_value);
                    
                    const displayValue = appliedDiscountType === 'percentage' 
                        ? `${appliedDiscountValue}%` 
                        : `₹${appliedDiscountValue}`;
                    
                    showCouponFeedback(`Coupon applied! ${displayValue} Off (Saved ₹${appliedDiscount.toFixed(2)})`, "success");
                    renderSummary();
                } else {
                    appliedDiscount = 0;
                    appliedCoupon = null;
                    appliedDiscountType = null;
                    appliedDiscountValue = 0;
                    showCouponFeedback(result.message || "Invalid coupon code.", "error");
                    renderSummary();
                }
            } catch (err) {
                showCouponFeedback(err.message || "Failed to validate coupon.", "error");
            } finally {
                applyCouponBtn.disabled = false;
                applyCouponBtn.textContent = "Apply";
            }
        });
    }

    function showCouponFeedback(msg, type) {
        if (!couponFeedback) return;
        couponFeedback.textContent = msg;
        couponFeedback.className = `text-xs mt-2 ${type === 'success' ? 'text-success' : 'text-danger'}`;
        couponFeedback.classList.remove('d-none');
    }

    // --- Save Draft Logic ---
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', async () => {
            if (!validateCurrentStep()) return;
            
            const updateCountInput = document.getElementById('id_update_count');
            const currentUpdateCount = updateCountInput ? parseInt(updateCountInput.value) : 0;
            
            // Enforce update fee for all users after 2 free updates
            if (currentUpdateCount >= 2 && currentStep !== 4) {
                const totalUpdateFee = 29; // Fixed per user request
                showDialog(
                    "Paid Update Required", 
                    `You have reached your free update limit. To save this draft and apply changes, a small fee of ₹${totalUpdateFee} is required.`,
                    'warning',
                    null,
                    {
                        label: `Proceed to Payment`,
                        callback: () => {
                           // Move to finalize step
                           currentStep = 4;
                           updateWizard();
                        }
                    }
                );
                return;
            }

            saveDraftBtn.disabled = true;
            saveDraftBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';

            try {
                const formData = new FormData(form);
                formData.append('save_draft', 'true');
                let postUrl = window.location.pathname;
                if (!postUrl.endsWith('/')) postUrl += '/';

                const response = await fetch(postUrl, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    throw new Error("System configuration error: Server returned HTML instead of JSON. Please try refreshing the page.");
                }

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

    // --- Visibility Toggle Logic ---
    const visibilityBtn = document.getElementById('visibility-toggle-btn');
    if (visibilityBtn && initialData && initialData.slug) {
        visibilityBtn.addEventListener('click', () => {
            const currentState = visibilityBtn.dataset.currentState; // 'active' or 'hidden'
            const toggleInput = document.getElementById('id_toggle_visibility');
            const now = new Date();
            const cooldownMs = 8 * 60 * 60 * 1000; // 8 hours

            if (currentState === 'active') {
                // Check Start Cooldown
                if (initialData.last_started_at) {
                    const lastStarted = new Date(initialData.last_started_at);
                    if (now - lastStarted < cooldownMs) {
                        const remaining = cooldownMs - (now - lastStarted);
                        const hours = Math.ceil(remaining / (1000 * 60 * 60));
                        showCooldownAlert(`You can only stop this listing after 8 hours of starting it. Please wait ${hours} more hours.`, "Starting Cooldown");
                        return;
                    }
                }
                
                showDialog(
                    "Stop Listing?",
                    "This will hide your listing from the public map. You can restart it after 8 hours.",
                    'info',
                    null,
                    {
                        label: "Stop & Save",
                        callback: () => {
                            if (toggleInput) toggleInput.value = 'stop';
                            submitBtn.click();
                        }
                    }
                );
            } else {
                // Check Stop Cooldown
                if (initialData.last_stopped_at) {
                    const lastStopped = new Date(initialData.last_stopped_at);
                    if (now - lastStopped < cooldownMs) {
                        const remaining = cooldownMs - (now - lastStopped);
                        const hours = Math.ceil(remaining / (1000 * 60 * 60));
                        showCooldownAlert(`You can only start this listing after 8 hours of stopping it. Please wait ${hours} more hours.`, "Stopping Cooldown");
                        return;
                    }
                }

                showDialog(
                    "Start Listing?",
                    "This will make your listing visible to all users on the map immediately.",
                    'success',
                    null,
                    {
                        label: "Start & Save",
                        callback: () => {
                            if (toggleInput) toggleInput.value = 'start';
                            submitBtn.click();
                        }
                    }
                );
            }
        });
    }

    function showCooldownAlert(message, title) {
        const modal = document.getElementById('cooldown-modal');
        const titleEl = document.getElementById('cooldown-title');
        const msgEl = document.getElementById('cooldown-message');
        if (modal && titleEl && msgEl) {
            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.style.display = 'flex';
        }
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
            const radio = card.querySelector('input');
            if (radio) radio.checked = true;
            saveToLocal();
            renderSummary(); // Re-calculate pricing
        });
    });

    // 11. RAZORPAY & SUBMISSION
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            const container = document.querySelector('.container');
            const isPayingUpdate = (container?.dataset?.needsPayment || '').toLowerCase() === 'true';
            
            if (isPayingUpdate) {
                // If payment is needed, Save Draft behaves like the primary Pay button
                submitBtn.click();
            } else {
                // Otherwise, it's a normal save
                form.submit();
            }
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!validateCurrentStep()) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loading-spinner"></span> Saving Listing...';

            try {
                // 1. Check plan selection
                let planId = null;
                const selectedPlan = form.querySelector('[name="plan_id"]:checked');
                
                if (selectedPlan) {
                    planId = selectedPlan.value;
                } else if (hasActiveSub && currentPlanId) {
                    // Use existing plan if just paying update fee
                    planId = currentPlanId;
                }

                const isPaidUpdate = (container?.dataset?.needsPayment || '').toLowerCase() === 'true';
                
                if (!planId && !hasActiveSub) {
                    showDialog("Plan Required", "Please select a subscription plan to continue.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay & Initialize Listing';
                    return;
                }
                if (planId) {
                    console.log("Selected Plan ID:", planId);
                } else {
                    console.log("Proceeding with Update Fee only (No Plan ID needed)");
                }

                // 2. Save listing via AJAX
                const formData = new FormData(form);
                let postUrl = window.location.pathname;
                if (!postUrl.endsWith('/')) postUrl += '/';

                const response = await fetch(postUrl, {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    throw new Error("Form submission error: Server returned an unexpected HTML response. This usually happens if your session has expired. Please refresh.");
                }

                if (!response.ok) {
                    showDialog("Update Blocked", Object.values(result.errors || {e: "Error saving listing"}).join('\n'));
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Pay & Initialize Listing';
                    return;
                }

                const activeSlug = result.slug || (initialData ? initialData.slug : '');

                // 3. Redirect to Checkout or Dashboard directly if it is a pure visibility toggle
                const toggleVisibilityVal = document.getElementById('id_toggle_visibility')?.value || '';
                const isDirty = typeof isFormChanged === 'function' ? isFormChanged() : true;

                if (toggleVisibilityVal && !isDirty) {
                    submitBtn.innerHTML = '<span class="loading-spinner"></span> Updating Visibility...';
                    window.location.href = '/hosts/dashboard/';
                    return;
                }

                submitBtn.innerHTML = '<span class="loading-spinner"></span> Redirecting to Checkout...';
                
                const paymentType = selectedPlan ? 'subscription' : (isPaidUpdate ? 'update' : 'subscription');

                const checkoutParams = new URLSearchParams({
                    plan_id: planId || '',
                    coupon_code: appliedCoupon || '',
                    payment_type: paymentType
                });

                window.location.href = `/payments/checkout/${activeSlug}/?${checkoutParams.toString()}`;


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

    // 16. CUSTOM SELECT LOGIC
    const categoryCustomSelect = document.getElementById('category-custom-select');
    if (categoryCustomSelect) {
        const trigger = categoryCustomSelect.querySelector('.custom-select-trigger');
        const hiddenInput = document.getElementById('id_category_hidden');
        const options = categoryCustomSelect.querySelectorAll('.custom-option');
        const selectedText = categoryCustomSelect.querySelector('.selected-text');

        // Initial Hydration from hidden input
        window.hydrateCategoryDropdown = function() {
            if (hiddenInput && hiddenInput.value) {
                const selectedOption = categoryCustomSelect.querySelector(`.custom-option[data-value="${hiddenInput.value}"]`);
                if (selectedOption) {
                    selectedText.textContent = selectedOption.textContent.trim();
                    selectedText.classList.remove('is-placeholder');
                    options.forEach(o => o.classList.remove('selected'));
                    selectedOption.classList.add('selected');
                }
            } else {
                selectedText.classList.add('is-placeholder');
            }
        };
        window.hydrateCategoryDropdown();

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryCustomSelect.classList.toggle('open');
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = option.dataset.value;
                selectedText.textContent = option.textContent.trim();
                selectedText.classList.remove('is-placeholder');
                hiddenInput.value = val;
                
                options.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                
                categoryCustomSelect.classList.remove('open');
                categoryCustomSelect.querySelector('.custom-select-trigger').style.borderColor = 'rgba(255, 255, 255, 0.08)';
                saveToLocal();
            });
        });

        document.addEventListener('click', () => {
            categoryCustomSelect.classList.remove('open');
        });
    }

    // 17. MOBILE NUMBER VALIDATION
    const mobileField = document.getElementById('id_mobile_number');
    if (mobileField) {
        mobileField.addEventListener('input', (e) => {
            // Remove all non-digits
            let val = e.target.value.replace(/\D/g, '');
            // Limit to 10 digits
            if (val.length > 10) val = val.substring(0, 10);
            e.target.value = val;
            saveToLocal();
        });

        mobileField.addEventListener('blur', (e) => {
            const val = e.target.value;
            const container = mobileField.closest('.mobile-prefix-container');
            if (val.length > 0 && val.length < 10) {
                showDialog("Invalid Number", "Please enter exactly 10 digits for your mobile number.", 'warning');
                if (container) container.style.borderColor = 'var(--danger)';
            } else if (val.length === 10) {
                // Check for spam (all digits same)
                if (/^(\d)\1{9}$/.test(val)) {
                    showDialog("Invalid Number", "This number pattern is restricted. Please enter a valid mobile number.", 'warning');
                    e.target.value = '';
                    if (container) container.style.borderColor = 'var(--danger)';
                } else {
                    if (container) container.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }
            }
        });
    }

    // 14. INITIALIZE
    initSchedule();
    loadFromLocal();
    updateCharCount();
    updateWizard();

    // 18. INITIALIZE SUBMIT BUTTON VISIBILITY AND EVENT LISTENERS
    if (form) {
        setTimeout(() => {
            checkSubmitButtonState();
            form.querySelectorAll('input, select, textarea').forEach(el => {
                el.addEventListener('input', checkSubmitButtonState);
                el.addEventListener('change', checkSubmitButtonState);
            });
            
            // Also monitor schedule changes or services changes manually if they don't fire input/change
            const checkBtn = document.getElementById('process-protocol-btn');
            if (checkBtn) {
                checkBtn.addEventListener('click', () => {
                    setTimeout(checkSubmitButtonState, 500);
                });
            }
            
            // Monitor Leaflet Map Clicks/Drags
            if (window.map) {
                window.map.on('click', () => {
                    setTimeout(checkSubmitButtonState, 100);
                });
            }
        }, 800);
    }

    // 15. COOLDOWN TIMER (On Load)
    if (initialData && (initialData.last_stopped_at || initialData.last_started_at)) {
        const now = new Date();
        const cooldownMs = 8 * 60 * 60 * 1000;
        const lastAction = initialData.is_active_on_map 
            ? new Date(initialData.last_started_at) 
            : new Date(initialData.last_stopped_at);
        
        if (now - lastAction < cooldownMs) {
            const remaining = cooldownMs - (now - lastAction);
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            
            if (visibilityBtn) {
                visibilityBtn.disabled = true;
                visibilityBtn.title = `Cooldown active: ${hours}h ${minutes}m remaining`;
                visibilityBtn.style.opacity = '0.5';
                visibilityBtn.style.cursor = 'not-allowed';
            }
        }
    }
});
