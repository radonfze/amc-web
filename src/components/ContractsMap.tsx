'use client';

import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';

// Fix for default marker icon missing
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- Icons ---
const ICON_SIZE: [number, number] = [35, 57];
const ICON_ANCHOR: [number, number] = [17, 57];
const POPUP_ANCHOR: [number, number] = [1, -45];
const SHADOW_SIZE: [number, number] = [50, 50];

const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
    shadowSize: SHADOW_SIZE
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
    shadowSize: SHADOW_SIZE
});

const yellowIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
    shadowSize: SHADOW_SIZE
});

const redCrossIcon = new L.DivIcon({
    className: '', 
    html: `
        <div style="position: relative; width: 35px; height: 57px;">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" style="width: 35px; height: 57px; position: absolute; top:0; left:0;" />
            <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); color: white; font-weight: 900; font-size: 16px; text-shadow: 0px 0px 2px black; line-height: 1;">❌</div>
        </div>
    `,
    iconSize: ICON_SIZE,
    iconAnchor: ICON_ANCHOR,
    popupAnchor: POPUP_ANCHOR,
});


// --- Child Component to handle Map FlyTo ---
function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

export default function ContractsMap({ contracts }: { contracts: any[] }) {
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
    
    // Filters State
    const [statusFilters, setStatusFilters] = useState({
        green: true,  // < 80 days
        yellow: true, // 80-90 days
        red: true,    // > 90 days
        expired: true // Expired
    });
    const [locationFilter, setLocationFilter] = useState('');

    // Handle "My Location"
    const handleMyLocation = () => {
        if (!navigator.geolocation) return alert('GPS not supported');
        navigator.geolocation.getCurrentPosition(
            (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
            (err) => alert("GPS Error: " + err.message)
        );
    };

    // Filter Logic
    const filteredContracts = contracts.filter(c => {
        if (!c.lat || !c.lng) return false;

        // 1. Location Filter
        if (locationFilter) {
            const loc = (c.location_name || '').toLowerCase();
            const area = (c.customer_area || '').toLowerCase(); // Assuming area exists in view or similar
            const search = locationFilter.toLowerCase();
            if (!loc.includes(search) && !area.includes(search)) return false;
        }

        // 2. Status Filter
        let category: 'green' | 'yellow' | 'red' | 'expired' = 'green';
        
        let daysSinceLast = 0;
        if (c.last_effective_visit_date) {
            try {
                const last = new Date(c.last_effective_visit_date);
                const now = new Date();
                const diffTime = now.getTime() - last.getTime();
                daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            } catch (e) {}
        }

        const isExpired = c.status === 'expired' || (c.end_date && new Date(c.end_date) < new Date());

        if (isExpired) category = 'expired';
        else if (daysSinceLast > 90) category = 'red';
        else if (daysSinceLast > 80) category = 'yellow';
        else category = 'green';

        return statusFilters[category];
    });

    return (
        <div className="h-full w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0 relative flex flex-col">
            
            {/* Filter Controls Overlay */}
            <div className="absolute top-2 left-14 z-[500] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-gray-200 max-w-sm">
                <div className="space-y-2 text-xs">
                    <input 
                        placeholder="Filter by Location/Area..." 
                        className="w-full border rounded px-2 py-1"
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                         <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={statusFilters.green} onChange={e => setStatusFilters(prev => ({...prev, green: e.target.checked}))} />
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> Active
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={statusFilters.yellow} onChange={e => setStatusFilters(prev => ({...prev, yellow: e.target.checked}))} />
                            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/> 80+ Days
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={statusFilters.red} onChange={e => setStatusFilters(prev => ({...prev, red: e.target.checked}))} />
                            <span className="w-2 h-2 rounded-full bg-red-600 inline-block"/> 90+ Days
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={statusFilters.expired} onChange={e => setStatusFilters(prev => ({...prev, expired: e.target.checked}))} />
                            <span className="font-bold text-red-600">X</span> Expired
                        </label>
                    </div>
                </div>
            </div>

            {/* GPS Button Overlay */}
            <button 
                onClick={handleMyLocation}
                className="absolute top-20 left-3 z-[500] bg-white p-2 rounded shadow-md hover:bg-gray-100 border border-gray-300"
                title="Go to My Location"
            >
                📍
            </button>


            <MapContainer center={[25.1985, 55.2797]} zoom={9} className="flex-1 w-full h-full" style={{ minHeight: '600px' }}>
                <MapController center={mapCenter} />
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Google Hybrid (Detailed)">
                        <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="Google Maps" maxZoom={20} />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Google Streets">
                        <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="Google Maps" maxZoom={20} />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {filteredContracts.map((c) => {
                     let daysSinceLast = 0;
                     if (c.last_effective_visit_date) {
                         const last = new Date(c.last_effective_visit_date);
                         const now = new Date();
                         daysSinceLast = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
                     }

                     const isExpired = c.status === 'expired' || (c.end_date && new Date(c.end_date) < new Date());
                     
                     let markerIcon: L.Icon | L.DivIcon = greenIcon;
                     if (isExpired) markerIcon = redCrossIcon;
                     else if (daysSinceLast > 90) markerIcon = redIcon;
                     else if (daysSinceLast > 80) markerIcon = yellowIcon;
                     
                     return (
                        <Marker key={c.id} position={[c.lat, c.lng]} icon={markerIcon}>
                            <Popup>
                                <div className="text-sm min-w-[200px]">
                                    <b className="text-gray-900 block border-b pb-1 mb-1">{c.customer_name}</b>
                                    <span className="text-gray-600 block mb-2">{c.location_name}</span>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2 bg-gray-50 p-2 rounded">
                                        <div><span className="text-gray-500 block">Use Google Check</span><span className="font-semibold text-gray-800">{c.last_effective_visit_date || 'N/A'}</span></div>
                                        <div><span className="text-gray-500 block">Days Since</span><span className={`font-bold ${daysSinceLast > 80 ? 'text-red-600' : 'text-green-600'}`}>{daysSinceLast} days</span></div>
                                    </div>
                                    <div className="flex gap-1 mb-3">
                                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.cycle_status === 'overdue' ? 'bg-red-100 text-red-700' : c.cycle_status === 'due' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.cycle_status ? c.cycle_status.toUpperCase() : 'OK'}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isExpired ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}`}>{isExpired ? 'EXPIRED' : 'ACTIVE'}</span>
                                    </div>
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-blue-600 text-white py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition">📍 Get Directions</a>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
