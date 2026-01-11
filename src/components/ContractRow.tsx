import Link from 'next/link';
import { MouseEvent } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ContractRowProps {
    contract: any;
    isSelected?: boolean;
    onToggle?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export default function ContractRow({ contract, isSelected, onToggle, onDelete }: ContractRowProps) {

    // Calculate days since last AMC using vanilla JS to avoid date-fns dependency
    let daysSinceLast = 'N/A';
    if (contract.last_effective_visit_date) {
        const last = new Date(contract.last_effective_visit_date);
        const now = new Date();
        const diffTime = now.getTime() - last.getTime();
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        daysSinceLast = `${days} days`;
    }

    const handleCheckboxClick = (e: MouseEvent) => {
        e.stopPropagation(); // Prevent Link navigation
        if (onToggle) onToggle(contract.id);
    };

    const handleDeleteClick = (e: MouseEvent) => {
        e.preventDefault(); 
        e.stopPropagation();
        if (onDelete && confirm(`Are you sure you want to delete contract for ${contract.customer_name}?`)) {
            onDelete(contract.id);
        }
    };

    return (
        <div className="flex items-center gap-3 group">
            {/* Selection Checkbox (Only if onToggle is provided) */}
            {onToggle && (
                <div className="flex-shrink-0 pl-1">
                    <input 
                        type="checkbox" 
                        checked={isSelected || false} 
                        onChange={() => {}} // Handled by onClick on div/input to capture easier
                        onClick={handleCheckboxClick}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                </div>
            )}

            {/* Card Container - Flex wrapper to separate Clickable Content & Actions */}
            <div className={`flex-1 bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isSelected ? 'border-blue-400 ring-1 ring-blue-100' : 'border-gray-100'}`}>
                
                {/* Clickable Main Content Area */}
                <Link href={`/manager/contracts/${contract.id}`} className="flex-1 w-full md:w-auto hover:bg-gray-50/50 rounded -ml-2 p-2 transition">
                    <div>
                        <div className="font-semibold text-gray-900 text-sm md:text-base">
                            {contract.customer_name} <span className="text-gray-400 font-normal mx-1">/</span> {contract.location_name}
                        </div>
                        
                        {/* Primary Info Row */}
                        <div className="text-gray-500 text-xs mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                            <span>Area: <span className="text-gray-700">{contract.customer_area || '-'}</span></span>
                            <span>Start/Renewed: <span className="font-medium text-gray-700">{contract.start_date || '-'}</span></span>
                            <span>Expires: <span className="font-medium text-gray-700">{contract.end_date || '-'}</span></span>
                        </div>

                        {/* Secondary Info Row (Next Due + Last Visit) */}
                        <div className="text-gray-500 text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
                             <span>Next Due: <span className={`font-medium ${contract.cycle_status === 'overdue' ? 'text-red-600' : 'text-gray-700'}`}>{contract.next_due_date || 'Not set'}</span></span>
                             <span>Days since last AMC: <span className="font-medium text-blue-600">{daysSinceLast}</span></span>
                        </div>
                    </div>
                </Link>

                {/* Right Side: Badges & Actions */}
                <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    
                     {/* Badges - Wrapped in Link to keep them clickable if desired, or just static. Let's make them navigate. */}
                     <Link href={`/manager/contracts/${contract.id}`} className="flex items-center gap-2">
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                contract.status === 'active' ? 'bg-green-100 text-green-800' :
                                contract.status === 'expired' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}
                        >
                            {contract.status}
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${contract.cycle_status === 'overdue' ? 'bg-red-50 text-red-600 border border-red-200' :
                                    contract.cycle_status === 'due' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 'bg-green-50 text-green-600 border border-green-200'
                                }`}
                        >
                            {contract.cycle_status}
                        </span>
                    </Link>

                    {/* Single Delete Button - OUTSIDE Link */}
                    {onDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className="ml-2 text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition border border-transparent hover:border-red-100"
                            title="Delete Contract"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
