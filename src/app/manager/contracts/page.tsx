'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ContractRow from '@/components/ContractRow';
import Link from 'next/link';

export default function ContractsList() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadContracts();
    }, []);

    async function loadContracts() {
        const { data } = await supabase
            .from('amc_contracts_view')
            .select('*')
            .order('next_due_date', { ascending: true });

        if (data) setContracts(data);
        setLoading(false);
    }

    const handleExport = () => {
        if (contracts.length === 0) return;

        // Generate CSV content
        const headers = ['ID', 'Customer', 'Location', 'Status', 'Start Date', 'End Date', 'Next Due', 'Cycle Status'].join(',');
        const rows = contracts.map(c => [
            c.id,
            `"${c.customer_name}"`, // Quote strings to handle commas
            `"${c.location_name || ''}"`,
            c.status,
            c.start_date,
            c.end_date,
            c.next_due_date,
            c.cycle_status
        ].join(','));

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');

        // Trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `contracts_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
                    <span className="text-sm text-gray-500">{contracts.length} records found</span>
                </div>
                <button
                    onClick={handleExport}
                    disabled={contracts.length === 0}
                    className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                >
                    <span>↓</span> Export CSV
                </button>
            </div>

            {loading ? (
                <p className="text-gray-500">Loading contracts...</p>
            ) : (
                <div className="space-y-3">
                    {contracts.length === 0 && <p className="text-gray-500">No contracts found.</p>}
                    {contracts.map((c) => (
                        <ContractRow key={c.id} contract={c} />
                    ))}
                </div>
            )}
        </div>
    );
}
