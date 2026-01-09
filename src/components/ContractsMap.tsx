'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
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
                        </Marker >
                    ) : null
                ))
}
            </MapContainer >
        </div >
    );
}
