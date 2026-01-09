import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ContractsListPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: contracts } = await supabase
        .from('amc_contracts')
        .select(`
      id,
      start_date,
      end_date,
      status,
      cycle_status,
      payment_status,
      next_due_date,
      customer_locations (
        display_name,
        area
      )
    `)
        .order('next_due_date', { ascending: true })

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6 text-gray-800">AMC Contracts</h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer / Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cycle Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Due</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                            <th className="relative px-6 py-3">
                                <span className="sr-only">View</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {contracts?.map((contract) => (
                            <tr key={contract.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {/* @ts-ignore */}
                                    <div className="text-sm font-medium text-gray-900">{contract.customer_locations?.display_name || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {/* @ts-ignore */}
                                    <div className="text-sm text-gray-500">{contract.customer_locations?.area || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${contract.cycle_status === 'overdue' ? 'bg-red-100 text-red-800' :
                                            contract.cycle_status === 'due' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-green-100 text-green-800'
                                        }`}>
                                        {contract.cycle_status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {contract.next_due_date ? new Date(contract.next_due_date).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`capitalize ${contract.payment_status === 'pending' ? 'text-orange-600' : 'text-green-600 font-medium'}`}>
                                        {contract.payment_status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/dashboard/contracts/${contract.id}`} className="text-blue-600 hover:text-blue-900">
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
