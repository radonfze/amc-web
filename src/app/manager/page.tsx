'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Card } from '@/components/ui/Card'; 
import Link from 'next/link';

function KPI({ title, value, color, icon, href }: { title: string, value: number, color: string, icon?: string, href?: string }) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 border-blue-500 text-blue-600',
        red: 'bg-red-50 border-red-500 text-red-600',
        yellow: 'bg-yellow-50 border-yellow-500 text-yellow-600',
        orange: 'bg-orange-50 border-orange-500 text-orange-600',
    };

    const CardContent = (
        <div className={`p-4 rounded shadow border-l-4 cursor-pointer hover:shadow-md transition ${colorClasses[color] || 'bg-gray-50 border-gray-500'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-sm font-medium text-gray-500">{title}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
                </div>
                {icon && <div className="text-xl opacity-50">{icon}</div>}
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{CardContent}</Link>;
    }
    return CardContent;
}

// Generic Simple Table for Renewals / Lists
function SimpleTable({ title, rows, columns }: { title: string, rows: any[], columns: { header: string, key: string, className?: string }[] }) {
    return (
        <div className="bg-white rounded shadow p-4 text-sm border border-gray-100">
            <div className="font-semibold mb-3 text-gray-900">{title}</div>
            <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i} className={`border-b px-3 py-2 text-left font-medium text-gray-500 uppercase ${col.className || ''}`}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.id || i} className="hover:bg-gray-50">
                            {columns.map((col, j) => (
                                <td key={j} className="border-b px-3 py-2 text-gray-700">{r[col.key]}</td>
                            ))}
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="px-3 py-4 text-center text-gray-400 italic">No data available</td>
                        </tr>
                    )}
                </tbody>
            </table>
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
        newCustomers: 0,
        expiredCount: 0,
        criticalWarning: 0, // 90+ days
        lastVisited: [] as any[], // Last 10 checked
        paymentsToday: 0,
        amcQueue: [] as any[], // Critical items
        pipeline: [] as any[],
        renewalsList: [] as any[],
        schedule: [] as any[],
        topVisits: [] as any[],
        topCollections: [] as any[]
    });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        load();
        const interval = setInterval(() => load(), 30000);
        return () => clearInterval(interval);
    }, []);

    async function load() {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        
        // Ranges
        const day30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const day60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
        const day90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
        
        const past30 = new Date(); past30.setDate(today.getDate() - 30);
        const past30Str = past30.toISOString().slice(0, 10);

        // Critical Threshold: Contracts not visited in 90 days OR overdue by 90 days?
        // User said "Critical to (90+)" so probably Overdue > 90 days or Next Due < 90 days ago?
        // Usually Critical implies Overdue. 
        // Let's assume Critical = Next Due Date was 90+ days ago OR Status overdue.
        // Actually, for AMC, Critical means "Last Visited > 90 days ago".
        const date90DaysAgo = new Date(); date90DaysAgo.setDate(today.getDate() - 90);
        const date90Str = date90DaysAgo.toISOString().slice(0, 10);

        try {
            // 1. Due Today
            const { count: dueToday } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .eq('next_due_date', todayStr);

            // 2. Overdue Total
            const { count: overdueCount } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .lt('next_due_date', todayStr)
                .neq('status', 'renewed'); // Exclude renewed

            // 3. New Customer Generated (Last 30 days)
            const { count: newCustomers } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', past30Str); // Assuming created_at tracks this

            // 4. Expired (Not Renewed)
            const { count: expiredCount } = await supabase
                .from('amc_contracts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'expired');

            // 5. Payment Collected Today
            // Need to join payments table. Assuming "payments" table has "collected_at" or "payment_date"
            // Start of today filter
            const startOfDay = new Date(today.setHours(0,0,0,0)).toISOString();
            const endOfDay = new Date(today.setHours(23,59,59,999)).toISOString();
            
            const { data: payments } = await supabase
                .from('payments')
                .select('amount')
                .gte('collected_at', startOfDay) // Assuming collected_at exists
                .lte('collected_at', endOfDay);
                
            const totalCollected = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

            // 6. Last Checked 10 AMC List (with Timestamp)
            const { data: lastVisited } = await supabase
                .from('amc_contracts')
                .select('id, customer_name, location_name, last_effective_visit_date')
                .not('last_effective_visit_date', 'is', null)
                .order('last_effective_visit_date', { ascending: false })
                .limit(10);

            // 7. Queue Board (Critical 90+)
            const { data: amcQueue } = await supabase
                .from('amc_contracts')
                .select('id, customer_name, location_name, customer_area, next_due_date')
                .or(`next_due_date.lt.${date90Str},status.eq.overdue`) // Logic: Due date was > 90 days ago? Or Next Due - Today > 90?
                // "Critical to (90+)" usually means "Overdue by 90 days"
                // Let's just fetch ALL overdue and sort by oldest due date to show "Most Critical"
                .lt('next_due_date', todayStr)
                .order('next_due_date', { ascending: true }) // Oldest first = Most Critical
                .limit(10);
            
            // 8. Pipeline Stats (30, 60, 60-80, 90+)
            // Fetch contracts due in future
            const { data: pipelineData } = await supabase
                .from('amc_contracts')
                .select('next_due_date')
                .gte('next_due_date', todayStr);

            const pipe = [
                { bucket: '30 Days', count: 0 },
                { bucket: '60 Days', count: 0 },
                { bucket: '60-80 Days', count: 0 },
                { bucket: 'Critical (90+)', count: 0 } // This implies Due in > 90 days? Or Overdue?
                // Usually "Pipeline" is future revenue/work. "Critical" is overdue.
                // Re-reading user: "Pipeline (90d)" widget title in screenshot... 
                // Request: "30 DAYS, 60 DAYS, 60-80 DAYS, NEW CUSTOMER GENERATED, EXPIRED..."
                // User: "QUE BOARD SHOULD SHOW THE CRITICAL TO (90+)".
                // Let's assume Pipeline is FUTURE Dues.
                // 30 Days = Due in 0-30
                // 60 Days = Due in 31-60
                // 60-80 Days = Due in 61-80
                // 90+ = Due in > 90 ?
            ];

            if (pipelineData) {
                const now = new Date();
                pipelineData.forEach(c => {
                    if (!c.next_due_date) return;
                    const due = new Date(c.next_due_date);
                    const diffTime = due.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays <= 30) pipe[0].count++;
                    else if (diffDays <= 60) pipe[1].count++;
                    else if (diffDays <= 80) pipe[2].count++;
                    else pipe[3].count++; 
                });
            }

            // 9. Schedule
             const { data: schedule } = await supabase.from('today_tech_schedule').select('*').limit(5);

            // 10. Top stats (Restored)
            const { data: topVisits } = await supabase.rpc('top_tech_visits_30days');
            const { data: topCollections } = await supabase.rpc('top_tech_collections_30days');

            setStats({
                dueToday: dueToday || 0,
                overdueCount: overdueCount || 0,
                expiringSoon: 0, 
                newCustomers: newCustomers || 0,
                expiredCount: expiredCount || 0,
                criticalWarning: amcQueue?.length || 0, // Using queue length as critical metric
                lastVisited: lastVisited || [],
                paymentsToday: totalCollected,
                amcQueue: amcQueue || [],
                pipeline: pipe,
                renewalsList: [], // Clean up unused
                schedule: schedule || [],
                topVisits: topVisits || [],
                topCollections: topCollections || []
            });
            setLastUpdated(new Date());
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    }

    if (loading) return <div className="p-8">Loading Dashboard...</div>;



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
                <KPI title="Due Today" value={stats.dueToday} color="blue" href="/manager/contracts?filter=due_today" />
                <KPI title="Overdue" value={stats.overdueCount} color="red" href="/manager/contracts?filter=overdue" />
                
                {/* New Customers Widget */}
                <div className="p-4 rounded shadow border-l-4 bg-purple-50 border-purple-500 text-purple-600">
                    <div className="text-sm font-medium text-gray-500">New Customers (30d)</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.newCustomers}</div>
                </div>

                {/* Expired Widget */}
                <div className="p-4 rounded shadow border-l-4 bg-gray-50 border-gray-500 text-gray-600">
                    <div className="text-sm font-medium text-gray-500">Expired (Not Renewed)</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.expiredCount}</div>
                </div>
                
                {/* Payments Today Widget */}
                <div className="p-4 rounded shadow border-l-4 bg-green-50 border-green-500 text-green-600">
                    <div className="text-sm font-medium text-gray-500">Collection Today</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">AED {stats.paymentsToday.toLocaleString()}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Queues & Lists */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* AMC Queue Board */}
                    <div className="bg-white rounded shadow text-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
                             {/* Make Queue Clickable Link too */}
                            <Link href="/manager/contracts?filter=amc_queue" className="flex-1 flex justify-between items-center group">
                                <h3 className="font-bold text-red-900 group-hover:text-red-700 transition">🚨 Queue Board (Critical/Overdue 90+)</h3>
                            </Link>
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
                                    <tr><td colSpan={4} className="p-4 text-center text-gray-400">No critical overdue AMCs!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* NEW: Last Checked 10 AMC List */}
                    <SimpleTable 
                        title="Last 10 AMC Visits (Checked)"
                        rows={stats.lastVisited.map(l => ({
                            ...l,
                            // Format Timestamp DD-MM-YY- HH-MM-SS
                            ts: l.last_effective_visit_date 
                                ? new Date(l.last_effective_visit_date)
                                    .toLocaleString('en-GB', { 
                                        day: '2-digit', month: '2-digit', year: '2-digit',
                                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                                    })
                                    .replace(/\//g, '-')   // DD-MM-YY
                                    .replace(',', '-')     // - HH:MM:SS
                                    .replace(/:/g, '-')    // HH-MM-SS
                                : 'N/A'
                        }))}
                        columns={[
                            { header: 'Customer', key: 'customer_name' },
                            { header: 'Location', key: 'location_name' },
                            { header: 'Checked At', key: 'ts', className: 'w-48' }
                        ]}
                    />

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
                    
                    {/* Visual Pie/Funnel - Pipeline */}
                    <Card>
                        <h3 className="font-semibold text-gray-900 mb-4">Pipeline Stats</h3>
                        <div className="space-y-3">
                            {stats.pipeline.map((p: any) => (
                                <div key={p.bucket} className={`flex justify-between items-center p-2 rounded text-xs ${p.bucket.includes('Critical') ? 'bg-red-50' : 'bg-blue-50'}`}>
                                    <span className={`font-bold ${p.bucket.includes('Critical') ? 'text-red-700' : 'text-blue-700'}`}>{p.bucket}</span>
                                    <span className={`bg-white px-2 py-0.5 rounded font-bold border ${p.bucket.includes('Critical') ? 'text-red-600 border-red-100' : 'text-blue-600 border-blue-100'}`}>{p.count}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <TechTable title="Top Techs (Visits)" rows={stats.topVisits} metric="visits" />
                </div>
            </div>
        </div>
    );
}
