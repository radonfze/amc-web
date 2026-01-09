'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useRouter } from 'next/navigation';

// Fix for default marker icon missing in Leaflet + Next.js/Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface VisitMapItem {
    id: number;
    customer_name: string;
    location_name: string;
    lat: number;
    lng: number;
    status: string;
    scheduled_time: string;
}

export default function TechMap({ visits }: { visits: VisitMapItem[] }) {
    const router = useRouter();
    // Default center (Dubai)
    const defaultCenter: [number, number] = [25.1985, 55.2797];
    const center = visits.length > 0 && visits[0].lat ? [visits[0].lat, visits[0].lng] as [number, number] : defaultCenter;

    return (
        <div className="h-[calc(100vh-140px)] w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0 relative">
            <MapContainer center={center} zoom={11} className="w-full h-full">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Current Location Marker (Mock for now, could use Geolocation API) */}
                {/* 
                <Marker position={currentPos} icon={blueIcon}>
                   <Popup>You are here</Popup>
                </Marker> 
                */}

                {visits.map((v) => (
                    <Marker key={v.id} position={[v.lat, v.lng]}>
                        <Popup>
                            <div className="min-w-[150px]">
                                <h4 className="font-bold text-sm mb-1">{v.customer_name}</h4>
                                <p className="text-xs text-gray-600 mb-2">{v.location_name}</p>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-mono bg-gray-100 px-1 rounded">{v.scheduled_time || 'Anytime'}</span>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded
                                        ${v.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                                     `}>
                                        {v.status}
                                    </span>
                                </div>
                                <button
                                    onClick={() => router.push(`/tech/visit/${v.id}`)}
                                    className="w-full block text-center bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700"
                                >
                                    View Visit
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
