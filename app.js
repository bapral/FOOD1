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

function updateVisualMarkers() {
    // 1. Handle Red GPS Dot (User Marker)
    if (userCoords && currentState === 'AUTO_GPS') {
        if (!userMarker) {
            userMarker = L.circleMarker(userCoords, {
                radius: 10,
                fillColor: "#EE5253",
                color: "white",
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map);
        } else {
            userMarker.setLatLng(userCoords).addTo(map);
        }
    } else if (userMarker) {
        map.removeLayer(userMarker);
    }

    // 2. Handle Blue Manual Pin
    if (activeCoords && currentState === 'LOCKED') {
        if (!manualMarker) {
            manualMarker = L.marker(activeCoords, {
                icon: L.divIcon({
                    className: 'manual-pin',
                    html: '<div style="font-size: 30px; margin-top: -20px;">📍</div>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 5]
                })
            }).addTo(map);
        } else {
            manualMarker.setLatLng(activeCoords).addTo(map);
        }
    } else if (manualMarker) {
        map.removeLayer(manualMarker);
    }
}

function onMapClick(e) {
    if (currentState === 'MANUAL_WAIT') {
        activeCoords = [e.latlng.lat, e.latlng.lng];
        currentState = 'LOCKED';
        updateBadge();
        updateVisualMarkers();
        // Calculate nearest if needed, or just lock
    }
}

function showDetails(item) {
    // When clicking a store, we lock the view but keep the current positioning mode
    document.getElementById('store-name').innerText = item.name;
    document.getElementById('store-address').innerText = item.address;
    document.getElementById('store-hours').innerText = item.hours || "暫無營業時間";
    document.getElementById('btn-call').href = `tel:${item.phone}`;
    document.getElementById('btn-link').href = item.link;
    
    UI.panel.classList.remove('hidden');
    setTimeout(() => UI.panel.classList.add('visible'), 10);

    // Draw Navigation Line from "Active" coordinates
    if (activeCoords && item.lat) {
        if (polyline) map.removeLayer(polyline);
        polyline = L.polyline([activeCoords, [item.lat, item.lng]], {
            color: '#192a56',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(map);
        
        map.fitBounds(polyline.getBounds(), { padding: [100, 100] });
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
