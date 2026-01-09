'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type Row = {
    NAME: string;
    LOCATION: string;
    'GRA No.': string;
    'LICENSE NO.': string;
    'CONTACT NO.': string;
    LATT: string;
    LONGIT: string;
    'RENEWAL DATE:': string;
    'AMC Date:': string;
};

type ClassifiedRow = Row & {
    customerType: 'existing' | 'new';
    renewalStatus: 'renewed' | 'not_renewed' | 'new_customer';
    matchedCustomerId?: number;
};

export default function ImportPage() {
    const [rows, setRows] = useState<ClassifiedRow[]>([]);
    const [summary, setSummary] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [dryRun, setDryRun] = useState(true);
    const [skipInvalid, setSkipInvalid] = useState(true);
    const [rowResults, setRowResults] = useState<any[]>([]);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        Papa.parse<Row>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rawRows = results.data;
                // Load master customers once to match against
                // Select logic: we need gov_license_no and gra_no to match
                // We fetch all to do in-memory match (assuming list < 10k rows is fine for client)
                const { data: customers } = await supabase
                    .from('customers')
                    .select('id, gov_license_no, gra_no');

                const classified: ClassifiedRow[] = rawRows.map((r) => {
                    const license = (r['LICENSE NO.'] || '').trim();
                    const gra = (r['GRA No.'] || '').trim();

                    const match = customers?.find(
                        (c) =>
                            (c.gov_license_no && c.gov_license_no === license && license !== '') ||
                            (c.gra_no && c.gra_no === gra && gra !== '')
                    );

                    let customerType: ClassifiedRow['customerType'] = 'new';
                    let renewalStatus: ClassifiedRow['renewalStatus'] = 'new_customer';

                    if (match) {
                        customerType = 'existing';
                        const amcDate = (r['AMC Date:'] || '').trim();
                        // Simple check: if date exists -> renewed, otherwise -> not_renewed
                        if (amcDate && amcDate.length > 5) {
                            renewalStatus = 'renewed';
                        } else {
                            renewalStatus = 'not_renewed';
                        }
                    }

                    return {
                        ...r,
                        customerType,
                        renewalStatus,
                        matchedCustomerId: match?.id,
                    };
                });

                setRows(classified);
                setSummary(buildSummary(classified));
                setLoading(false);
                setRowResults([]); // clear previous results on new file
            },
        });
    }

    function buildSummary(classified: ClassifiedRow[]) {
        const existing = classified.filter((r) => r.customerType === 'existing');
        const renewed = existing.filter((r) => r.renewalStatus === 'renewed');
        const notRenewed = existing.filter(
            (r) => r.renewalStatus === 'not_renewed'
        );
        const newCustomers = classified.filter((r) => r.customerType === 'new');

        return {
            total: classified.length,
            existing: existing.length,
            renewed: renewed.length,
            notRenewed: notRenewed.length,
            newCustomers: newCustomers.length,
        };
    }

    async function handleImport() {
        if (!rows.length) return;
        setLoading(true);
        setRowResults([]);

        const res = await fetch('/api/import-amc', {
            method: 'POST',
            body: JSON.stringify({ rows, dryRun, skipInvalid }),
            headers: { 'Content-Type': 'application/json' },
        }).then((r) => r.json());

        setLoading(false);

        if (res.error) {
            alert('Import failed: ' + res.error);
        } else {
            if (!dryRun) {
                alert('Import process completed.');
            } else {
                alert('Dry run check completed. No data written.');
            }
        }

        setRowResults(res.rowResults || []);
    }

    // Helper functions for Fix All (Client-side mirror of server logic)
    function fixName(name: string) {
        if (!name) return name;
        return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function fixPhone(raw: string) {
        if (!raw) return null;
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 9) return '0' + digits;
        if (digits.length === 10) return digits;
        return digits;
    }

    function fixAll() {
        const updated = rows.map((r) => {
            const fixed: any = { ...r };
            fixed.NAME = fixName(r.NAME);

            // Fix Location Name (Simple trimming/capitalization for client side)
            if (fixed.LOCATION) fixed.LOCATION = fixName(fixed.LOCATION);

            // Phone
            const fixedPhone = fixPhone(r['CONTACT NO.']);
            if (fixedPhone) fixed['CONTACT NO.'] = fixedPhone;

            // Dates (We don't have the sophisticated parser here, so we skip complex date fixing client-side 
            // OR we import the parser. For MVP, we trust the server parser or just do basic trimming)
            // But let's at least trim.
            if (fixed['RENEWAL DATE:']) fixed['RENEWAL DATE:'] = fixed['RENEWAL DATE:'].trim();
            if (fixed['AMC Date:']) fixed['AMC Date:'] = fixed['AMC Date:'].trim();

            // Lat/Lng Swapping
            let lat = parseFloat(r.LATT || '');
            let lng = parseFloat(r.LONGIT || '');
            if (!isNaN(lat) && !isNaN(lng)) {
                if ((lat < 20 || lat > 30) && (lng >= 20 && lng <= 30)) {
                    const temp = lat; lat = lng; lng = temp;
                    fixed.LATT = lat.toString();
                    fixed.LONGIT = lng.toString();
                }
            }

            return fixed;
        });

        // Re-run classification
        // We reuse the original classification logic, but since we don't have the 'customers' list handy in this scope easily
        // (it was in handleFile scope), we might need to store customers in state or refetch.
        // Simplest: just update rows. The server does the real classification match anyway.
        // But the summary depends on it. 
        // Let's just update rows for now. If user wants to re-classify, they might need to reload or we just trust the old classification 
        // until import runs. Or we can just keep the old classification flags but update the data content.

        setRows(updated);
        alert('Applied auto-fixes to ' + updated.length + ' rows.');
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Import AMC Data</h1>
                <a href="/manager/import/history" className="text-sm text-blue-600 hover:underline">View Import History →</a>
            </div>

            <Card className="space-y-4">
                <h2 className="font-semibold text-gray-800">1. Upload CSV</h2>
                <div className="flex gap-4 items-center">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFile}
                        className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
                    />
                    {rows.length > 0 && (
                        <Button variant="secondary" onClick={fixAll} title="Auto-fix common errors (Names, Phones, Coords)">
                            ⚡ Fix All
                        </Button>
                    )}
                </div>

                {loading && <p className="text-sm text-blue-600">Processing...</p>}

                {summary && (
                    <div className="bg-gray-50 p-4 rounded text-sm space-y-1 border border-gray-100">
                        <div className="font-medium text-gray-900">Summary:</div>
                        <div>Total rows: <span className="font-bold">{summary.total}</span></div>
                        <div className="text-green-700">Existing customers: {summary.existing}</div>
                        <div className="pl-4">→ Renewed: {summary.renewed}</div>
                        <div className="pl-4">→ Not renewed: {summary.notRenewed}</div>
                        <div className="text-blue-700">New customers: {summary.newCustomers}</div>
                    </div>
                )}

                {rows.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={dryRun}
                                onChange={(e) => setDryRun(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            Dry Run (Check for errors without saving)
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={skipInvalid}
                                onChange={(e) => setSkipInvalid(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            Skip Invalid Rows (Don't stop on error)
                        </label>

                        <div className="flex gap-2">
                            <Button onClick={handleImport} disabled={loading} className="w-full md:w-auto">
                                {loading ? 'Processing...' : dryRun ? 'Run Simulation (Dry Run)' : 'Confirm & Import All'}
                            </Button>

                            {rowResults.some(r => !r.success) && (
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        const failed = rowResults.filter(r => !r.success);
                                        const csvRows = [
                                            'Row,Message',
                                            ...failed.map(r => `${r.index + 2},"${r.message}"`)
                                        ];
                                        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'failed_rows.csv';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="w-full md:w-auto bg-gray-600 hover:bg-gray-700 text-white"
                                >
                                    Export Failed Rows
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {/* Results Table */}
            {rowResults.length > 0 && (
                <Card>
                    <h2 className="font-semibold text-gray-800 mb-4">Import Results</h2>
                    <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-xs text-left border">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 border">Row</th>
                                    <th className="px-4 py-2 border">Status</th>
                                    <th className="px-4 py-2 border">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowResults.map((r, i) => (
                                    <tr key={i} className={r.success ? 'bg-green-50' : (r.message && r.message.startsWith('Skipped') ? 'bg-yellow-50' : 'bg-red-50')}>
                                        <td className="px-4 py-2 border">{r.index + 2}</td>
                                        <td className="px-4 py-2 border font-bold">
                                            {r.success ? <span className="text-green-600">SUCCESS</span> :
                                                (r.message && r.message.startsWith('Skipped') ? <span className="text-yellow-600">SKIPPED</span> : <span className="text-red-600">FAILED</span>)}
                                        </td>
                                        <td className="px-4 py-2 border text-gray-700">{r.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {rows.length > 0 && rowResults.length === 0 && (
                <Card>
                    <h2 className="font-semibold text-gray-800 mb-4">Preview (First 20 rows)</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-medium">
                                <tr>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Location</th>
                                    <th className="px-4 py-2">License / GRA</th>
                                    <th className="px-4 py-2">AMC Date</th>
                                    <th className="px-4 py-2">Type</th>
                                    <th className="px-4 py-2">Renewal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.slice(0, 20).map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 font-medium">{r.NAME}</td>
                                        <td className="px-4 py-2 text-gray-500">{r.LOCATION}</td>
                                        <td className="px-4 py-2">{r['LICENSE NO.']} / {r['GRA No.']}</td>
                                        <td className="px-4 py-2">{r['AMC Date:']}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded-full ${r.customerType === 'existing' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {r.customerType === 'existing' ? 'Existing' : 'New'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded-full ${r.renewalStatus === 'renewed' ? 'bg-green-100 text-green-700' :
                                                r.renewalStatus === 'not_renewed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {r.renewalStatus.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
