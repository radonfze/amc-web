'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';

export default function TechPerformancePage() {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            // Need to join with users to get names. 
            // View doesn't have name, so we fetch view then fetch users or join manually.
            // Supabase view query with join:
            const { data, error } = await supabase
                .from('tech_performance_view')
                .select(`
                    *,
                    users:technician_id ( name )
                `);

            if (error) {
                console.error(error);
                setLoading(false);
                return;
            }

            // Client-side aggregation per technician (View is per day)
            const byTech = new Map<string, any>();

            data?.forEach((row: any) => {
                const key = row.technician_id;
                if (!byTech.has(key)) {
                    byTech.set(key, {
                        technician_id: key,
                        name: row.users?.name || 'Unknown',
                        visits: 0,
                        shopClosed: 0,
                        amount: 0,
                        days: new Set<string>(),
                    });
                }
                const t = byTech.get(key);
                t.visits += row.visits_count;
                t.shopClosed += row.shop_closed_count;
                t.amount += row.amount_collected || 0;
                t.days.add(row.day);
            });

            const rows = Array.from(byTech.values()).map((t) => ({
                ...t,
                avgPerDay: t.days.size ? t.visits / t.days.size : 0,
                shopClosedRate: t.visits ? t.shopClosed / t.visits : 0,
            }));

            setStats(rows);
            setLoading(false);
        }
        load();
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Technician Performance</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <div className="text-gray-500 text-xs uppercase font-bold">Total Visits</div>
                    <div className="text-2xl font-bold">{stats.reduce((acc, c) => acc + c.visits, 0)}</div>
                </Card>
                <Card>
                    <div className="text-gray-500 text-xs uppercase font-bold">Total Collected</div>
                    <div className="text-2xl font-bold text-green-600">AED {stats.reduce((acc, c) => acc + c.amount, 0).toLocaleString()}</div>
                </Card>
                <Card>
                    <div className="text-gray-500 text-xs uppercase font-bold">Active Techs</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.length}</div>
                </Card>
                <Card>
                    <div className="text-gray-500 text-xs uppercase font-bold">Avg Shop Closed Rate</div>
                    <div className="text-2xl font-bold text-orange-500">
                        {(stats.length ? (stats.reduce((a, c) => a + c.shopClosedRate, 0) / stats.length * 100) : 0).toFixed(0)}%
                    </div>
                </Card>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border px-4 py-2 text-left">Technician</th>
                                <th className="border px-4 py-2 text-center">Visits</th>
                                <th className="border px-4 py-2 text-center">Avg / Day</th>
                                <th className="border px-4 py-2 text-center">Shop Closed %</th>
                                <th className="border px-4 py-2 text-right">Collected (AED)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr> :
                                stats.map((r) => (
                                    <tr key={r.technician_id} className="hover:bg-gray-50">
                                        <td className="border px-4 py-2 font-medium">{r.name}</td>
                                        <td className="border px-4 py-2 text-center">{r.visits}</td>
                                        <td className="border px-4 py-2 text-center">{r.avgPerDay.toFixed(1)}</td>
                                        <td className="border px-4 py-2 text-center">
                                            <span className={`px-2 py-1 rounded text-xs text-white ${r.shopClosedRate > 0.3 ? 'bg-red-500' : 'bg-green-500'}`}>
                                                {(r.shopClosedRate * 100).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="border px-4 py-2 text-right font-mono">{r.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
