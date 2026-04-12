let map, userMarker, manualMarker, polyline;
let foodData = [];
let currentState = 'AUTO_GPS'; // AUTO_GPS, MANUAL_WAIT, LOCKED
let userCoords = null; // Real GPS coords
let activeCoords = null; // The coords used for distance/navigation

const UI = {
    badge: document.getElementById('status-badge'),
    panel: document.getElementById('info-panel'),
    btnLocate: document.getElementById('btn-locate'),
    btnManual: document.getElementById('btn-manual'),
    map: document.getElementById('map')
};

function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([23.6, 121], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    map.on('click', onMapClick);
    
    fetch('food_data.json')
        .then(res => res.json())
        .then(data => {
            foodData = data;
            renderMarkers();
        });

    startLocationWatch();
}

function startLocationWatch() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                userCoords = [latitude, longitude];
                
                // Only update activeCoords if in Auto GPS mode
                if (currentState === 'AUTO_GPS') {
                    activeCoords = userCoords;
                    map.setView(userCoords, 16);
                }
                updateVisualMarkers();
            },
            (err) => console.error("GPS Error:", err),
            { enableHighAccuracy: true }
        );
    }
}

function createPinIcon(color) {
    const iconHtml = `
        <div style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));">
            <svg viewBox="0 0 24 24" width="36" height="36">
                <path fill="${color}" stroke="white" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
        </div>`;
    return L.divIcon({
        className: 'custom-pin',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
    });
}

function updateVisualMarkers() {
    // 1. Handle Red GPS Pin (Auto Mode)
    if (userCoords && currentState === 'AUTO_GPS') {
        if (!userMarker) {
            userMarker = L.marker(userCoords, { icon: createPinIcon('#EE5253') }).addTo(map);
        } else {
            userMarker.setLatLng(userCoords).addTo(map);
        }
    } else if (userMarker) {
        map.removeLayer(userMarker);
    }

    // 2. Handle Blue Manual Pin (Locked Mode)
    if (activeCoords && currentState === 'LOCKED') {
        if (!manualMarker) {
            manualMarker = L.marker(activeCoords, { icon: createPinIcon('#192a56') }).addTo(map);
        } else {
            manualMarker.setLatLng(activeCoords).addTo(map);
        }
    } else if (manualMarker) {
        map.removeLayer(manualMarker);
    }
}

// Haversine formula to calculate distance in km
function getDistance(coords1, coords2) {
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findNearestStore() {
    if (!activeCoords || foodData.length === 0) return;

    let minDest = Infinity;
    let nearest = null;

    foodData.forEach(item => {
        if (item.lat && item.lng) {
            const dist = getDistance(activeCoords, [item.lat, item.lng]);
            if (dist < minDest) {
                minDest = dist;
                nearest = item;
            }
        }
    });

    if (nearest) {
        console.log(`Nearest store: ${nearest.name} (${minDest.toFixed(2)} km)`);
        showDetails(nearest, false); // Show details but don't force re-centering if in Auto GPS
    }
}

function onMapClick(e) {
    if (currentState === 'MANUAL_WAIT') {
        activeCoords = [e.latlng.lat, e.latlng.lng];
        currentState = 'LOCKED';
        updateBadge();
        updateVisualMarkers();
        findNearestStore(); // Find nearest after manual lock
    }
}

function showDetails(item, shouldFitBounds = true) {
    // When clicking a store, we lock the view but keep the current positioning mode
    document.getElementById('store-name').innerText = item.name;
    document.getElementById('store-address').innerText = item.address;
    document.getElementById('store-hours').innerText = item.hours || "暫無營業時間";
    document.getElementById('btn-call').href = `tel:${item.phone}`;
    document.getElementById('btn-link').href = item.link;
    
    UI.panel.classList.remove('hidden');
    setTimeout(() => UI.panel.classList.add('visible'), 10);

    // Draw Navigation Line with Dual-Layer Glow (TOILETS Style)
    if (activeCoords && item.lat) {
        if (polyline) map.removeLayer(polyline);
        
        // Group multiple lines into one layer group for easier removal
        polyline = L.layerGroup().addTo(map);

        const latlngs = [activeCoords, [item.lat, item.lng]];

        // 1. Bottom Layer: Wide Glow
        L.polyline(latlngs, {
            color: '#192a56',
            weight: 10,
            opacity: 0.3,
            lineCap: 'round'
        }).addTo(polyline);

        // 2. Middle Layer: Main Stroke
        L.polyline(latlngs, {
            color: '#192a56',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 15',
            lineCap: 'round'
        }).addTo(polyline);

        // 3. Top Layer: Core Glow (Inner light)
        L.polyline(latlngs, {
            color: '#fbc531',
            weight: 2,
            opacity: 0.5,
            lineCap: 'round'
        }).addTo(polyline);
        
        if (shouldFitBounds) {
            const bounds = L.latLngBounds(latlngs);
            map.fitBounds(bounds, { padding: [100, 100] });
        }
    }
}

function updateBadge() {
    UI.badge.innerText = currentState.replace('_', ' ');
    // Change UI feedback based on state
    if (currentState === 'MANUAL_WAIT') {
        UI.map.style.cursor = 'crosshair';
        UI.btnManual.style.background = '#EE5253'; // Highlight button
    } else {
        UI.map.style.cursor = '';
        UI.btnManual.style.background = '';
    }
}

UI.btnLocate.addEventListener('click', () => {
    currentState = 'AUTO_GPS';
    if (userCoords) activeCoords = userCoords;
    updateBadge();
    updateVisualMarkers();
    if (userCoords) map.setView(userCoords, 16);
});

UI.btnManual.addEventListener('click', () => {
    currentState = 'MANUAL_WAIT';
    updateBadge();
    updateVisualMarkers(); // This will hide the red dot
});

window.onload = initMap;
