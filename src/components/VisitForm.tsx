'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { putItem, STORES } from '@/lib/idb';
import { toast } from 'sonner';

type Props = {
    contractId: number;
    visitType: 'normal' | 'closed';
    gps: { lat: number; lng: number; distance: number };
    onSubmitted: () => void;
};

export default function VisitForm({
    contractId,
    visitType,
    gps,
    onSubmitted,
}: Props) {
    const [remarks, setRemarks] = useState('');
    const [paymentCollected, setPaymentCollected] = useState(false);
    const [amount, setAmount] = useState(1000);
    const [loading, setLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    }, []);

    async function handleSubmit() {
        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setLoading(false);
            alert('Not logged in');
            return;
        }

        const visitData = {
            amc_contract_id: contractId,
            technician_id: user.id,
            visit_type: visitType === 'normal' ? 'normal' : 'shop_closed',
            gps_lat: gps.lat,
            gps_lng: gps.lng,
            distance_from_site_m: gps.distance,
            remarks,
            payment_collected: paymentCollected,
            payment_amount: paymentCollected ? amount : 0,
        };

        if (isOnline) {
            // Online: Direct Submit
            const { error } = await supabase.from('amc_visits').insert(visitData);

            if (error) {
                // If API fails (e.g. flaky network), should we try offline?
                // For V1, simple error. V2 can auto-fallback.
                console.error(error);
                alert('Error saving visit: ' + error.message);
                setLoading(false);
                return;
            }
        } else {
            // Offline: Queue in IndexedDB
            const pendingItem = {
                visit_id: null, // New visit
                technician_id: user.id, // Needed for dedupe/checking
                contract_id: contractId,
                payload: {
                    ...visitData,
                    status: 'completed' // Assuming status is implicitly completed
                },
                created_at: new Date().toISOString(),
                retry_count: 0
            };

            try {
                await putItem(STORES.PENDING_VISITS, pendingItem);
                alert('Offline: Visit saved to device. Will sync when online.');
            } catch (err) {
                console.error('IDB Error', err);
                alert('Failed to save offline visit.');
                setLoading(false);
                return;
            }
        }

        // Call success handler
        setLoading(false);
        onSubmitted();
    }

    return (
        <div className="bg-white rounded shadow p-4 space-y-4 text-sm border border-gray-100">
            <div className={`text-xs p-2 rounded ${isOnline ? 'bg-gray-50 text-gray-500' : 'bg-amber-50 text-amber-700'}`}>
                <span className="font-semibold">Status:</span> {isOnline ? 'Online' : 'Offline'}
                <br />
                <span className="font-semibold">Visit Type:</span> {visitType === 'normal' ? 'Normal' : 'Shop Closed'}
                <br />
                <span className="font-semibold">GPS Distance:</span> {gps.distance.toFixed(1)} m
            </div>

            <div>
                <label className="block mb-1 text-sm font-semibold text-gray-700">
                    Remarks
                </label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={3}
                    placeholder={
                        visitType === 'closed'
                            ? 'Reason shop is closed...'
                            : 'Notes from health check...'
                    }
                />
            </div>

            {visitType === 'normal' && (
                <div className="space-y-3 bg-blue-50 p-3 rounded border border-blue-100">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            className="rounded text-blue-600 focus:ring-blue-500"
                            checked={paymentCollected}
                            onChange={(e) => setPaymentCollected(e.target.checked)}
                        />
                        <span className="font-medium text-gray-900">Payment collected onsite?</span>
                    </label>
                    {paymentCollected && (
                        <div>
                            <label className="block mb-1 text-xs font-semibold text-gray-700">
                                Amount (AED)
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded p-2 text-sm"
                            />
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full text-white py-3 rounded-md text-sm font-semibold shadow transition disabled:opacity-50
                   ${isOnline ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}
                `}
            >
                {loading ? 'Saving...' : (isOnline ? 'Submit Visit' : 'Save Offline')}
            </button>
        </div>
    );
}
