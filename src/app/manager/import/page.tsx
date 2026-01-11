'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CloudArrowDownIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';

// We map the incoming CSV to a standard internal structure
type Row = {
    NAME: string;
    LOCATION: string;
    gra_no: string;      
    license_no: string;  
    contact_no: string;  
    lat: string;         
    lng: string;         
    renewal_date: string;
    amc_date: string;    
    
    // Debug raw values
    rawLat?: string;
    rawLng?: string;
    
    // For indexing original
    [key: string]: any; 
};

type ClassifiedRow = Row & {
    customerType: 'existing' | 'new';
    renewalStatus: 'renewed' | 'not_renewed' | 'new_customer';
    matchedCustomerId?: number;
    coordStatus?: 'ok' | 'swapped' | 'invalid' | 'parsed_dms';
    coordMessage?: string; // Reason for invalidity
};

export default function ImportPage() {
    const [rows, setRows] = useState<ClassifiedRow[]>([]);
    const [summary, setSummary] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [skipInvalid, setSkipInvalid] = useState(true);
    const [rowResults, setRowResults] = useState<any[]>([]);
    
    // Progress State
    const [progress, setProgress] = useState(0);
    const [importStatus, setImportStatus] = useState('');

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
        "Last Checked Date",
        "Next AMC Due Date",
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
    
    // --- ROBUST COORDINATE PARSER ---
    function parseCoordinate(val: string): number {
        if (!val) return 0;
        
        // Remove known text garbage but keep separators
        let clean = val.trim().replace(/[°'"NSEW]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 1. Check for DMS like "25 01 00" or "25-01-00"
        // Regex allows space, hyphen, colon as separators
        const dmsRegex = /^(\d{1,3})[-: ](\d{1,2})[-: ](\d{1,2}(?:\.\d+)?)$/; 
        const match = clean.match(dmsRegex);
        
        if (match) {
            const deg = parseFloat(match[1]);
            const min = parseFloat(match[2]);
            const sec = parseFloat(match[3]);
            return deg + (min / 60) + (sec / 3600);
        }
        
        // 2. Normal Float (handles 25.123)
        // Check if it really looks like a number
        const floatVal = parseFloat(clean);
        return isNaN(floatVal) ? 0 : floatVal;
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

                    const name = getVal(['NAME', 'CUSTOMER NAME']);
                    const location = getVal(['LOCATION', 'AREA']);
                    const gra = getVal(['GRA No', 'GRA No.', 'GRA', 'GRA NO']);
                    const license = getVal(['LICENSE NO', 'LICENSE NO:', 'LICENSE NO.', 'LIC NO', 'LICENSE']);
                    const contact = getVal(['CONTACT NO', 'CONTACT NO.', 'CONTACT', 'PHONE']);
                    
                    // Capture RAW values for debugging
                    const rawLat = getVal(['LATT', 'LAT', 'LATITUDE']);
                    const rawLng = getVal(['LONGI', 'LONGIT', 'LONG', 'LONGITUDE']);
                    
                    const renewal = getVal(['RENEWAL DATE', 'RENEWAL DATE:', 'RENEWAL']);
                    const amcDate = getVal(['AMC Date', 'AMC Date:', 'AMC START']);
                    
                    // Initial Parse attempt (will be refined in fixAll)
                    // We store raw first
                    
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
                        lat: rawLat, // Start with Raw
                        lng: rawLng, // Start with Raw
                        rawLat,
                        rawLng,
                        renewal_date: renewal,
                        amc_date: amcDate,
                        customerType,
                        renewalStatus,
                        matchedCustomerId: match?.id,
                        
                        // API MAPPING:
                        'LICENSE NO.': license,
                        'GRA No.': gra,
                        'CONTACT NO.': contact,
                        'LATT': rawLat,
                        'LONGIT': rawLng,
                        'RENEWAL DATE:': renewal,
                        'AMC Date:': amcDate,
                        
                        coordStatus: undefined
                    };
                });

                setRows(classified);
                setSummary(buildSummary(classified));
                setLoading(false);
                setRowResults([]); 
                
                // Immediately Run Analysis to show status
                analyzeRows(classified);
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
        if (!rows.length) {
            alert("No rows to import.");
            return;
        }

        const msg = isDryRun 
            ? "Run Simulation? This will not change data." 
            : "⚠️ START LIVE IMPORT? \n\nThis will write to the database. \nMake sure you have reset the DB if this is a fresh import.";
            
        if(!confirm(msg)) return;

        setLoading(true);
        setProgress(0);
        setRowResults([]);
        setImportStatus('Starting...');

        const BATCH_SIZE = 50; 
        const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
        let allResults: any[] = [];
        
        try {
            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = Math.min(start + BATCH_SIZE, rows.length);
                const batch = rows.slice(start, end);

                setImportStatus(`Importing batch ${i + 1} of ${totalBatches} (Rows ${start + 1}-${end})...`);
                
                const res = await fetch('/api/import-amc', {
                    method: 'POST',
                    body: JSON.stringify({ rows: batch, dryRun: isDryRun, skipInvalid }),
                    headers: { 'Content-Type': 'application/json' },
                }).then((r) => r.json());

                if (res.error) throw new Error(res.error);

                 // Accommodate index offset for results
                const batchResults = (res.rowResults || []).map((r: any) => ({
                    ...r,
                    index: r.index + start 
                }));

                allResults = [...allResults, ...batchResults];

                // Update Progress
                setProgress(Math.round(((i + 1) / totalBatches) * 100));
            }
    
            setLoading(false);
            setImportStatus(isDryRun ? 'Simulation Complete' : 'Import Complete');
            
            if (!isDryRun) {
                alert(`Import Complete! Imported ${allResults.filter((r:any) => r.success).length} rows.`);
                window.location.href = '/manager/contracts'; 
            } else {
                alert('Simulation Complete.');
            }
    
            setRowResults(allResults);

        } catch (error: any) {
            setLoading(false);
            console.error(error);
            alert("Import Failed at batch " + importStatus + ": " + error.message);
        }
    }

    // Renamed to analyze to be clear it runs automatically or manually
    function analyzeRows(currentRows: ClassifiedRow[] = rows) {
        
        const updated = currentRows.map((r) => {
            const fixed: ClassifiedRow = { ...r };
            
            // Fix Name capitalization
            if (fixed.NAME) fixed.NAME = fixed.NAME.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
            if (fixed.LOCATION) fixed.LOCATION = fixed.LOCATION.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());

            // Fix Phone 
            if (fixed.contact_no) {
                 const digits = fixed.contact_no.replace(/\D/g, '');
                 if (digits.length === 9) fixed.contact_no = '0' + digits;
                 else if (digits.length === 10) fixed.contact_no = digits;
                 fixed['CONTACT NO.'] = fixed.contact_no;
            }

            // --- ROBUST COORDINATE LOGIC ---
            // 1. Try Parse Raw Lat/Lng
            let lat = parseCoordinate(fixed.rawLat || fixed.LATT || '');
            let lng = parseCoordinate(fixed.rawLng || fixed.LONGI || '');
            
            let status: ClassifiedRow['coordStatus'] = 'ok';
            let message = '';

            if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
                status = 'invalid';
                message = 'Missing/NaN';
            } else {
                // 2. Check Swapped
                // If Lat > 50 (like 55.x) and Lng < 40 (like 25.x), it's swapped
                if (lat > 40 && lng < 40) {
                     const temp = lat; lat = lng; lng = temp;
                     status = 'swapped';
                     message = 'Swapped Lat/Lng';
                }

                // 3. Final Dubai/UAE Check
                // Lat should be 22-27
                // Lng should be 51-57
                if (lat < 22 || lat > 28) {
                    status = 'invalid';
                    message += `Lat ${lat.toFixed(4)} out of UAE range (22-28). `;
                }
                if (lng < 50 || lng > 60) {
                    status = 'invalid';
                    message += `Lng ${lng.toFixed(4)} out of UAE range (50-60). `;
                }
                
                // If we detected DMS (e.g. integer part was changed significantly during parse?)
                // Actually parseCoordinate handles it silently.
            }

            fixed.lat = lat.toString();
            fixed.lng = lng.toString();
            fixed.LATT = fixed.lat;
            fixed.LONGIT = fixed.lng;
            fixed.coordStatus = status;
            fixed.coordMessage = message;

            return fixed;
        });

        setRows(updated);
        setSummary(buildSummary(updated));
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Import AMC Data (Improved)</h1>
                    <p className="text-gray-500 text-sm">Supports DMS (25-01-00) and Decimal formats.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                     <button 
                        type="button"
                        onClick={async () => {
                            if (confirm('DANGER: Wipe database?')) {
                                setLoading(true);
                                await fetch('/api/admin/reset-db', { method: 'POST' });
                                alert('Database wiped.');
                                window.location.reload();
                            }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium flex items-center gap-2"
                    >
                        <TrashIcon className="w-5 h-5" />
                        Reset Database
                    </button>

                     <Button 
                        variant="outline" 
                        onClick={downloadTemplate} 
                        className="flex items-center gap-2"
                    >
                        <CloudArrowDownIcon className="w-5 h-5" /> Template
                    </Button>
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
                        <Button variant="secondary" onClick={() => analyzeRows()} title="Re-run analysis">
                            ↻ Re-Analyze
                        </Button>
                    )}
                </div>

                {loading && (
                    <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 shadow-sm animate-pulse">
                        <div className="flex justify-between text-sm font-bold text-blue-800 mb-2">
                            <span>{importStatus || 'Processing...'}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {summary && !loading && (
                    <div className="bg-gray-50 p-4 rounded text-sm space-y-1 border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>Total: <span className="font-bold">{summary.total}</span></div>
                        <div className="text-green-700">Exist/Renew: {summary.renewed}</div>
                        <div className="text-red-700">Not Renewed: {summary.notRenewed}</div>
                        <div className="text-blue-700">New: {summary.newCustomers}</div>
                    </div>
                )}

                {rows.length > 0 && (
                    <div className="flex flex-col gap-3 pt-4 border-t">
                        <div className="flex flex-wrap gap-4 mt-2">
                            <button 
                                type="button"
                                onClick={() => handleImport(true)} 
                                disabled={loading} 
                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded border border-gray-300 font-medium"
                            >
                                Run Simulation (Dry Run)
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleImport(false)} 
                                disabled={loading} 
                                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-6 py-2 rounded font-bold disabled:opacity-50"
                            >
                                Confirm & Import All
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {rows.length > 0 && rowResults.length === 0 && (
                <Card>
                    <h2 className="font-semibold text-gray-800 mb-4">Preview (First 50 rows)</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-medium">
                                <tr>
                                    <th className="px-2 py-2 border">Name</th>
                                    <th className="px-2 py-2 border">Raw Latt</th>
                                    <th className="px-2 py-2 border">Raw Longi</th>
                                    <th className="px-2 py-2 border">Parsed Coords (Lat, Lng)</th>
                                    <th className="px-2 py-2 border">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.slice(0, 50).map((r, i) => (
                                    <tr key={i} className={`hover:bg-gray-50 ${r.coordStatus === 'invalid' ? 'bg-red-50' : ''}`}>
                                        <td className="px-2 py-2 border max-w-[150px] truncate" title={r.NAME}>{r.NAME}</td>
                                        
                                        {/* DEBUG COLUMNS */}
                                        <td className="px-2 py-2 border font-mono text-gray-600">{r.rawLat}</td>
                                        <td className="px-2 py-2 border font-mono text-gray-600">{r.rawLng}</td>
                                        
                                        <td className="px-2 py-2 border font-mono font-bold">
                                            {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lng).toFixed(5)}
                                        </td>
                                        <td className="px-2 py-2 border">
                                            {r.coordStatus === 'swapped' && <span className="text-orange-600 font-bold">Swapped</span>}
                                            {r.coordStatus === 'invalid' && (
                                                <div className="flex flex-col">
                                                    <span className="text-red-600 font-bold">INVALID</span>
                                                    <span className="text-[9px] text-red-500">{r.coordMessage}</span>
                                                </div>
                                            )}
                                            {r.coordStatus === 'ok' && <span className="text-green-600">OK</span>}
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
                                    <tr key={i} className={r.success ? 'bg-green-50' : 'bg-red-50'}>
                                        <td className="px-4 py-2 border">{r.index + 2}</td>
                                        <td className="px-4 py-2 border font-bold">
                                            {r.success ? <span className="text-green-600">SUCCESS</span> : <span className="text-red-600">FAILED</span>}
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
