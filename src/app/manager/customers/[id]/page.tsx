'use client';

// Converting to Client Component to reuse existing supabaseClient logic safely
// and ensure immediate compatibility without checking server-side config.

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AuditLog } from '@/components/AuditLog';

export default function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const customerId = Number(resolvedParams.id);

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('contracts');

    useEffect(() => {
        load();
    }, [customerId]);

    async function load() {
        // 1. Customer
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        // 2. Locations
        const { data: locations } = await supabase
            .from('customer_locations')
            .select('*')
            .eq('customer_id', customerId);

        const locationIds = (locations || []).map((l: any) => l.id);

        // 3. Contracts
        let contracts: any[] = [];
        if (locationIds.length > 0) {
            const res = await supabase
                .from('amc_contracts')
                .select('*')
                .in('customer_location_id', locationIds)
                .order('id', { ascending: false });
            contracts = res.data || [];
        }

        const contractIds = contracts.map((c: any) => c.id);

        // 4. Visits
        let visits: any[] = [];
        if (contractIds.length > 0) {
            const res = await supabase
                .from('amc_visits')
                .select('*')
                .in('amc_contract_id', contractIds)
                .order('visit_date', { ascending: false })
                .limit(50);
            visits = res.data || [];
        }

        // 5. Payments
        const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('customer_id', customerId)
            .order('paid_at', { ascending: false });

        // 6. Events (Timeline)
        let events: any[] = [];
        if (contractIds.length > 0) {
            const res = await supabase
                .from('contract_events')
                .select('*')
                .in('contract_id', contractIds)
                .order('created_at', { ascending: false }); // Note: updated schema might use created_at default
            events = res.data || [];
        }

        setData({ customer, locations, contracts, visits, payments, events });
        setLoading(false);
    }

    if (loading) return <div className="p-8">Loading Customer 360...</div>;
    if (!data?.customer) return <div className="p-8">Customer not found</div>;

    const { customer, locations, contracts, visits, payments, events } = data;
    const totalCollected = (payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                        <div className="text-gray-500 mt-1">{customer.contact_phone} • {customer.email || 'No Email'}</div>
                        <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {customer.area || 'No Area'}
                        </div>
                    </div>
                    <div className="text-right text-sm">
                        <div className="text-gray-500">Total Collected</div>
                        <div className="text-2xl font-bold text-green-600">AED {totalCollected.toLocaleString()}</div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6 border-t pt-4 text-sm text-gray-600">
                    <div>Locations: <span className="font-semibold text-gray-900">{locations.length}</span></div>
                    <div>Contracts: <span className="font-semibold text-gray-900">{contracts.length}</span></div>
                    <div>Visits: <span className="font-semibold text-gray-900">{visits.length}</span></div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {['contracts', 'visits', 'payments', 'timeline', 'locations'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                        whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm capitalize
                        ${activeTab === tab
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    `}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Contracts Tab */}
            {activeTab === 'contracts' && (
                <div className="bg-white rounded shadow text-sm overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">ID</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Location</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Period</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Next Due</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {contracts?.map((c: any) => {
                                const loc = locations?.find((l: any) => l.id === c.customer_location_id);
                                return (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">#{c.id}</td>
                                        <td className="px-6 py-4">{loc?.display_name}</td>
                                        <td className="px-6 py-4">{c.start_date} → {c.end_date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    c.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{c.next_due_date}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Visits Tab */}
            {activeTab === 'visits' && (
                <div className="bg-white rounded shadow text-sm overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Contract</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Type</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {visits?.map((v: any) => (
                                <tr key={v.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">{new Date(v.visit_date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">#{v.amc_contract_id}</td>
                                    <td className="px-6 py-4 capitalize">{v.visit_type?.replace('_', ' ')}</td>
                                    <td className="px-6 py-4 text-gray-500">{v.remarks || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <div className="bg-white rounded shadow text-sm overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Date</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Amount</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Method</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {payments?.map((p: any) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">{new Date(p.paid_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-mono font-medium text-green-600">AED {p.amount}</td>
                                    <td className="px-6 py-4 capitalize">{p.payment_method}</td>
                                    <td className="px-6 py-4 text-gray-500">{p.reference_id || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
                <div className="bg-white rounded shadow p-6">
                    <ul className="space-y-6 border-l-2 border-gray-100 ml-3 pl-6">
                        {events?.map((e: any) => (
                            <li key={e.id} className="relative">
                                <div className="absolute -left-[30px] top-1 h-3 w-3 rounded-full bg-blue-200 border-2 border-white ring-1 ring-blue-100"></div>
                                <div className="text-xs text-gray-500 mb-1">{new Date(e.created_at || e.event_at || new Date()).toLocaleString()}</div>
                                <div className="font-medium text-gray-900 capitalize">
                                    {e.event_type} <span className="text-gray-400 font-normal">on Contract #{e.contract_id}</span>
                                </div>
                                {e.meta && (
                                    <pre className="mt-2 text-[10px] bg-gray-50 p-2 rounded overflow-x-auto text-gray-600">
                                        {JSON.stringify(e.meta, null, 2)}
                                    </pre>
                                )}
                            </li>
                        ))}
                        {events.length === 0 && <li className="text-gray-500 italic">No events recorded.</li>}
                    </ul>
                </div>
            )}

            {/* Locations Tab */}
            {activeTab === 'locations' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locations.map((loc: any) => (
                        <div key={loc.id} className="bg-white p-4 rounded shadow border border-gray-100">
                            <div className="font-semibold text-gray-900">{loc.display_name}</div>
                            <div className="text-sm text-gray-600 mt-1">{loc.full_address}</div>
                            <div className="mt-3 text-xs text-gray-400">ID: {loc.id} • Coords: {loc.latitude}, {loc.longitude}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
