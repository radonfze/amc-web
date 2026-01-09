'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function TechnicianAreasPage() {
    const [techs, setTechs] = useState<any[]>([]);
    const [areas, setAreas] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        // 1. Get technicians
        const { data: techsData } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'technician');

        // 2. Get existing assignments
        const { data: areasData } = await supabase
            .from('technician_areas')
            .select('id, technician_id, area');

        // 3. Get all distinct areas from customers
        const { data: distinctAreas } = await supabase
            .from('customers')
            .select('area');

        if (distinctAreas) {
            // Filter nulls and duplicates
            const unique = Array.from(new Set(distinctAreas.map(a => a.area).filter(Boolean))).sort();
            setAreas(unique);
        }

        setTechs(techsData || []);
        setAssignments(areasData || []);
        setLoading(false);
    }

    async function toggleAssignment(technicianId: string, area: string) {
        const existing = assignments.find(
            (a) => a.technician_id === technicianId && a.area === area
        );

        if (existing) {
            // Remove
            await supabase.from('technician_areas').delete().eq('id', existing.id);
        } else {
            // Add
            await supabase.from('technician_areas').insert({ technician_id: technicianId, area });
        }
        // Reload to refresh state (or optimistic update)
        // For simplicity, just reload
        loadData();
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Technician Area Assignment</h1>
            <Card>
                {loading ? <p>Loading...</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border px-4 py-2 text-left font-medium text-gray-600">Area</th>
                                    {techs.map((t) => (
                                        <th key={t.id} className="border px-4 py-2 text-center font-medium text-gray-600">{t.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map((area) => (
                                    <tr key={area} className="hover:bg-gray-50">
                                        <td className="border px-4 py-2 font-semibold text-gray-800">{area}</td>
                                        {techs.map((t) => {
                                            const assigned = assignments.some(
                                                (a) => a.technician_id === t.id && a.area === area
                                            );
                                            return (
                                                <td key={t.id} className="border px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => toggleAssignment(t.id, area)}
                                                        className={`px-3 py-1 rounded text-xs transition-colors ${assigned
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                            }`}
                                                    >
                                                        {assigned ? 'Assigned' : 'Assign'}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {areas.length === 0 && <p className="p-4 text-center text-gray-500">No areas found in customer database.</p>}
                    </div>
                )}
            </Card>
        </div>
    );
}
