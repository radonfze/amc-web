import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ManagerDashboard() {
    const supabase = await createClient()

    // Check Role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Fetch KPI Stats (Parallel)
    const [
        { count: totalContracts },
        { count: overdueCount },
        { count: dueCount },
        { count: shopClosedSatisfied }
    ] = await Promise.all([
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('cycle_status', 'overdue'),
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('cycle_status', 'due'),
        supabase.from('amc_contracts').select('*', { count: 'exact', head: true }).eq('cycle_status', 'closed_satisfied')
    ])

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-sm font-medium text-gray-500">Total Active Contracts</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalContracts || 0}</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100">
                    <p className="text-sm font-medium text-red-600">Overdue Visits</p>
                    <p className="text-3xl font-bold text-red-700 mt-2">{overdueCount || 0}</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-yellow-100">
                    <p className="text-sm font-medium text-yellow-600">Due Soon</p>
                    <p className="text-3xl font-bold text-yellow-700 mt-2">{dueCount || 0}</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-sm font-medium text-green-600">Shop Closed Cycles</p>
                    <p className="text-3xl font-bold text-green-700 mt-2">{shopClosedSatisfied || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Marked satisfied via closed visits</p>
                </div>

            </div>

            <div className="mt-8">
                {/* Placeholder for charts or recent activity */}
                <div className="bg-white p-6 rounded-lg shadow-sm p-12 text-center text-gray-400 border border-dashed border-gray-200">
                    Activity Charts coming soon
                </div>
            </div>
        </div>
    )
}
