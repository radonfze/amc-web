'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Next.js/Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position}>
            <Popup>Selected Location</Popup>
        </Marker>
    );
}

interface LocationPickerProps {
    initialLat?: number;
    initialLng?: number;
    onSelect: (lat: number, lng: number) => void;
    onCancel: () => void;
}

export default function LocationPicker({ initialLat, initialLng, onSelect, onCancel }: LocationPickerProps) {
    // Default to Dubai if no initial coords
    const defaultPosition: [number, number] = [initialLat || 25.2048, initialLng || 55.2708];
    const [position, setPosition] = useState<[number, number]>(defaultPosition);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col h-[600px]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Pick Location</h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="flex-1 relative">
                    <MapContainer
                        center={defaultPosition}
                        zoom={13}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker position={position} setPosition={setPosition} />
                    </MapContainer>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        Selected: <span className="font-mono font-bold">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
                    </div>
                    <div className="space-x-2">
                        <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Cancel</button>
                        <button
                            onClick={() => onSelect(position[0], position[1])}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                        >
                            Confirm Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
