import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TechnicianDashboard() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Fetch contracts that are DUE or OVERDUE
    // For MVP, we fetch all active contracts and filter, or use DB filtering
    // "Cycle status in (due, overdue)"
    const { data: dueContracts } = await supabase
        .from('amc_contracts')
        .select(`
      id,
      next_due_date,
      cycle_status,
      customer_locations (
        display_name,
        full_address,
        lat,
        lng
      )
    `)
        .in('cycle_status', ['due', 'overdue'])
        .eq('status', 'active')
        .order('next_due_date', { ascending: true })

    return (
        <div className="space-y-6">

            {/* Section 1: My Due Visits */}
            <section>
                <h2 className="mb-4 text-xl font-bold text-gray-800">Due Visits</h2>

                {(!dueContracts || dueContracts.length === 0) ? (
                    <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">
                        No visits due right now. Good job!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {dueContracts.map((contract) => (
                            <Link
                                key={contract.id}
                                href={`/technician/visit/${contract.id}`}
                                className="block rounded-lg bg-white p-4 shadow-sm transition hover:bg-gray-50 border border-gray-100"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        {/* @ts-ignore - Supabase types join */}
                                        <h3 className="font-semibold text-gray-900">{contract.customer_locations?.display_name || 'Unknown Location'}</h3>
                                        {/* @ts-ignore */}
                                        <p className="text-sm text-gray-500">{contract.customer_locations?.full_address || 'No address'}</p>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${contract.cycle_status === 'overdue'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {contract.cycle_status.toUpperCase()}
                                    </span>
                                </div>
                                <div className="mt-3 text-sm text-gray-600">
                                    Due: {new Date(contract.next_due_date).toLocaleDateString()}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* Section 2: Nearby Customers (Placeholder for Client Comp) */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Nearby Customers</h2>
                </div>

                <div className="rounded-lg bg-blue-50 p-6 text-center border border-blue-100">
                    <p className="text-blue-800 mb-2">Find customers near you</p>
                    <Link
                        href="/technician/nearby"
                        className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
                    >
                        Locate Nearby
                    </Link>
                </div>
            </section>

        </div>
    )
}
