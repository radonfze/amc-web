'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import RenewForm from './RenewForm';

export default function RenewPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [data, setData] = useState<{ contract: any, location: any } | null>(null);

    useEffect(() => {
        async function load() {
            const { data: contract } = await supabase
                .from('amc_contracts')
                .select('id, start_date, end_date, customer_location_id, amount_total, technician_id')
                .eq('id', resolvedParams.id)
                .single();

            if (contract) {
                const { data: location } = await supabase
                    .from('customer_locations')
                    .select('id, display_name, full_address')
                    .eq('id', contract.customer_location_id)
                    .single();
                setData({ contract, location });
            }
        }
        load();
    }, [resolvedParams.id]);

    if (!data) return <div>Loading...</div>;
    const { contract, location } = data;

    return (
        <div className="space-y-4">
            <h1 className="text-lg font-semibold">Renew Contract</h1>

            <div className="bg-white rounded shadow p-4 text-sm space-y-2">
                <div><b>Location:</b> {location?.display_name}</div>
                <div><b>Address:</b> {location?.full_address}</div>
                <div><b>Current period:</b> {contract.start_date} → {contract.end_date}</div>
                <div><b>Amount:</b> {contract.amount_total}</div>
            </div>

            <RenewForm contractId={contract.id} prevEndDate={contract.end_date} />
        </div>
    );
}
