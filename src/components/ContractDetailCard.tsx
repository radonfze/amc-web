export default function ContractDetailCard({ contract }: { contract: any }) {
    // Helper to format currency
    const formatAED = (val: any) => { 
        return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(Number(val) || 0);
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{contract.customers?.name || contract.customer_name || 'Unknown Customer'}</h2>
                    <p className="text-sm text-gray-500">{contract.customer_locations?.display_name || contract.location_name || 'Unknown Location'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${contract.status === 'active' ? 'bg-green-100 text-green-800' : 
                    contract.status === 'expired' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                }`}>
                    {contract.status}
                </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact & Location</h3>
                    <div className="text-sm space-y-2">
                        <p><span className="text-gray-500 block text-xs">Contact Person</span> <span className="font-medium">{contract.customers?.contact_person || contract.contact_person || 'N/A'}</span></p>
                        <p><span className="text-gray-500 block text-xs">Phone</span> <span className="font-medium">{contract.customers?.phone || contract.customers?.contact_phone || contract.contact_phone || 'N/A'}</span></p>
                        <p><span className="text-gray-500 block text-xs">Address</span> <span className="font-medium">{contract.customer_locations?.full_address || contract.full_address || contract.customer_area || 'N/A'} </span></p>
                        <p><span className="text-gray-500 block text-xs">License No</span> <span className="font-medium">{contract.customers?.license_number || contract.gov_license_no || 'N/A'}</span></p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contract Details</h3>
                    <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                            <span className="text-gray-500 block text-xs">Start Date</span>
                            <span className="font-medium">{contract.start_date}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">End Date</span>
                            <span className="font-medium">{contract.end_date}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Next Due (Visit)</span>
                            <span className={`font-medium ${contract.cycle_status === 'overdue' ? 'text-red-600 font-bold' : ''}`}>
                                {contract.next_due_date || 'N/A'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Last AMC Checked</span>
                            <span className="font-medium text-blue-600">{contract.last_effective_visit_date || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block text-xs">Technician</span>
                            <span className="font-medium">{contract.users?.name || 'Unassigned'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50/50 px-6 py-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-3">Financial Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 block text-xs">Govt Fees</span>
                        <span className="font-medium text-gray-900">{formatAED(contract.govt_fees)}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">Our AMC</span>
                        <span className="font-medium text-gray-900">{formatAED(contract.amc_value)}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">Fine Amount</span>
                        <span className="font-medium text-red-600">{formatAED(contract.fine_amount)}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">Total Contract Value</span>
                        <span className="font-bold text-gray-900 text-base">{formatAED(contract.amount_total)}</span>
                    </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-blue-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 block text-xs">Paid Amount</span>
                        <span className="font-bold text-green-700">{formatAED(contract.paid_amount)}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 block text-xs">Balance Due</span>
                        <span className="font-bold text-red-700">{formatAED(contract.balance_amount)}</span>
                    </div>
                     <div className="md:col-span-2 flex items-center justify-end">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            contract.payment_status === 'paid_online' || contract.payment_status === 'collected_onsite' ? 'bg-green-100 text-green-800' :
                            contract.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-50 text-red-800'
                        }`}>
                            Status: {contract.payment_status?.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
