'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { supabase } from '@/lib/supabaseClient';
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

export default function ContractsMap({ contracts }: { contracts: any[] }) {
    // Center roughly on UAE (or calculate from contracts)
    // Defaulting to Dubai/RAK approximate center
    const center: [number, number] = [25.1985, 55.2797];

    if (contracts.length > 0 && contracts[0].lat) {
        // center = [contracts[0].lat, contracts[0].lng]
    }

    return (
        <div className="h-full w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm z-0 relative">
            <MapContainer center={center} zoom={9} className="w-full h-full" style={{ minHeight: '600px' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {contracts.map((c) => (
                    c.lat && c.lng ? (
                        <Marker key={c.id} position={[c.lat, c.lng]}>
                            <Popup>
                                <div className="text-sm">
                                    <b>{c.customer_name}</b>
                                    <br />
                                    {c.location_name}
                                    <br />
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${c.cycle_status === 'overdue' ? 'bg-red-100 text-red-700' :
                                            c.cycle_status === 'due' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {c.cycle_status.toUpperCase()}
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    ) : null
                ))}
            </MapContainer>
        </div>
    );
}
