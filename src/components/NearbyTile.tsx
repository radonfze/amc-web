import Link from 'next/link';

type Props = {
    contract: any; // Using any to be flexible with the join/view shape + distance property
};

export default function NearbyTile({ contract }: Props) {
    return (
        <Link href={`/tech/visit/${contract.id}`} className="block">
            <div className="bg-white rounded shadow p-3 text-sm flex justify-between items-center hover:bg-gray-50 transition border border-gray-100">
                <div>
                    <div className="font-semibold text-gray-900">
                        {contract.customer_name}
                    </div>
                    <div className="text-xs text-gray-500">
                        {contract.location_name}
                    </div>
                    <div className="text-gray-600 text-xs mt-1">
                        {contract.area} • Status: {contract.cycle_status}
                    </div>
                </div>
                <div className="text-right text-xs font-bold text-blue-600">
                    {(contract.distance / 1000).toFixed(1)} km
                </div>
            </div>
        </Link>
    );
}
