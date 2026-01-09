import Link from 'next/link';

export default function ContractRow({ contract }: { contract: any }) {
    return (
        <Link href={`/manager/contracts/${contract.id}`} className="block">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition flex justify-between items-center">
                <div>
                    <div className="font-semibold text-gray-900">
                        {contract.customer_name} <span className="text-gray-400 font-normal mx-1">/</span> {contract.location_name}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                        {contract.customer_area} • Next due: <span className="font-medium text-gray-700">{contract.next_due_date || 'Not set'}</span>
                    </div>
                </div>
                <div className="text-xs">
                    <span
                        className={`px-3 py-1 rounded-full font-medium ${contract.cycle_status === 'overdue'
                                ? 'bg-red-100 text-red-700'
                                : contract.cycle_status === 'due'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                            }`}
                    >
                        {contract.cycle_status.toUpperCase()}
                    </span>
                </div>
            </div>
        </Link>
    );
}
