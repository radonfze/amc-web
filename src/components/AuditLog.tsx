'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';

export function AuditLog({ entityType, entityId }: { entityType: string, entityId: number }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            const { data } = await supabase
                .from('audit_log')
                .select(`
            *,
            users:changed_by ( name )
        `)
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .order('changed_at', { ascending: false });

            setLogs(data || []);
            setLoading(false);
        }
        fetchLogs();
    }, [entityType, entityId]);

    if (loading) return <div className="text-sm text-gray-500 animate-pulse">Loading history...</div>;
    if (!logs.length) return <div className="text-sm text-gray-400 italic">No history found.</div>;

    return (
        <div className="space-y-3">
            {logs.map(log => (
                <div key={log.id} className="text-sm border-l-2 border-gray-300 pl-3 py-1">
                    <div className="flex justify-between text-gray-500 text-xs">
                        <span>{new Date(log.changed_at).toLocaleString()}</span>
                        <span>by {log.users?.name || 'System/Unknown'}</span>
                    </div>
                    <div className="font-medium text-gray-800">
                        {log.action.toUpperCase()}
                    </div>
                    {/* Diff View (Simplified) */}
                    {log.action === 'update' && log.old_value && log.new_value && (
                        <div className="text-xs mt-1 space-y-1 bg-gray-50 p-2 rounded">
                            {Object.keys(log.new_value).map(key => {
                                const oldV = log.old_value[key];
                                const newV = log.new_value[key];
                                if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
                                    return (
                                        <div key={key} className="grid grid-cols-[100px_1fr]">
                                            <span className="text-gray-500 font-mono">{key}:</span>
                                            <span>
                                                <span className="line-through text-red-400 mr-2">{String(oldV).slice(0, 20)}</span>
                                                <span className="text-green-600">{String(newV).slice(0, 20)}</span>
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
