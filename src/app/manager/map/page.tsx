'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Dynamic import for Leaflet to avoid SSR issues
const ContractsMap = dynamic(() => import('@/components/ContractsMap'), {
    ssr: false,
    loading: () => <div className="h-96 w-full flex items-center justify-center bg-gray-100 text-gray-400">Loading Map...</div>
});

export default function MapPage() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadContracts();
    }, []);

    async function loadContracts() {
        const { data } = await supabase.from('amc_contracts_view').select('*');
        if (data) setContracts(data);
        setLoading(false);
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Contracts Map</h1>
            <div className="h-[70vh]">
                <ContractsMap contracts={contracts} />
            </div>
        </div>
    );
}
