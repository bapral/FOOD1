let map, userMarker, targetMarker, polyline;
let foodData = [];
let currentState = 'AUTO_GPS'; // AUTO_GPS, MANUAL_SELECT, LOCKED
let userCoords = null;

const UI = {
    badge: document.getElementById('status-badge'),
    panel: document.getElementById('info-panel'),
    btnLocate: document.getElementById('btn-locate'),
    btnManual: document.getElementById('btn-manual')
};

function initMap() {
    // Default to Taiwan center
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([23.6, 121], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    map.on('click', onMapClick);
    
    // Load Data
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
                updateUserMarker(userCoords);
                if (currentState === 'AUTO_GPS') {
                    map.setView(userCoords, 16);
                }
            },
            (err) => console.error("GPS Error:", err),
            { enableHighAccuracy: true }
        );
    }
}

function updateUserMarker(coords) {
    if (!userMarker) {
        userMarker = L.circleMarker(coords, {
            radius: 8,
            fillColor: "#EE5253",
            color: "white",
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng(coords);
    }
}

function renderMarkers() {
    foodData.forEach(item => {
        if (item.lat && item.lng) {
            const marker = L.marker([item.lat, item.lng], {
                icon: L.divIcon({
                    className: 'food-marker',
                    html: `<div style="background:#FF9F43; width:12px; height:12px; border-radius:50%; border:2px solid #2F3640;"></div>`
                })
            }).addTo(map);

            marker.on('click', () => showDetails(item));
        }
    });
}

function showDetails(item) {
    currentState = 'LOCKED';
    updateBadge();
    
    document.getElementById('store-name').innerText = item.name;
    document.getElementById('store-address').innerText = item.address;
    document.getElementById('store-hours').innerText = item.hours || "暫無營業時間";
    document.getElementById('btn-call').href = `tel:${item.phone}`;
    document.getElementById('btn-link').href = item.link;
    
    UI.panel.classList.remove('hidden');
    setTimeout(() => UI.panel.classList.add('visible'), 10);

    // Draw Navigation Line
    if (userCoords && item.lat) {
        if (polyline) map.removeLayer(polyline);
        polyline = L.polyline([userCoords, [item.lat, item.lng]], {
            color: '#FF9F43',
            weight: 4,
            opacity: 0.6,
            dashArray: '10, 10'
        }).addTo(map);
        
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
}

function onMapClick(e) {
    if (currentState === 'MANUAL_SELECT') {
        userCoords = [e.latlng.lat, e.latlng.lng];
        updateUserMarker(userCoords);
        currentState = 'LOCKED';
        updateBadge();
    }
}

function updateBadge() {
    UI.badge.innerText = currentState;
}

UI.btnLocate.addEventListener('click', () => {
    currentState = 'AUTO_GPS';
    updateBadge();
    if (userCoords) map.setView(userCoords, 16);
});

UI.btnManual.addEventListener('click', () => {
    currentState = 'MANUAL_SELECT';
    updateBadge();
    alert("請在畫面上點選您的位置");
});

window.onload = initMap;
