'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TechMap from '@/components/TechMap';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import for Map to avoid SSR issues with Leaflet
const TechMapNoSSR = dynamic(() => import('@/components/TechMap'), {
    ssr: false,
    loading: () => <div className="h-96 flex items-center justify-center bg-gray-100 rounded-lg">Loading Map...</div>
});

export default function TechMapPage() {
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchVisits() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Join visits -> contracts -> locations to get coordinates
            // Note: Supabase join syntax
            const { data, error } = await supabase
                .from('amc_visits')
                .select(`
          id,
          visit_date,
          status,
          notes,
          contract:amc_contracts(
            id,
            customer_name,
            location_name,
            lat,
            lng
          )
        `)
                .eq('technician_id', user.id)
                .eq('visit_date', new Date().toISOString().split('T')[0]); // Today only? Or active?
            // For map, maybe better to show "Today" + "Pending" nearby?
            // Let's stick to "Today" for now as per spec "My Visits Today"

            if (data) {
                // Flatten for map
                const mapItems = data
                    .filter((v: any) => v.contract?.lat && v.contract?.lng) // Only with coords
                    .map((v: any) => ({
                        id: v.id,
                        customer_name: v.contract.customer_name,
                        location_name: v.contract.location_name,
                        lat: v.contract.lat,
                        lng: v.contract.lng,
                        status: v.status,
                        scheduled_time: '09:00' // Mock or add to schema if needed
                    }));
                setVisits(mapItems);
            }
            setLoading(false);
        }
        fetchVisits();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Mobile Header */}
            <div className="bg-white border-b px-4 py-3 flex items-center sticky top-0 z-10 shadow-sm">
                <Link href="/tech" className="mr-3 p-1 rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <h1 className="text-lg font-bold text-gray-900">Today's Route</h1>
            </div>

            <div className="flex-1 p-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">Loading route...</div>
                ) : visits.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-500 mb-4">No visits with location data found for today.</p>
                        <Link href="/tech" className="text-blue-600 font-medium">Back to List</Link>
                    </div>
                ) : (
                    <TechMapNoSSR visits={visits} />
                )}
            </div>
        </div>
    );
}
