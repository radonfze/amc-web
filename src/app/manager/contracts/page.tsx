'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ContractRow from '@/components/ContractRow';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'; // Add Icon

export default function ContractsList() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [filteredContracts, setFilteredContracts] = useState<any[]>([]); // New State
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); // Search State

    useEffect(() => {
        loadContracts();
    }, []);

    // Filter Logic
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredContracts(contracts);
        } else {
            const lower = searchTerm.toLowerCase();
            const invalid = contracts.filter(c => 
                (c.customer_name && c.customer_name.toLowerCase().includes(lower)) ||
                (c.location_name && c.location_name.toLowerCase().includes(lower)) ||
                (c.id && c.id.toString().includes(lower)) ||
                (c.customer_area && c.customer_area.toLowerCase().includes(lower))
            );
            setFilteredContracts(invalid);
        }
    }, [searchTerm, contracts]);

    async function loadContracts() {
        const { data } = await supabase
            .from('amc_contracts_view')
            .select('*')
            .order('next_due_date', { ascending: true });

        if (data) {
            setContracts(data);
            setFilteredContracts(data);
        }
        setLoading(false);
    }

    const handleExport = () => {
        if (filteredContracts.length === 0) return; // Export filtered

        // Generate CSV content
        const headers = ['ID', 'Customer', 'Location', 'Status', 'Start Date', 'End Date', 'Next Due', 'Cycle Status'].join(',');
        const rows = filteredContracts.map(c => [
            c.id,
            `"${c.customer_name}"`, // Quote strings for commas
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
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
                    <span className="text-sm text-gray-500">{filteredContracts.length} records found</span>
                </div>

                <div className="flex flex-1 max-w-md mx-4 relative w-full">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Search contracts by name, location, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Link
                        href="/manager/contracts/new"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                        <span>+</span> New
                    </Link>
                    <button
                        onClick={handleExport}
                        disabled={filteredContracts.length === 0}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                    >
                        <span>↓</span> Export
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-gray-500">Loading contracts...</p>
            ) : (
                <div className="space-y-3">
                    {filteredContracts.length === 0 && <p className="text-gray-500 py-8 text-center bg-gray-50 rounded border border-dashed">No contracts found matching "{searchTerm}"</p>}
                    {filteredContracts.map((c) => (
                        <ContractRow key={c.id} contract={c} />
                    ))}
                </div>
            )}
        </div>
    );
}
