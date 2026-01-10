'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ContractRow from '@/components/ContractRow';
import Link from 'next/link';
import { MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline'; // Add Trash Icon

export default function ContractsList() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [filteredContracts, setFilteredContracts] = useState<any[]>([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); 
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadContracts();
    }, []);

    // Filter Logic
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredContracts(contracts);
        } else {
            const lower = searchTerm.toLowerCase();
            const matching = contracts.filter(c => 
                (c.customer_name && c.customer_name.toLowerCase().includes(lower)) ||
                (c.location_name && c.location_name.toLowerCase().includes(lower)) ||
                (c.id && c.id.toString().includes(lower)) ||
                (c.customer_area && c.customer_area.toLowerCase().includes(lower))
            );
            setFilteredContracts(matching);
        }
    }, [searchTerm, contracts]);

    async function loadContracts() {
        setLoading(true);
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

    // Selection Handlers
    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredContracts.length && filteredContracts.length > 0) {
            setSelectedIds(new Set()); // Deselect All
        } else {
            const allIds = new Set(filteredContracts.map(c => c.id));
            setSelectedIds(allIds);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} contracts? This action cannot be undone.`)) return;

        const idsToDelete = Array.from(selectedIds);
        
        // Delete request 
        const { error } = await supabase
            .from('amc_contracts') // Delete from base table, not view
            .delete()
            .in('id', idsToDelete);

        if (error) {
            alert('Error deleting contracts: ' + error.message);
        } else {
            // Optimistic update
            const remaining = contracts.filter(c => !selectedIds.has(c.id));
            setContracts(remaining);
            setFilteredContracts(remaining.filter(c => !selectedIds.has(c.id))); // Re-filter if needed, simple logic here implies filter matches contract subset
            setSelectedIds(new Set());
            alert('Contracts deleted successfully.');
            // Reload to be safe
            loadContracts(); 
        }
    };

    const handleExport = () => {
        if (filteredContracts.length === 0) return; 

        // Generate CSV content
        const headers = ['ID', 'Customer', 'Location', 'Status', 'Start Date', 'End Date', 'Next Due', 'Cycle Status'].join(',');
        const rows = filteredContracts.map(c => [
            c.id,
            `"${c.customer_name}"`, 
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

    const isAllSelected = filteredContracts.length > 0 && selectedIds.size === filteredContracts.length;

    return (
        <div className="relative min-h-[500px]"> 
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{filteredContracts.length}</span>
                </div>

                {/* Bulk Actions Bar (Conditional) */}
                {selectedIds.size > 0 ? (
                    <div className="flex-1 w-full bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg flex justify-between items-center animate-pulse">
                        <span className="font-semibold">{selectedIds.size} Selected</span>
                        <div className="flex gap-2">
                             <button
                                onClick={handleBulkDelete}
                                className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700 flex items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Delete All
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-blue-600 hover:text-blue-800 text-sm underline px-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 max-w-md mx-4 relative w-full">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Search contracts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                {!selectedIds.size && (
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
                )}
            </div>

            {/* Select All Checkbox Header */}
            {filteredContracts.length > 0 && (
                <div className="flex items-center gap-3 mb-2 px-1">
                    <div className="pl-1">
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={toggleSelectAll}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Select All"
                        />
                    </div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select All</span>
                </div>
            )}

            {loading ? (
                <p className="text-gray-500">Loading contracts...</p>
            ) : (
                <div className="space-y-3 pb-20"> 
                    {filteredContracts.length === 0 && <p className="text-gray-500 py-8 text-center bg-gray-50 rounded border border-dashed">No contracts found matching "{searchTerm}"</p>}
                    {filteredContracts.map((c) => (
                        <ContractRow 
                            key={c.id} 
                            contract={c} 
                            isSelected={selectedIds.has(c.id)}
                            onToggle={toggleSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
