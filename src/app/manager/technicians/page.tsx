'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TechnicianRow from '@/components/TechnicianRow';

export default function TechniciansPage() {
    const [techs, setTechs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTechs();
    }, []);

    async function loadTechs() {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'technician')
            .order('name');

        if (data) setTechs(data);
        setLoading(false);
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Technicians</h1>

            {loading ? (
                <p className="text-gray-500">Loading technicians...</p>
            ) : (
                <div className="space-y-3">
                    {techs.length === 0 && <p className="text-gray-500">No technicians found.</p>}
                    {techs.map((t) => (
                        <TechnicianRow key={t.id} tech={t} />
                    ))}
                </div>
            )}
        </div>
    );
}
