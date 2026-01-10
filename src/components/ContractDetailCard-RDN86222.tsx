export default function ContractDetailCard({ contract }: { contract: any }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{contract.customer_name}</h2>
                    <p className="text-sm text-gray-500">{contract.location_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${contract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                    {contract.status}
                </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact & Location</h3>
                    <div className="text-sm">
                        <p><span className="text-gray-500 block">Contact Person:</span> {contract.contact_person || 'N/A'}</p>
                        <p><span className="text-gray-500 block">Phone:</span> {contract.contact_phone || 'N/A'}</p>
                        <p><span className="text-gray-500 block">Address:</span> {contract.full_address || contract.customer_area || 'N/A'}</p>
                        <p><span className="text-gray-500 block">License No:</span> {contract.gov_license_no || 'N/A'}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contract Details</h3>
                    <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                            <span className="text-gray-500 block">Start Date</span>
                            {contract.start_date}
                        </div>
                        <div>
                            <span className="text-gray-500 block">End Date</span>
                            {contract.end_date}
                        </div>
                        <div>
                            <span className="text-gray-500 block">Next Due Date</span>
                            <span className={contract.cycle_status === 'overdue' ? 'text-red-600 font-bold' : ''}>
                                {contract.next_due_date || 'N/A'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">Cycle Status</span>
                            {contract.cycle_status}
                        </div>
                        <div>
                            <span className="text-gray-500 block">Payment Status</span>
                            {contract.payment_status}
                        </div>
                        <div>
                            <span className="text-gray-500 block">Total Amount</span>
                            AED {contract.amount_total}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
