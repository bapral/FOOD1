let map, userMarker, manualMarker, polyline;
let foodData = [];
let currentState = 'AUTO_GPS'; // AUTO_GPS, MANUAL_WAIT, LOCKED
let userCoords = null; 
let activeCoords = null;

const UI = {
    status: document.getElementById('status-display'),
    panel: document.getElementById('info-panel'),
    btnLocate: document.getElementById('btn-locate'),
    btnNearest: document.getElementById('btn-nearest'),
    topHeader: document.getElementById('top-header'),
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
    const iconHtml = `<svg viewBox="0 0 24 24" width="36" height="36"><path fill="${color}" stroke="white" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
    return L.divIcon({ className: 'custom-pin', html: iconHtml, iconSize: [36, 36], iconAnchor: [18, 36] });
}

function updateVisualMarkers() {
    if (userCoords && currentState === 'AUTO_GPS') {
        if (!userMarker) userMarker = L.marker(userCoords, { icon: createPinIcon('#EE5253') }).addTo(map);
        else userMarker.setLatLng(userCoords).addTo(map);
    } else if (userMarker) map.removeLayer(userMarker);

    if (activeCoords && currentState === 'LOCKED') {
        if (!manualMarker) manualMarker = L.marker(activeCoords, { icon: createPinIcon('#192a56') }).addTo(map);
        else manualMarker.setLatLng(activeCoords).addTo(map);
    } else if (manualMarker) map.removeLayer(manualMarker);
}

function renderMarkers() {
    const foodIconSvg = `<svg viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/></svg>`;
    foodData.forEach(item => {
        if (item.lat && item.lng) {
            L.marker([item.lat, item.lng], {
                icon: L.divIcon({ className: 'food-marker-icon', html: foodIconSvg, iconSize: [24, 24], iconAnchor: [12, 12] })
            }).addTo(map).on('click', () => showDetails(item, true, '#e67e22'));
        }
    });
}

function getDistance(coords1, coords2) {
    const [lat1, lon1] = coords1, [lat2, lon2] = coords2;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showDetails(item, shouldFit, lineColor) {
    document.getElementById('store-name').innerText = item.name;
    document.getElementById('store-address').innerText = item.address;
    document.getElementById('store-hours').innerText = item.hours || "暫無營業時間";
    document.getElementById('btn-call').href = `tel:${item.phone}`;
    document.getElementById('btn-link').href = item.link;

    if (activeCoords) {
        const dist = getDistance(activeCoords, [item.lat, item.lng]);
        document.getElementById('store-distance').innerText = dist.toFixed(2) + " km";
        document.getElementById('store-time').innerText = `約 ${Math.round(dist / 5 * 60)} 分鐘`;
        drawNavigationLine(activeCoords, [item.lat, item.lng], lineColor, shouldFit);
    }

    UI.panel.classList.remove('hidden');
    setTimeout(() => UI.panel.classList.add('visible'), 10);
}

function drawNavigationLine(start, end, color, shouldFit) {
    if (polyline) map.removeLayer(polyline);
    polyline = L.layerGroup().addTo(map);
    L.polyline([start, end], { color: color, weight: 10, opacity: 0.2 }).addTo(polyline);
    L.polyline([start, end], { color: color, weight: 4, opacity: 0.8, dashArray: '10, 15' }).addTo(polyline);
    L.polyline([start, end], { color: '#ffffff', weight: 2, opacity: 0.5 }).addTo(polyline);
    if (shouldFit) map.fitBounds(L.latLngBounds([start, end]), { padding: [100, 100] });
}

function onMapClick(e) {
    if (currentState === 'MANUAL_WAIT') {
        activeCoords = [e.latlng.lat, e.latlng.lng];
        currentState = 'LOCKED';
        updateUI();
        updateVisualMarkers();
    }
}

function updateUI() {
    const texts = {
        'AUTO_GPS': '自動 GPS 定位',
        'MANUAL_WAIT': '手動模式(請點選位置)',
        'LOCKED': '手動模式(已鎖定)'
    };
    if (UI.status) UI.status.innerText = texts[currentState];
    if (UI.map) UI.map.style.cursor = currentState === 'MANUAL_WAIT' ? 'crosshair' : '';
}

UI.btnLocate.addEventListener('click', () => {
    currentState = 'AUTO_GPS';
    if (userCoords) activeCoords = userCoords;
    updateUI();
    updateVisualMarkers();
    if (userCoords) map.setView(userCoords, 16);
});

UI.btnNearest.addEventListener('click', () => {
    if (!activeCoords || foodData.length === 0) return;
    let min = Infinity, nearest = null;
    foodData.forEach(item => {
        const d = getDistance(activeCoords, [item.lat, item.lng]);
        if (d < min) { min = d; nearest = item; }
    });
    if (nearest) showDetails(nearest, true, '#4cd137');
});

UI.topHeader.addEventListener('click', () => {
    currentState = 'MANUAL_WAIT';
    updateUI();
    updateVisualMarkers();
});

window.onload = initMap;
