'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

export default function ImportHistoryPage() {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRuns();
    }, []);

    async function loadRuns() {
        const { data } = await supabase
            .from('import_runs')
            .select('*, users(name)')
            .order('run_at', { ascending: false });

        if (data) setRuns(data);
        setLoading(false);
    }

    async function undoImport(runId: number) {
        if (!confirm('Are you sure you want to revert this import? This will delete all created records.')) return;

        const { error } = await fetch('/api/import-undo', {
            method: 'POST',
            body: JSON.stringify({ importRunId: runId }),
            headers: { 'Content-Type': 'application/json' }
        }).then(r => r.json());

        if (error) {
            alert('Undo failed: ' + error);
        } else {
            alert('Undo successful!');
            loadRuns();
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/manager/import" className="text-gray-500 hover:text-gray-800">← Back</Link>
                <h1 className="text-lg font-bold text-gray-900">Import History</h1>
            </div>

            <Card>
                {loading ? <p className="text-gray-500">Loading history...</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left">
                            <thead className="bg-gray-100 uppercase text-gray-600">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Date</th>
                                    <th className="px-4 py-2 font-medium">User</th>
                                    <th className="px-4 py-2 font-medium">Total</th>
                                    <th className="px-4 py-2 font-medium text-green-700">Valid</th>
                                    <th className="px-4 py-2 font-medium text-red-700">Invalid</th>
                                    <th className="px-4 py-2 font-medium text-yellow-700">Skipped</th>
                                    <th className="px-4 py-2 font-medium">New</th>
                                    <th className="px-4 py-2 font-medium">Updated</th>
                                    <th className="px-4 py-2 font-medium">Renewed</th>
                                    <th className="px-4 py-2 font-medium">Not Renewed</th>
                                    <th className="px-4 py-2 font-medium">Status</th>
                                    <th className="px-4 py-2 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {runs.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-gray-400">No import history found.</td></tr>}
                                {runs.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-600">{new Date(r.run_at).toLocaleString()}</td>
                                        <td className="px-4 py-2">{r.users?.name || 'Unknown'}</td>
                                        <td className="px-4 py-2 font-semibold">{r.total_rows}</td>
                                        <td className="px-4 py-2 text-green-700">{r.valid_rows}</td>
                                        <td className="px-4 py-2 text-red-700">{r.invalid_rows}</td>
                                        <td className="px-4 py-2 text-yellow-700">{r.skipped_rows}</td>
                                        <td className="px-4 py-2">{r.new_customers}</td>
                                        <td className="px-4 py-2">{r.existing_customers}</td>
                                        <td className="px-4 py-2">{r.renewed}</td>
                                        <td className="px-4 py-2">{r.not_renewed}</td>
                                        <td className="px-4 py-2">
                                            {r.dry_run ? <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide">Dry Run</span> :
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide">Imported</span>}
                                        </td>
                                        <td className="px-4 py-2">
                                            {!r.dry_run && (
                                                <button
                                                    onClick={() => undoImport(r.id)}
                                                    className="text-red-600 hover:text-red-800 hover:underline"
                                                >
                                                    Undo
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
