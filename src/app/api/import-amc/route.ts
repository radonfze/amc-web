import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

// --- Helpers ---
function parseDateToISO(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;

    // DD-MM-YY
    const dashParts = s.split('-');
    if (dashParts.length === 3) {
        let [dd, mm, yy] = dashParts;
        if (/^\d+$/.test(mm)) {
            const day = parseInt(dd, 10);
            const month = parseInt(mm, 10);
            let year = parseInt(yy, 10);
            if (year < 100) year += 2000;
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        } else {
            // Month Name
            const monthMap: Record<string, number> = {
                jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
                jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
            };
            const month = monthMap[mm.toLowerCase().substring(0, 3)];
            let year = parseInt(yy, 10);
            if (month && !isNaN(parseInt(dd)) && !isNaN(year)) {
                 const day = parseInt(dd, 10);
                 if (year < 100) year += 2000;
                 const d = new Date(year, month - 1, day);
                 if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            }
        }
    }

    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {}
    
    return null;
}

function fixPhone(raw: string) {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 9) return '0' + digits;
    if (digits.length === 10) return digits;
    return digits; 
}

function fixName(name: string) {
    if (!name) return name;
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const locationMap: Record<string, string> = {
    adhen: 'Adhen', dhaith: 'Dhaith', alghail: 'Al Ghail',
};
function fixLocation(loc: string) {
    if (!loc) return loc;
    const key = loc.toLowerCase().replace(/\s+/g, '');
    return locationMap[key] || loc;
}

export async function POST(req: Request) {
    try {
        const { rows, dryRun, skipInvalid } = await req.json();
        if (!rows || !rows.length) return NextResponse.json({ rowResults: [] });

        const rowResults: any[] = [];
        const BATCH_SIZE = 1; // Keeping 1 for now due to complex "Duplicate Check" logic, but suppressing error throws to avoid full crash
        // Optimizing "Checks" by pre-loading was already done in old code.
        // The issue is sequential await loops.
        // We can run batches of promises.

        let importRunId: number | null = null;
        if (!dryRun) {
            const { data: run } = await supabase.from('import_runs').insert({
                total_rows: rows.length, valid_rows: 0, invalid_rows: 0, skipped_rows: 0,
                new_customers: 0, existing_customers: 0, renewed: 0, not_renewed: 0,
                dry_run: false, skip_invalid: !!skipInvalid
            }).select('id').single();
            importRunId = run?.id || null;
        }

        const { data: allCustomers } = await supabase.from('customers').select('*');
        const { data: allLocations } = await supabase.from('customer_locations').select('*');
        const { data: allTechAreas } = await supabase.from('technician_areas').select('*');
        const { data: allContracts } = await supabase.from('amc_contracts').select('id, customer_location_id, start_date');

        let counters = { valid: 0, invalid: 0, skipped: 0, newCust: 0, existCust: 0, renewed: 0, notRenewed: 0 };

        // Optimization: Create Maps for fast lookup
        // Key: license OR gra -> Customer
        const customerMap = new Map<string, any>(); 
        allCustomers?.forEach((c: any) => {
             if(c.gov_license_no) customerMap.set('LIC:' + c.gov_license_no, c);
             if(c.gra_no) customerMap.set('GRA:' + c.gra_no, c);
             // Name fallback?
             if(c.name) customerMap.set('NAME:' + c.name.toLowerCase(), c);
        });

        // Loop processed sequentially but logic optimized
        // NOTE: We cannot easily Promise.all because Customer creation depends on previous rows (if dupes in CSV)
        
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const cleanLicense = (r['LICENSE NO.'] || '').trim();
            const cleanGra = (r['GRA No.'] || '').trim();
            
            try {
                // Validation
                if (!r.NAME && !cleanLicense) {
                     throw new Error('Missing Name and License');
                }

                const cleanName = fixName(r.NAME);
                const cleanPhone = fixPhone(r['CONTACT NO.']);
                const cleanLocationName = fixLocation(r.LOCATION);

                const latRaw = parseFloat(r.LATT || '0');
                const lngRaw = parseFloat(r.LONGIT || '0');
                let lat = isNaN(latRaw) ? 0 : latRaw;
                let lng = isNaN(lngRaw) ? 0 : lngRaw;
                if ((lat < 20 || lat > 30) && (lng >= 20 && lng <= 30)) { const t = lat; lat = lng; lng = t; }

                const renewalDateISO = parseDateToISO(r['RENEWAL DATE:'] || r['RENEWAL DATE']);
                const amcDateISO = parseDateToISO(r['AMC Date:'] || r['AMC Date']);
                const lastCheckedISO = parseDateToISO(r['Last Checked Date:'] || r['Last Checked Date'] || r['Last Checked']);
                const nextDueISO = parseDateToISO(r['Next AMC Due Date:'] || r['Next AMC Due Date'] || r['Next Due Date']);

                // customer matching
                let customer = customerMap.get('LIC:' + cleanLicense) || customerMap.get('GRA:' + cleanGra) || customerMap.get('NAME:' + cleanName?.toLowerCase());
                
                let customerId = customer?.id;
                let isNewCustomer = false;

                if (!customerId) {
                    if (!dryRun) {
                        const { data: newC, error } = await supabase.from('customers').insert({
                            name: cleanName,
                            gov_license_no: cleanLicense || null,
                            gra_no: cleanGra || null,
                            contact_phone: cleanPhone,
                            area: cleanLocationName
                        }).select().single();
                        
                        if (error) throw new Error('Cust Insert: ' + error.message);
                        customer = newC;
                        customerId = newC.id;
                        
                        // Add to map for subsequent rows
                        if(cleanLicense) customerMap.set('LIC:' + cleanLicense, newC);
                        if(cleanGra) customerMap.set('GRA:' + cleanGra, newC);
                        if(cleanName) customerMap.set('NAME:' + cleanName.toLowerCase(), newC);
                    }
                    isNewCustomer = true;
                    counters.newCust++;
                } else {
                    counters.existCust++;
                }

                // Location Matching (Naive for now: Name match or exact Coords)
                // We'll query DB or check local list if we fetched all? 
                // We fetched allLocations.
                let locationId: number | null = null;
                let existingLoc = allLocations?.find((l:any) => 
                    l.customer_id === customerId && 
                    ( l.display_name === cleanName || (Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lng - lng) < 0.0001) )
                );

                if (!existingLoc) {
                    if(!dryRun) {
                        const { data: newL, error } = await supabase.from('customer_locations').insert({
                            customer_id: customerId,
                            display_name: cleanName,
                            lat, lng, full_address: cleanLocationName,
                            gov_renewal_date: renewalDateISO
                        }).select().single();
                        if(error) throw new Error('Loc Insert: ' + error.message);
                        locationId = newL.id;
                    }
                } else {
                    locationId = existingLoc.id;
                    // Update renewal date?
                    if (!dryRun && renewalDateISO) {
                         await supabase.from('customer_locations').update({ gov_renewal_date: renewalDateISO }).eq('id', locationId);
                    }
                }

                // Contract
                let contractId: number | null = null;
                if (amcDateISO && locationId) {
                    // Check duplicate contract
                    // We can use allContracts array
                    const exists = allContracts?.some((c: any) => c.customer_location_id === locationId && c.start_date === amcDateISO);
                    
                    if (!exists) {
                         // Logic for due date etc
                         const start = new Date(amcDateISO);
                         const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
                         
                         let due: Date | null = null;
                         if (nextDueISO) {
                             due = new Date(nextDueISO);
                         } else {
                             due = new Date(start); 
                             due.setDate(due.getDate() + 90);
                         }
                         
                         let techId = null; 
                         if(allTechAreas) {
                             const t = allTechAreas.find((ta:any) => ta.area && ta.area.toLowerCase() === cleanLocationName?.toLowerCase());
                             if(t) techId = t.technician_id;
                         }

                         if(!dryRun) {
                             const { data: newCont, error } = await supabase.from('amc_contracts').insert({
                                 customer_location_id: locationId,
                                 start_date: amcDateISO,
                                 end_date: end.toISOString(),
                                 status: 'active',
                                 technician_id: techId,
                                 amount_total: 1000,
                                 next_due_date: due?.toISOString(),
                                 last_effective_visit_date: lastCheckedISO || amcDateISO
                             }).select().single();
                             if(error) throw new Error('Contract Insert: ' + error.message);
                             contractId = newCont.id;
                             counters.renewed++;
                         }
                    } else {
                        // Already exists
                    }
                } else {
                    counters.notRenewed++;
                }

                counters.valid++;
                rowResults.push({ index: i, success: true, message: 'Imported' });

            } catch (err: any) {
                counters.invalid++;
                rowResults.push({ index: i, success: false, message: err.message });
            }
        }

        // Final stats update
         if (!dryRun && importRunId) {
            await supabase.from('import_runs').update({
                valid_rows: counters.valid,
                invalid_rows: counters.invalid,
                new_customers: counters.newCust,
                existing_customers: counters.existCust
            }).eq('id', importRunId);
         }

        return NextResponse.json({ rowResults, counters });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Unknown server error' }, { status: 500 });
    }
}
