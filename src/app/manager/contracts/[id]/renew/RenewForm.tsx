'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function RenewForm({ contractId, prevEndDate }: { contractId: number; prevEndDate: string }) {
    const [startDate, setStartDate] = useState(prevEndDate); // default = old end date
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.rpc('renew_contract', {
            p_old_id: contractId,
            p_new_start: startDate,
        });

        setLoading(false);

        if (error) {
            alert('Renewal failed: ' + error.message);
            console.error(error);
            return;
        }

        // data = new contract id
        router.push(`/manager/contracts/${data}`);
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 space-y-3 text-sm">
            <label className="block">
                <span className="text-xs font-semibold">New start date</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                    required
                />
            </label>

            <button
                type="submit"
                disabled={loading}
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Renewing…' : 'Confirm Renewal'}
            </button>
        </form>
    );
}
