document.addEventListener('DOMContentLoaded', () => {
    // Map Init
    const mapContainer = document.getElementById('detail-map');
    if (mapContainer) {
        const lat = parseFloat(mapContainer.getAttribute('data-lat'));
        const lng = parseFloat(mapContainer.getAttribute('data-lng'));
        const name = mapContainer.getAttribute('data-name');

        const map = L.map('detail-map', { zoomControl: false }).setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OSM'
        }).addTo(map);

        const blueIcon = L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1" width="36" height="36"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1"/></svg>'),
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });

        L.marker([lat, lng], { icon: blueIcon }).addTo(map).bindPopup(`<b>${name}</b>`).openPopup();
    }

    // Review Filtering Logic
    const filterPills = document.querySelectorAll('.filter-pill');
    const reviewItems = document.querySelectorAll('#reviews-container .review-item');

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const filterValue = pill.getAttribute('data-filter');

            reviewItems.forEach(item => {
                if (filterValue === 'all') {
                    item.style.display = 'block';
                } else {
                    const rating = item.getAttribute('data-rating');
                    if (rating === filterValue) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });
    });

    // Edit Review Logic (Disable if no changes or cooldown)
    const editForm = document.getElementById('edit-review-form');
    if (editForm) {
        const origComment = editForm.getAttribute('data-orig-comment').trim().toLowerCase();
        const origRating = editForm.getAttribute('data-orig-rating');
        const updatedAtStr = editForm.getAttribute('data-updated-at');
        
        const textarea = document.getElementById('edit-review-textarea');
        const ratingInputs = editForm.querySelectorAll('input[name="rating"]');
        const updateBtn = document.getElementById('update-review-btn');
        const cooldownMsg = document.getElementById('update-cooldown-msg');

        const COOLDOWN_MINUTES = 2; // Server load protection

        function checkFormState() {
            const currentComment = textarea.value.trim().toLowerCase();
            let currentRating = origRating;
            ratingInputs.forEach(radio => {
                if (radio.checked) currentRating = radio.value;
            });

            const isChanged = (currentComment !== origComment) || (currentRating !== origRating);

            const lastUpdated = new Date(updatedAtStr).getTime();
            const now = Date.now();
            const minutesElapsed = (now - lastUpdated) / (1000 * 60);

            if (!isChanged) {
                updateBtn.disabled = true;
                cooldownMsg.style.display = 'none';
            } else if (minutesElapsed < COOLDOWN_MINUTES) {
                updateBtn.disabled = true;
                const waitTime = Math.ceil(COOLDOWN_MINUTES - minutesElapsed);
                cooldownMsg.textContent = `Please wait ${waitTime} min before updating again.`;
                cooldownMsg.style.display = 'inline-block';
            } else {
                updateBtn.disabled = false;
                cooldownMsg.style.display = 'none';
            }
        }

        textarea.addEventListener('input', checkFormState);
        ratingInputs.forEach(radio => radio.addEventListener('change', checkFormState));
        
        checkFormState();
    // Service Search Logic
    const serviceSearch = document.getElementById('service-search');
    const clearSearchBtn = document.getElementById('clear-service-search');
    const categoryBlocks = document.querySelectorAll('.category-block');

    if (serviceSearch) {
        serviceSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            // Show/Hide Clear Button
            clearSearchBtn.style.display = query.length > 0 ? 'flex' : 'none';

            categoryBlocks.forEach(block => {
                const categoryHeader = block.querySelector('.category-header h3');
                const categoryName = categoryHeader ? categoryHeader.textContent.toLowerCase() : '';
                const serviceItems = block.querySelectorAll('.service-item');
                
                // Case 1: Category name matches query
                if (query.length >= 2 && categoryName.includes(query)) {
                    block.style.display = 'block';
                    serviceItems.forEach(item => item.style.display = 'flex');
                    return;
                }

                // Case 2: Individual services match query
                let blockHasMatch = false;
                serviceItems.forEach(item => {
                    const serviceName = item.querySelector('h4').textContent.toLowerCase();
                    if (serviceName.includes(query)) {
                        item.style.display = 'flex';
                        blockHasMatch = true;
                    } else {
                        item.style.display = 'none';
                    }
                });

                // Show block only if it has matching services
                block.style.display = (query === '' || blockHasMatch) ? 'block' : 'none';
            });
        });

        clearSearchBtn.addEventListener('click', () => {
            serviceSearch.value = '';
            serviceSearch.dispatchEvent(new Event('input'));
            serviceSearch.focus();
        });
    }
});

// Global function for address copying
window.copyAddress = function() {
    const mapContainer = document.getElementById('detail-map');
    if (mapContainer) {
        const addr = mapContainer.getAttribute('data-addr');
        navigator.clipboard.writeText(addr);
        alert('Address copied to clipboard!');
    }
};
