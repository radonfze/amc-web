import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import VisitForm from './VisitForm'

export const dynamic = 'force-dynamic'

export default async function VisitDetailPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()
    const { id } = await params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: contract } = await supabase
        .from('amc_contracts')
        .select(`
      *,
      customer_locations (
        display_name,
        full_address,
        lat,
        lng,
        gov_license_no
      )
    `)
        .eq('id', id)
        .single()

    if (!contract) {
        return <div>Contract not found</div>
    }

    // @ts-ignore
    const location = contract.customer_locations

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/technician">← Back to Dashboard</Link>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{location.display_name}</h1>
                <p className="text-gray-600">{location.full_address}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-700">License: {location.gov_license_no || 'N/A'}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${contract.cycle_status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                        Status: {contract.cycle_status.toUpperCase()}
                    </span>
                </div>
            </div>

            <VisitForm
                contractId={contract.id}
                siteLat={location.lat}
                siteLng={location.lng}
            />
        </div>
    )
}
