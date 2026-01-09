export default function PaymentRow({ payment }: { payment: any }) {
    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center hover:bg-gray-50">
            <div>
                <div className="font-semibold text-gray-900">
                    AED {payment.amount}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    {payment.amc_contracts_view?.customer_name} ({payment.amc_contracts_view?.location_name})
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                    {new Date(payment.collected_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                    by {payment.users?.name || 'Unknown'}
                </div>
            </div>
        </div>
    );
}
