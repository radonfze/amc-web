'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { haversine } from '@/lib/haversine';
import VisitForm from '@/components/VisitForm';
import Link from 'next/link';

type ContractDetail = {
    id: number;
    customer_name: string;
    location_name: string;
    area: string | null;
    gov_license_no: string | null;
    lat: number;
    lng: number;
    last_effective_visit_date: string | null;
    next_due_date: string | null;
    cycle_status: string;
};

export default function VisitDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [contract, setContract] = useState<ContractDetail | null>(null);
    const [mode, setMode] = useState<'none' | 'normal' | 'closed'>('none');
    const [gps, setGps] = useState<{
        lat: number;
        lng: number;
        distance: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    // Safely handle params.id whether string or array (though simple routing implies string)
    const id = Number(params.id);

    useEffect(() => {
        if (id) {
            loadContract();
        }
    }, [id]);

    async function loadContract() {
        setLoading(true);
        const { data, error } = await supabase
            .from('amc_contracts_view')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setContract(data as ContractDetail);
        } else {
            console.error(error);
        }
        setLoading(false);
    }

    function startVisit(type: 'normal' | 'closed') {
        if (!contract) return;

        if (!navigator.geolocation) {
            alert('GPS not supported');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const distance = haversine(
                    latitude,
                    longitude,
                    contract.lat,
                    contract.lng
                );

                if (distance > 20) {
                    alert(
                        `You are too far from the site.\nDistance: ${distance.toFixed(
                            1
                        )} m (max 20 m allowed).`
                    );
                    return;
                }

                setGps({ lat: latitude, lng: longitude, distance });
                setMode(type);
            },
            (err) => {
                console.error(err);
                alert('GPS permission is required to start a visit.');
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    }

    async function handleSubmitted() {
        router.push('/tech');
    }

    if (loading) {
        return (
            <div className="flex justify-center py-10 text-gray-500">
                Loading contract details...
            </div>
        )
    }

    if (!contract) {
        return <p className="text-center py-10 text-red-500">Contract not found or error loading.</p>;
    }

    return (
        <div className="space-y-4 text-sm pb-10">
            <Link href="/tech" className="text-blue-600 mb-2 inline-block">← Back</Link>

            <section className="bg-white rounded shadow p-4 border border-gray-100">
                <div className="font-bold text-lg text-gray-900 mb-1">
                    {contract.customer_name}
                </div>
                <div className="font-medium text-gray-700 mb-2">
                    {contract.location_name}
                </div>
                <div className="text-gray-600 mb-3">
                    {contract.area} • License: {contract.gov_license_no || 'N/A'}
                </div>

                <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 space-y-1">
                    <div>
                        <span className="font-semibold">Last Effective Visit:</span> {contract.last_effective_visit_date || 'N/A'}
                    </div>
                    <div>
                        <span className="font-semibold">Next Due:</span> {contract.next_due_date || 'N/A'}
                    </div>
                </div>

                <div className="mt-3">
                    <span
                        className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${contract.cycle_status === 'overdue'
                                ? 'bg-red-100 text-red-700'
                                : contract.cycle_status === 'due'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                            }`}
                    >
                        {contract.cycle_status.toUpperCase()}
                    </span>
                </div>
            </section>

            {/* Action Buttons - Hide if mode is selected to reduce clutter, or keep them? User code kept them. */}
            {mode === 'none' && (
                <section className="bg-white rounded shadow p-4 space-y-3 border border-gray-100">
                    <h3 className="font-semibold text-gray-700">Action Required</h3>
                    <button
                        onClick={() => startVisit('normal')}
                        className="w-full bg-green-600 text-white py-3 rounded-md text-sm font-semibold shadow hover:bg-green-700 transition"
                    >
                        Start Normal Visit
                    </button>
                    <button
                        onClick={() => startVisit('closed')}
                        className="w-full bg-orange-500 text-white py-3 rounded-md text-sm font-semibold shadow hover:bg-orange-600 transition"
                    >
                        Shop Closed
                    </button>
                </section>
            )}

            {mode !== 'none' && gps && (
                <div className="space-y-4">
                    <section className="bg-blue-50 p-3 rounded border border-blue-100 flex justify-between items-center">
                        <span className="font-medium text-blue-800">Recording {mode === 'normal' ? 'Normal Visit' : 'Shop Closed'}</span>
                        <button
                            onClick={() => setMode('none')}
                            className="text-xs text-blue-600 underline"
                        >
                            Cancel
                        </button>
                    </section>

                    <VisitForm
                        contractId={contract.id}
                        visitType={mode}
                        gps={gps}
                        onSubmitted={handleSubmitted}
                    />
                </div>
            )}
        </div>
    );
}
