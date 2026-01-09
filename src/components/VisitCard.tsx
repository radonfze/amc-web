import Link from 'next/link';

type Props = {
    contract: {
        id: number;
        customer_name: string;
        location_name: string;
        area: string | null;
        next_due_date: string | null;
        cycle_status: string;
    };
};

export default function VisitCard({ contract }: Props) {
    return (
        <Link href={`/tech/visit/${contract.id}`} className="block">
            <div className="bg-white rounded shadow p-3 text-sm hover:bg-gray-50 transition border border-gray-100">
                <div className="font-semibold text-gray-900">
                    {contract.customer_name} – {contract.location_name}
                </div>
                <div className="text-gray-600 mt-1">
                    {contract.area}
                    <span className="mx-1">•</span>
                    Next due: {contract.next_due_date ? new Date(contract.next_due_date).toLocaleDateString() : 'Not set'}
                </div>
                <div className="mt-2">
                    <span
                        className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${contract.cycle_status === 'overdue'
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
