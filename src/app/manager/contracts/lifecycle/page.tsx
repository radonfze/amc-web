'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LifecyclePage() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        load();
    }, [filterStatus]);

    async function load() {
        let q = supabase
            .from('amc_contracts')
            .select(`
                *,
                customer_locations (
                    display_name,
                    customers ( name )
                ),
                users:technician_id ( name )
            `)
            .order('id', { ascending: false });

        if (filterStatus !== 'all') {
            q = q.eq('status', filterStatus);
        }

        const { data } = await q;
        setContracts(data || []);
        setLoading(false);
    }

    async function setStatus(id: number, status: string) {
        if (!confirm(`Change status to ${status}?`)) return;

        // Call RPC
        const { error } = await supabase.rpc('set_contract_status', {
            p_id: id,
            p_new_status: status,
            p_meta: { reason: "manual_override_lifecycle_page" }
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            load(); // Reload to see updates
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Lifecycle Console</h1>
                <div className="space-x-2">
                    {['all', 'draft', 'active', 'due_soon', 'overdue', 'expired', 'renewed', 'cancelled'].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1 rounded text-xs uppercase font-bold ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-2 text-left">ID</th>
                                <th className="px-4 py-2 text-left">Customer</th>
                                <th className="px-4 py-2 text-left">Status</th>
                                <th className="px-4 py-2 text-left">End Date</th>
                                <th className="px-4 py-2 text-left">Actions (Force State)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map(c => (
                                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="px-4 py-2">{c.id}</td>
                                    <td className="px-4 py-2">
                                        <div className="font-medium">{c.customer_locations?.customers?.name}</div>
                                        <div className="text-xs text-gray-500">{c.customer_locations?.display_name}</div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${c.status === 'active' ? 'bg-green-100 text-green-800' :
                                            c.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                c.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-blue-100 text-blue-800'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">{new Date(c.end_date).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 space-x-2">
                                        {/* Dynamic Actions based on current status */}
                                        {['active', 'overdue', 'expired', 'cancelled', 'renewed'].map(target => {
                                            if (target === c.status) return null;
                                            // Simple client-side heuristic for button visibility, 
                                            // server-side RPC will enforce actual rules.
                                            return (
                                                <button
                                                    key={target}
                                                    onClick={() => setStatus(c.id, target)}
                                                    className="text-xs text-blue-600 hover:underline capitalize"
                                                >
                                                    {target}
                                                </button>
                                            )
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
