'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CloudArrowDownIcon, ArrowUpTrayIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
    
    // Duplicate Detection
    duplicateStatus?: 'ok' | 'warning' | 'error';
    duplicateMessage?: string;
};

export default function ImportPage() {
    const [rows, setRows] = useState<ClassifiedRow[]>([]);
    const [summary, setSummary] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [skipInvalid, setSkipInvalid] = useState(true);
    const [rowResults, setRowResults] = useState<any[]>([]);
    const [existingCustomers, setExistingCustomers] = useState<any[]>([]);
    
    // Progress State
    const [progress, setProgress] = useState(0);
    const [importStatus, setImportStatus] = useState('');

    // User's exact requested headers
    const TEMPLATE_HEADERS = [
        "NAME *",
        "LOCATION",
        "GRA No. *",
        "LICENSE NO: *", 
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
        link.setAttribute("download", "amc_import_template_v3_mandatory.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async function fetchExistingCustomers() {
        const { data, error } = await supabase.from('customers').select('id, name, license_number, gra_number');
        if (!error && data) {
            setExistingCustomers(data);
            return data;
        }
        return [];
    }

    // Validate duplicates vs DB and vs CSV itself
    function validateDuplicates(currentRows: ClassifiedRow[], dbCustomers: any[]) {
        return currentRows.map(row => {
            const issues: string[] = [];
            let status: 'ok' | 'warning' | 'error' = 'ok';

            const cleanLic = row.license_no?.trim();
            const cleanGra = row.gra_no?.trim();
            const cleanName = row.NAME?.trim();

            if (!cleanLic && !cleanGra) return { ...row, duplicateStatus: 'ok', duplicateMessage: '' } as ClassifiedRow;

            // 1. Local CSV Check
            const localDupLic = cleanLic && currentRows.some(r => r !== row && r.license_no?.trim() === cleanLic && r.NAME?.trim() !== cleanName);
            const localDupGra = cleanGra && currentRows.some(r => r !== row && r.gra_no?.trim() === cleanGra && r.NAME?.trim() !== cleanName);

            if (localDupLic) issues.push(`Duplicate License in CSV (Different Name)`);
            if (localDupGra) issues.push(`Duplicate GRA in CSV (Different Name)`);

            // 2. DB Check
            if (cleanLic) {
                const dbMatch = dbCustomers.find(c => c.license_number === cleanLic && c.name?.toLowerCase().trim() !== cleanName?.toLowerCase().trim());
                if (dbMatch) issues.push(`License belongs to: ${dbMatch.name}`);
            }
            if (cleanGra) {
                const dbMatch = dbCustomers.find(c => c.gra_number === cleanGra && c.name?.toLowerCase().trim() !== cleanName?.toLowerCase().trim());
                if (dbMatch) issues.push(`GRA belongs to: ${dbMatch.name}`);
            }

            if (issues.length > 0) {
                status = 'warning';
            }

            return {
                ...row,
                duplicateStatus: status,
                duplicateMessage: issues.join(' | ')
            } as ClassifiedRow;
        });
    }

    function handleCellChange(index: number, field: keyof ClassifiedRow, value: string) {
        setRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return validateDuplicates(next, existingCustomers);
        });
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

    function handleResetData() {
        // Use window.prompt to avoid any build tool confusion with 'prompt'
        const confirmText = window.prompt("Type 'DELETE' to confirm clearing all data:");
        if (confirmText === 'DELETE') {
            setLoading(true);
            fetch('/api/admin/clear-data', { method: 'POST' })
                .then(res => {
                    if (res.ok) {
                        alert("Data Cleared Successfully.");
                        window.location.href = '/manager';
                    } else {
                        alert("Failed to clear data.");
                    }
                })
                .catch(e => {
                    alert("Error clearing data: " + e.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setImportStatus('Parsing file & Fetching DB...');
        
        // 1. Fetch DB Customers for Validation
        const dbCustomers = await fetchExistingCustomers();

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rawRows = results.data as Record<string, string>[];
                
                // Filter empty
                const validRawRows = rawRows.filter(r => Object.values(r).some(v => v));

                let classified: ClassifiedRow[] = validRawRows.map((r) => {
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
                    const gra = getVal(['GRA No', 'GRA No.', 'GRA', 'GRA NO', 'GRA Number']);
                    const license = getVal(['LICENSE NO', 'LICENSE NO:', 'LICENSE NO.', 'LIC NO', 'LICENSE', 'License Number']);
                    const contact = getVal(['CONTACT NO', 'CONTACT NO.', 'CONTACT', 'PHONE']);
                    
                    // Capture RAW values for debugging
                    const rawLat = getVal(['LATT', 'LAT', 'LATITUDE']);
                    const rawLng = getVal(['LONGI', 'LONGIT', 'LONG', 'LONGITUDE']);
                    
                    const renewal = getVal(['RENEWAL DATE', 'RENEWAL DATE:', 'RENEWAL']);
                    const amcDate = getVal(['AMC Date', 'AMC Date:', 'AMC START']);
                    const lastChecked = getVal(['Last Checked Date', 'Last Checked']);
                    const nextDue = getVal(['Next AMC Due Date', 'Next Due']);
                    const statusVal = getVal(['Status']);
                    const distVal = getVal(['Distance']);
                    
                    // Match Logic (Checking if IT IS Existing Customer based on GRA/LIC)
                    // Note: This logic assumes if found -> Existing. 
                    // Duplicate logic runs separate to warn if Name mismatch.
                    const match = dbCustomers?.find(
                        (c:any) =>
                            (c.license_number && c.license_number === license && license !== '') ||
                            (c.gra_number && c.gra_number === gra && gra !== '')
                    );

                    let customerType: ClassifiedRow['customerType'] = 'new';
                    let renewalStatus: ClassifiedRow['renewalStatus'] = 'new_customer';

                    if (match) {
                        customerType = 'existing';
                        if (amcDate && amcDate.length > 5) {
                            renewalStatus = 'renewed';
                        } else {
                            renewalStatus = 'not_renewed';
                        }
                        // Check if Name mismatches drastically? handled by duplicates check
                    }

                    // Coord Validation initial
                    const pLat = parseCoordinate(rawLat);
                    const pLng = parseCoordinate(rawLng);
                    let cStatus: any = 'ok';
                    let cMsg = '';
                    if (pLat === 0 && pLng === 0) { cStatus = 'invalid'; cMsg = 'Missing Lat/Lng'; }
                    else if (pLng > 57 || pLng < 51 || pLat > 27 || pLat < 22) { cStatus = 'invalid'; cMsg = 'Out of UAE Bounds'; }

                    return {
                        NAME: name,
                        LOCATION: location,
                        gra_no: gra,
                        license_no: license,
                        contact_no: contact,
                        lat: pLat.toString(),
                        lng: pLng.toString(),
                        rawLat,
                        rawLng,
                        renewal_date: renewal,
                        amc_date: amcDate,
                        customerType,
                        renewalStatus,
                        matchedCustomerId: match?.id,
                        lastCheckedISO: lastChecked,
                        nextDueISO: nextDue,
                        coordStatus: cStatus,
                        coordMessage: cMsg
                    };
                });

                // Apply Duplicate Validation
                classified = validateDuplicates(classified, dbCustomers);
                
                setRows(classified);
                setLoading(false);
                setImportStatus(''); // Clear status
                
                // Update Summary
                const invalid = classified.filter(r => r.coordStatus === 'invalid').length;
                const warnings = classified.filter(r => r.duplicateStatus === 'warning').length;
                setSummary({ total: classified.length, invalidCoords: invalid, duplicates: warnings });
            }
        });
    }

    function buildSummary(classified: ClassifiedRow[]) {
        const existing = classified.filter((r) => r.customerType === 'existing');
        const renewed = existing.filter((r) => r.renewalStatus === 'renewed');
        const notRenewed = existing.filter(
            (r) => r.renewalStatus === 'not_renewed'
        );
        const newCustomers = classified.filter((r) => r.customerType === 'new');
        const duplicates = classified.filter(r => r.duplicateStatus === 'warning');

        return {
            total: classified.length,
            existing: existing.length,
            renewed: renewed.length,
            notRenewed: notRenewed.length,
            newCustomers: newCustomers.length,
            duplicates: duplicates.length
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
        
        let updated = currentRows.map((r) => {
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
            }

            fixed.lat = lat.toString();
            fixed.lng = lng.toString();
            fixed.LATT = fixed.lat;
            fixed.LONGIT = fixed.lng;
            fixed.coordStatus = status;
            fixed.coordMessage = message;

            return fixed;
        });

        // Re-run Duplicate check (important if name/lic/gra changed during analysis or previous steps)
        updated = validateDuplicates(updated, existingCustomers);

        setRows(updated);
        setSummary(buildSummary(updated));
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Import AMC Data (Improved)</h1>
                    <p className="text-gray-500 text-sm">Supports DMS (25-01-00) and Decimal formats. Checks for duplicates.</p>
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
                    <div className="bg-gray-50 p-4 rounded text-sm space-y-1 border border-gray-100 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>Total: <span className="font-bold">{summary.total}</span></div>
                        <div className="text-green-700">Exist/Renew: {summary.renewed}</div>
                        <div className="text-red-700">Not Renewed: {summary.notRenewed}</div>
                        <div className="text-blue-700">New: {summary.newCustomers}</div>
                        <div className="text-orange-600 font-bold flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-4 h-4" /> Duplicates: {summary.duplicates}
                        </div>
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
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-gray-800">Preview (First 50 rows)</h2>
                        <span className="text-xs text-gray-500">Edit fields directly to fix issues</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-medium">
                                <tr>
                                    <th className="px-2 py-2 border">Name</th>
                                    <th className="px-2 py-2 border">License No</th>
                                    <th className="px-2 py-2 border">GRA No</th>
                                    <th className="px-2 py-2 border">Raw Coords</th>
                                    <th className="px-2 py-2 border">Parsed Coords (Lat, Lng)</th>
                                    <th className="px-2 py-2 border">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.slice(0, 50).map((r, i) => (
                                    <tr key={i} className={`hover:bg-gray-50 ${r.coordStatus === 'invalid' || r.duplicateStatus === 'warning' ? 'bg-red-50' : ''}`}>
                                        <td className="px-2 py-2 border max-w-[150px] truncate" title={r.NAME}>{r.NAME}</td>
                                        
                                        {/* Editable License */}
                                        <td className="px-2 py-2 border p-0">
                                            <input 
                                                value={r.license_no} 
                                                onChange={(e) => handleCellChange(i, 'license_no', e.target.value)}
                                                className={`w-full px-2 py-1 bg-transparent focus:bg-white focus:outline-none ${r.duplicateStatus === 'warning' && r.duplicateMessage?.includes('License') ? 'text-red-600 font-bold border-red-300 bg-red-50' : ''}`}
                                            />
                                        </td>

                                        {/* Editable GRA */}
                                        <td className="px-2 py-2 border p-0">
                                            <input 
                                                value={r.gra_no} 
                                                onChange={(e) => handleCellChange(i, 'gra_no', e.target.value)}
                                                className={`w-full px-2 py-1 bg-transparent focus:bg-white focus:outline-none ${r.duplicateStatus === 'warning' && r.duplicateMessage?.includes('GRA') ? 'text-red-600 font-bold border-red-300 bg-red-50' : ''}`}
                                            />
                                        </td>

                                        {/* DEBUG COLUMNS */}
                                        <td className="px-2 py-2 border font-mono text-gray-600 text-[10px]">{r.rawLat}, {r.rawLng}</td>
                                        
                                        <td className="px-2 py-2 border font-mono font-bold">
                                            {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lng).toFixed(5)}
                                        </td>
                                        <td className="px-2 py-2 border">
                                            <div className="flex flex-col gap-1">
                                                {r.coordStatus === 'swapped' && <span className="text-orange-600 font-bold">Swapped</span>}
                                                {r.coordStatus === 'invalid' && (
                                                    <span className="text-red-600 font-bold text-[10px]">{r.coordMessage}</span>
                                                )}
                                                
                                                {r.duplicateStatus === 'warning' && (
                                                    <span className="text-orange-700 font-bold flex items-center gap-1 text-[10px]">
                                                        <ExclamationTriangleIcon className="w-3 h-3" />
                                                        {r.duplicateMessage}
                                                    </span>
                                                )}

                                                {r.coordStatus === 'ok' && r.duplicateStatus !== 'warning' && <span className="text-green-600">OK</span>}
                                            </div>
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
                                        <td className="px-4 py-2 border">{r.index + 1}</td>
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

             <div className="mt-12 pt-8 border-t border-red-200">
                    <h2 className="text-xl font-bold text-red-700 mb-4">Danger Zone</h2>
                    <div className="bg-red-50 border border-red-200 p-6 rounded flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-red-800">Clear All Dashboard Data</h3>
                            <p className="text-sm text-red-600 mt-1">
                                This will permanently delete <strong>ALL</strong> contracts and reset the dashboard to empty.
                            </p>
                        </div>
                        <Button 
                            variant="danger" 
                            onClick={handleResetData}
                        >
                            <TrashIcon className="w-4 h-4 mr-2" />
                            Delete All Data
                        </Button>
                    </div>
                </div>
        </div>
    );
}
