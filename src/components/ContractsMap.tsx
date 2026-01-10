'use client';

import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon missing in Leaflet + Next.js/Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [35, 57], // ~40% bigger than standard
    iconAnchor: [17, 57],
    popupAnchor: [1, -45],
    shadowSize: [50, 50]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const orangeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const yellowIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export default function ContractsMap({ contracts }: { contracts: any[] }) {
    // Center roughly on UAE (or calculate from contracts)
    const center: [number, number] = [25.1985, 55.2797];

    return (
        <div className="h-full w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0 relative">
            <MapContainer center={center} zoom={9} className="w-full h-full" style={{ minHeight: '600px' }}>
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Google Hybrid (Detailed)">
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            attribution="Google Maps"
                            maxZoom={20}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Google Streets">
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            attribution="Google Maps"
                            maxZoom={20}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="OpenStreetMap">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {contracts.map((c) => {
                     if (!c.lat || !c.lng) return null;

                     let daysSinceLast = 0;
                     if (c.last_effective_visit_date) {
                        try {
                             // Use native date math to avoid date-fns dependency issues if persistent
                             const last = new Date(c.last_effective_visit_date);
                             const now = new Date();
                             const diffTime = now.getTime() - last.getTime();
                             daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        } catch (e) { console.error(e); }
                     }

                     // Status Logic
                     // 1. Expired (Contract ended or status is expired)
                     const isExpired = c.status === 'expired' || (c.end_date && new Date(c.end_date) < new Date());
                     
                     // 2. Overdue Visit (>90 days orange, >80 days yellow)
                     let markerIcon = greenIcon;
                     if (isExpired) {
                        markerIcon = redIcon;
                     } else if (daysSinceLast > 90) {
                        markerIcon = orangeIcon;
                     } else if (daysSinceLast > 80) {
                        markerIcon = yellowIcon;
                     }
                     
                     return (
                        <Marker 
                            key={c.id} 
                            position={[c.lat, c.lng]} 
                            icon={markerIcon}
                        >
                            <Popup>
                                <div className="text-sm min-w-[200px]">
                                    <b className="text-gray-900 block border-b pb-1 mb-1">{c.customer_name}</b>
                                    <span className="text-gray-600 block mb-2">{c.location_name}</span>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2 bg-gray-50 p-2 rounded">
                                        <div>
                                            <span className="text-gray-500 block">Use Google Check</span>
                                            <span className="font-semibold text-gray-800">{c.last_effective_visit_date || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block">Days Since</span>
                                            <span className={`font-bold ${daysSinceLast > 80 ? 'text-red-600' : 'text-green-600'}`}>{daysSinceLast} days</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-1 mb-3">
                                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            c.cycle_status === 'overdue' ? 'bg-red-100 text-red-700' :
                                            c.cycle_status === 'due' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {c.cycle_status ? c.cycle_status.toUpperCase() : 'OK'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            isExpired ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'
                                        }`}>
                                            {isExpired ? 'EXPIRED' : 'ACTIVE'}
                                        </span>
                                    </div>
                                    
                                    <a 
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full text-center bg-blue-600 text-white py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition"
                                    >
                                        📍 Get Directions
                                    </a>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
