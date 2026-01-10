'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CloudArrowDownIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

// We map the incoming CSV to a standard internal structure
type Row = {
    NAME: string;
    LOCATION: string;
    gra_no: string;      // form 'GRA No.'
    license_no: string;  // form 'LICENSE NO:' or 'LICENSE NO.'
    contact_no: string;  // form 'CONTACT NO'
    lat: string;         // form 'LATT'
    lng: string;         // form 'LONGI' or 'LONGIT'
    renewal_date: string;// form 'RENEWAL DATE' or 'RENEWAL DATE:'
    amc_date: string;    // form 'AMC Date' or 'AMC Date:'
    // Extras
    days_from?: string;  
    renewed?: string;
    status?: string;
    distance?: string;
    
    // For indexing original
    [key: string]: any; 
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
    const [skipInvalid, setSkipInvalid] = useState(true);
    const [rowResults, setRowResults] = useState<any[]>([]);

    // User's exact requested headers
    const TEMPLATE_HEADERS = [
        "NAME",
        "LOCATION",
        "GRA No.",
        "LICENSE NO:", 
        "CONTACT NO",
        "LATT",
        "LONGI",
        "RENEWAL DATE",
        "AMC Date",
        "Days from Last Check date",
        "Renewed",
        "Status",
        "Distance"
    ];

    function downloadTemplate() {
        const csvContent = TEMPLATE_HEADERS.join(",") + "\n"; 
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "amc_import_template_v2.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rawRows = results.data as Record<string, string>[];
                
                // Fetch Master Data
                const { data: customers } = await supabase
                    .from('customers')
                    .select('id, gov_license_no, gra_no');

                const classified: ClassifiedRow[] = rawRows.map((r) => {
                    // 1. Normalize Headers (Fuzzy Match)
                    const getVal = (candidates: string[]) => {
                        for (const key of Object.keys(r)) {
                            // Normalize key: remove spaces, colons, dots, uppercase
                            const normKey = key.trim().toUpperCase().replace(/[:.]/g, ''); 
                            // Check candidates
                            if (candidates.some(c => normKey === c.toUpperCase().replace(/[:.]/g, ''))) {
                                return r[key]?.trim() || '';
                            }
                        }
                        return '';
                    };

                    const name = getVal(['NAME']);
                    const location = getVal(['LOCATION']);
                    const gra = getVal(['GRA No', 'GRA No.']);
                    const license = getVal(['LICENSE NO', 'LICENSE NO:', 'LICENSE NO.']);
                    const contact = getVal(['CONTACT NO', 'CONTACT NO.', 'CONTACT']);
                    const lat = getVal(['LATT', 'LAT']);
                    const lng = getVal(['LONGI', 'LONGIT', 'LONG']);
                    const renewal = getVal(['RENEWAL DATE', 'RENEWAL DATE:', 'RENEWAL']);
                    const amcDate = getVal(['AMC Date', 'AMC Date:']);
                    
                    // Match Logic
                    const match = customers?.find(
                        (c) =>
                            (c.gov_license_no && c.gov_license_no === license && license !== '') ||
                            (c.gra_no && c.gra_no === gra && gra !== '')
                    );

                    let customerType: ClassifiedRow['customerType'] = 'new';
                    let renewalStatus: ClassifiedRow['renewalStatus'] = 'new_customer';

                    if (match) {
                        customerType = 'existing';
                        // Simple check: if date exists -> renewed, otherwise -> not_renewed
                        if (amcDate && amcDate.length > 5) {
                            renewalStatus = 'renewed';
                        } else {
                            renewalStatus = 'not_renewed';
                        }
                    }

                    return {
                        NAME: name,
                        LOCATION: location,
                        gra_no: gra,
                        license_no: license,
                        contact_no: contact,
                        lat,
                        lng,
                        renewal_date: renewal,
                        amc_date: amcDate,
                        customerType,
                        renewalStatus,
                        matchedCustomerId: match?.id,
                        
                        // API MAPPING:
                        'LICENSE NO.': license,
                        'GRA No.': gra,
                        'CONTACT NO.': contact,
                        'LATT': lat,
                        'LONGIT': lng,
                        'RENEWAL DATE:': renewal,
                        'AMC Date:': amcDate,
                        
                        // Pass others through
                        'Days from': '',
                        'Renewed': '',
                        'Status': '',
                        'Distance': ''
                    };
                });

                setRows(classified);
                setSummary(buildSummary(classified));
                setLoading(false);
                setRowResults([]); 
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

    async function handleImport(isDryRun: boolean) {
        if (!rows.length) return;
        setLoading(true);
        setRowResults([]);

        const res = await fetch('/api/import-amc', {
            method: 'POST',
            body: JSON.stringify({ rows, dryRun: isDryRun, skipInvalid }),
            headers: { 'Content-Type': 'application/json' },
        }).then((r) => r.json());

        setLoading(false);

        if (res.error) {
            alert('Import failed: ' + res.error);
        } else {
            console.log("Import result", res);
        }

        setRowResults(res.rowResults || []);
    }

    // Client-side fix functions
    function fixAll() {
        const updated = rows.map((r) => {
            const fixed: any = { ...r };
            
            // Fix Name capitalization
            if (fixed.NAME) fixed.NAME = fixed.NAME.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
            if (fixed.LOCATION) fixed.LOCATION = fixed.LOCATION.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

            // Fix Phone (remove non-digits, ensure leading 0)
            if (fixed.contact_no) {
                 const digits = fixed.contact_no.replace(/\D/g, '');
                 if (digits.length === 9) fixed.contact_no = '0' + digits;
                 else if (digits.length === 10) fixed.contact_no = digits;
                 // Sync back to API key
                 fixed['CONTACT NO.'] = fixed.contact_no;
            }

            // Lat/Lng Swapping
            let lat = parseFloat(r.lat || '');
            let lng = parseFloat(r.lng || '');
            if (!isNaN(lat) && !isNaN(lng)) {
                if ((lat < 20 || lat > 30) && (lng >= 20 && lng <= 30)) {
                    const temp = lat; lat = lng; lng = temp;
                    fixed.lat = lat.toString();
                    fixed.lng = lng.toString();
                    // Sync back
                    fixed.LATT = fixed.lat;
                    fixed.LONGIT = fixed.lng;
                }
            }

            return fixed;
        });

        setRows(updated);
        // alert('Applied auto-fixes to ' + updated.length + ' rows.'); 
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Import AMC Data</h1>
                <div className="flex gap-4">
                     <Button 
                        variant="outline" 
                        onClick={downloadTemplate} 
                        className="flex items-center gap-2"
                        title="Download empty CSV template matching required format"
                    >
                        <CloudArrowDownIcon className="w-5 h-5" /> Download Template
                    </Button>
                    <a href="/manager/import/history" className="text-sm text-blue-600 hover:underline flex items-center">
                        View Import History →
                    </a>
                </div>
            </div>

            <Card className="space-y-4">
                <h2 className="font-semibold text-gray-800">1. Upload CSV</h2>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-full">
                         <input
                            type="file"
                            accept=".csv"
                            onChange={handleFile}
                            className="hidden" 
                            id="file-upload"
                        />
                        <label 
                            htmlFor="file-upload" 
                            className="cursor-pointer flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-600 font-medium"
                        >
                            <ArrowUpTrayIcon className="w-6 h-6 text-gray-400" />
                            {rows.length > 0 ? "Change File" : "Click to Upload CSV"}
                        </label>
                    </div>

                    {rows.length > 0 && (
                        <Button variant="secondary" onClick={fixAll} title="Auto-fix common errors (Names, Phones, Coords)">
                            ⚡ Fix All
                        </Button>
                    )}
                </div>

                {loading && <p className="text-sm text-blue-600 animate-pulse">Processing...</p>}

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
                    <div className="flex flex-col gap-3 pt-4 border-t">
                        <h3 className="font-semibold text-gray-800">2. Import Options</h3>
                        
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={skipInvalid}
                                onChange={(e) => setSkipInvalid(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            Skip Invalid Rows (Don't stop on error)
                        </label>

                        <div className="flex flex-wrap gap-4 mt-2">
                             {/* Simulation Button */}
                            <Button 
                                onClick={() => handleImport(true)} 
                                disabled={loading} 
                                variant="outline"
                                className="w-full md:w-auto"
                            >
                                {loading ? 'Processing...' : 'Run Simulation (Dry Run)'}
                            </Button>

                            {/* Actual Import Button */}
                            <Button 
                                onClick={() => {
                                    if(confirm("Are you sure you want to import ALL valid rows? This will update the database.")) {
                                        handleImport(false);
                                    }
                                }} 
                                disabled={loading} 
                                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            >
                                Confirm & Import All
                            </Button>

                             {rowResults.some(r => !r.success) && (
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        const failed = rowResults.filter(r => !r.success);
                                        const csvRows = [
                                            'Row,Message',
                                            ...failed.map(r => `${r.index + 2},"${(r.message || "").replace(/"/g, '""')}"`)
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
                                    <th className="px-4 py-2">Contact</th>
                                    <th className="px-4 py-2">Coordinates</th>
                                    <th className="px-4 py-2">Renewal Date</th>
                                    <th className="px-4 py-2">AMC Date</th>
                                    <th className="px-4 py-2">Type</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.slice(0, 20).map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 font-medium">{r.NAME}</td>
                                        <td className="px-4 py-2 text-gray-500">{r.LOCATION}</td>
                                        <td className="px-4 py-2">{r.license_no} / {r.gra_no}</td>
                                        <td className="px-4 py-2">{r.contact_no}</td>
                                        <td className="px-4 py-2">{r.lat && r.lng ? `${r.lat}, ${r.lng}` : '-'}</td>
                                        <td className="px-4 py-2">{r.renewal_date}</td>
                                        <td className="px-4 py-2">{r.amc_date}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded-full ${r.customerType === 'existing' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {r.customerType === 'existing' ? 'Exist' : 'New'}
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

            {/* Results Table */}
            {rowResults.length > 0 && (
                <Card>
                    <h2 className="font-semibold text-gray-800 mb-4">Import Results</h2>
                    <div className="max-h-96 overflow-auto">
                        <table className="min-w-full text-xs text-left border">
                            <thead className="bg-gray-100 sticky top-0">
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
        </div>
    );
}
