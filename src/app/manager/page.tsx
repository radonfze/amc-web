'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Card } from '@/components/ui/Card'; 

function KPI({ title, value, color, icon }: { title: string, value: number, color: string, icon?: string }) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-500 text-blue-600',
        red: 'bg-red-50 border-red-500 text-red-600',
        yellow: 'bg-yellow-50 border-yellow-500 text-yellow-600',
        orange: 'bg-orange-50 border-orange-500 text-orange-600',
    };
    return (
        <div className={`p-4 rounded shadow border-l-4 ${colorClasses[color] || 'bg-gray-50 border-gray-500'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-sm font-medium text-gray-500">{title}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
                </div>
                {icon && <div className="text-xl opacity-50">{icon}</div>}
            </div>
        </div>
    );
}

function TechTable({ title, rows, metric }: { title: string, rows: any[], metric: string }) {
    return (
        <div className="bg-white rounded shadow p-4 text-sm border border-gray-100">
            <div className="font-semibold mb-3 text-gray-900">{title}</div>
            <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="border-b px-3 py-2 text-left font-medium text-gray-500">Technician</th>
                        <th className="border-b px-3 py-2 text-left font-medium text-gray-500 uppercase">{metric.replace('_', ' ')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.technician_id || i} className="hover:bg-gray-50">
                            <td className="border-b px-3 py-2 font-medium text-gray-700">{r.technician_name}</td>
                            <td className="border-b px-3 py-2 text-gray-600">{r[metric]}</td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={2} className="px-3 py-4 text-center text-gray-400 italic">No data available</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default function ManagerDashboard() {
    const [stats, setStats] = useState({
        dueToday: 0,
        overdueCount: 0,
        expiringSoon: 0,
        criticalWarning: 0, // 80-90 days
        topVisits: [] as any[],
        topCollections: [] as any[],
        schedule: [] as any[],
        revenue: [] as any[],
        pipeline: [] as any[],
        amcQueue: [] as any[], // AMC Queue Board
        renewalsList: [] as any[] // Renewal Pending List
    });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        load();
        
        // Live Update: Poll every 30 seconds
        const interval = setInterval(() => {
            load();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    async function load() {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

        // Date math for 80-90 days warning
        const date80DaysAgo = new Date(); date80DaysAgo.setDate(today.getDate() - 80);
        const date90DaysAgo = new Date(); date90DaysAgo.setDate(today.getDate() - 90);
        
        try {
            // 1. Contracts due today
            const { data: dueToday } = await supabase
                .from('amc_contracts')
                .select('id')
                .in('status', ['active', 'due_soon'])
                .eq('next_due_date', todayStr);

            // 2. Overdue count
            const { count: overdueCount } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'overdue');

            // 3. Expiring soon count
            const { count: expiringSoonCount } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active')
                .gte('end_date', todayStr)
                .lte('end_date', thirtyDaysLater);

            // 4. Critical Warning (80-90 days since last visit)
            // Note: Filter where last_effective_visit_date is between 90 and 80 days ago
            // i.e. last_visit < 80 days ago AND last_visit > 90 days ago
            const { data: criticalData } = await supabase
                .from('amc_contracts')
                .select('id, last_effective_visit_date')
                .eq('status', 'active')
                .lt('last_effective_visit_date', date80DaysAgo.toISOString().slice(0, 10))
                .gt('last_effective_visit_date', date90DaysAgo.toISOString().slice(0, 10));

            // 5. AMC Queue Board (Visits Due, Unassigned/Pending)
            // Just contracts due or overdue
            const { data: amcQueue } = await supabase
                .from('amc_contracts')
                .select('id, customer_name, location_name, customer_area, next_due_date')
                .in('status', ['active', 'overdue'])
                .lte('next_due_date', todayStr)
                .order('next_due_date', { ascending: true })
                .limit(10);

            // 6. Renewal Pending List
            const { data: renewalsList } = await supabase
                .from('amc_contracts')
                .select('id, customer_name, end_date')
                .eq('status', 'active')
                .gte('end_date', todayStr)
                .lte('end_date', thirtyDaysLater)
                .order('end_date', { ascending: true })
                .limit(5);


            // 7. Standard Charts/Tables
            const { data: topVisits } = await supabase.rpc('top_tech_visits_30days');
            const { data: topCollections } = await supabase.rpc('top_tech_collections_30days');
            const { data: schedule } = await supabase.from('today_tech_schedule').select('*').limit(10);
            const { data: revenue } = await supabase.rpc('revenue_forecast_30days');
            const { data: pipeline } = await supabase.from('renewal_pipeline').select('*');

            setStats({
                dueToday: dueToday?.length || 0,
                overdueCount: overdueCount || 0,
                expiringSoon: expiringSoonCount || 0,
                criticalWarning: criticalData?.length || 0,
                topVisits: topVisits || [],
                topCollections: topCollections || [],
                schedule: schedule || [],
                revenue: revenue || [],
                pipeline: pipeline || [],
                amcQueue: amcQueue || [],
                renewalsList: renewalsList || []
            });
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error("Dashboard Load Error:", error);
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8">Loading Dashboard...</div>;

    const totalProjectedRevenue = (stats.revenue || []).reduce((acc: number, curr: any) => acc + (curr.expected_amount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Control Tower</h1>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Updated: {lastUpdated.toLocaleTimeString()}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <KPI title="Due Today" value={stats.dueToday} color="blue" />
                <KPI title="Overdue" value={stats.overdueCount} color="red" />
                <KPI title="Expiring (30d)" value={stats.expiringSoon} color="yellow" />
                <KPI title="Critical (80-90d)" value={stats.criticalWarning} color="orange" icon="⚠️" />
                
                <div className="p-4 rounded shadow border-l-4 bg-green-50 border-green-500 text-green-600">
                    <div className="text-sm font-medium text-gray-500">Revenue (30d)</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">AED {totalProjectedRevenue.toLocaleString()}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Queues & Lists */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* AMC Queue Board */}
                    <div className="bg-white rounded shadow text-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
                            <h3 className="font-bold text-red-900">🚨 AMC Queue Board (Due/Overdue)</h3>
                            <button onClick={() => load()} className="text-xs bg-white border border-red-200 text-red-700 px-3 py-1 rounded hover:bg-red-50">Refresh</button>
                        </div>
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="border-b px-4 py-2 text-left text-gray-500">Customer</th>
                                    <th className="border-b px-4 py-2 text-left text-gray-500">Area</th>
                                    <th className="border-b px-4 py-2 text-left text-gray-500">Due Date</th>
                                    <th className="border-b px-4 py-2 text-right text-gray-500">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.amcQueue.map((q: any) => (
                                    <tr key={q.id} className="hover:bg-gray-50">
                                        <td className="border-b px-4 py-3 font-medium text-gray-900">{q.customer_name}</td>
                                        <td className="border-b px-4 py-3 text-gray-600">{q.customer_area || q.location_name}</td>
                                        <td className="border-b px-4 py-3 text-red-600 font-bold">{q.next_due_date}</td>
                                        <td className="border-b px-4 py-3 text-right">
                                            <button 
                                                className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition"
                                                onClick={() => alert(`Assigning ${q.customer_name} to me... (Implemented in next update)`)}
                                            >
                                                Take
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {stats.amcQueue.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-400">No overdue AMCs pending!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Today's Schedule */}
                    <div className="bg-white rounded shadow text-sm border border-gray-100 overflow-hidden">
                         <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Today's Schedule</h3>
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{stats.schedule.length} Visits</span>
                        </div>
                        {stats.schedule.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 italic">No visits scheduled for today.</div>
                        ) : (
                            <table className="min-w-full text-xs">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="border-b px-4 py-2 text-left text-gray-500 font-medium">Technician</th>
                                        <th className="border-b px-4 py-2 text-left text-gray-500 font-medium">Time</th>
                                        <th className="border-b px-4 py-2 text-left text-gray-500 font-medium">Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.schedule.map((v: any) => (
                                        <tr key={v.visit_id} className="hover:bg-gray-50">
                                            <td className="border-b px-4 py-3 font-medium text-gray-900">{v.technician_name || 'Unassigned'}</td>
                                            <td className="border-b px-4 py-3 text-gray-600 font-mono">{v.visit_time?.slice(0, 5)}</td>
                                            <td className="border-b px-4 py-3 text-gray-600 truncate max-w-xs" title={v.full_address}>
                                                <div className="text-gray-900 font-medium">{v.location_name}</div>
                                                <div className="text-xs text-gray-400 truncate">{v.full_address}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right Column: Widgets */}
                <div className="space-y-6">
                    
                    {/* Renewal Pending List */}
                    <TechTable title="Renewals Pending (30d)" rows={stats.renewalsList.map((r:any) => ({...r, end_date: r.end_date}))} metric="end_date" />

                    {/* Visual Pie/Funnel */}
                    <Card>
                        <h3 className="font-semibold text-gray-900 mb-4">Pipeline (90d)</h3>
                        <div className="space-y-3">
                            {['0-30', '31-60', '61-90'].map(bucket => {
                                const count = stats.pipeline.find((p: any) => p.bucket === bucket)?.count || 0;
                                return (
                                    <div key={bucket} className="flex justify-between items-center bg-blue-50 p-2 rounded text-xs">
                                        <span className="font-bold text-blue-700">{bucket} Days</span>
                                        <span className="bg-white px-2 py-0.5 rounded text-blue-600 font-bold border border-blue-100">{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </Card>

                    <TechTable title="Top Techs (Visits)" rows={stats.topVisits} metric="visits" />
                </div>
            </div>
        </div>
    );
}
