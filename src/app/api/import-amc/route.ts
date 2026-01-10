import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

function parseDateToISO(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;

    // Try DD-MM-YY or DD-MM-YYYY
    const dashParts = s.split('-');
    if (dashParts.length === 3 && /^\d+$/.test(dashParts[0])) {
        let [dd, mm, yy] = dashParts;

        // Month as number
        if (/^\d+$/.test(mm)) {
            const day = parseInt(dd, 10);
            const month = parseInt(mm, 10);
            let year = parseInt(yy, 10);
            if (year < 100) year += 2000; // 25 -> 2025

            const d = new Date(year, month - 1, day);
            if (isNaN(d.getTime())) return null;

            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dt = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dt}`;
        }
    }

    // Try DD-MMM-YY (e.g., 17-Dec-25)
    const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const parts = s.split('-');
    if (parts.length === 3) {
        const [dd, mon, yy] = parts;
        const day = parseInt(dd, 10);
        const month = monthMap[mon.toLowerCase()];
        let year = parseInt(yy, 10);

        if (month && !isNaN(day) && !isNaN(year)) {
            if (year < 100) year += 2000;
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dt = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dt}`;
            }
        }
    }

    // Fallback: let Date try
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

// Helper functions for Auto-Fix
function fixPhone(raw: string) {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, ''); // remove spaces, dashes
    if (digits.length === 9) return '0' + digits;
    if (digits.length === 10) return digits;
    return digits; // fallback
}

function fixName(name: string) {
    if (!name) return name;
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const locationMap: Record<string, string> = {
    adhen: 'Adhen',
    dhaith: 'Dhaith',
    alghail: 'Al Ghail',
    // Add more as needed
};

function fixLocation(loc: string) {
    if (!loc) return loc;
    const key = loc.toLowerCase().replace(/\s+/g, '');
    return locationMap[key] || loc;
}

export async function POST(req: Request) {
    try {
        const { rows, dryRun, skipInvalid } = await req.json();
        const rowResults: any[] = [];

        let importRunId: number | null = null;

        if (!dryRun) {
            const { data: run, error: runErr } = await supabase
                .from('import_runs')
                .insert({
                    total_rows: rows.length,
                    valid_rows: 0, invalid_rows: 0, skipped_rows: 0,
                    new_customers: 0, existing_customers: 0, renewed: 0, not_renewed: 0,
                    dry_run: false,
                    skip_invalid: !!skipInvalid
                })
                .select('id')
                .single();

            if (runErr) throw new Error('Failed to initialize import run: ' + (runErr.message || console.error(runErr)));
            importRunId = run.id;
        }

        // Pre-fetch all customers & locations for duplicate detection
        const { data: allCustomers } = await supabase.from('customers').select('*');
        const { data: allLocations } = await supabase.from('customer_locations').select('*');
        const { data: allTechAreas } = await supabase.from('technician_areas').select('*');

        // Counters for final update
        let validCount = 0;
        let invalidCount = 0;
        let skippedCount = 0;
        let newCustCount = 0;
        let existCustCount = 0;
        let renewedCount = 0;
        let notRenewedCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r.NAME && !r['LICENSE NO.']) continue;

            try {
                // --- 1. Auto-Fix ---
                const cleanLicense = (r['LICENSE NO.'] || '').trim();
                const cleanGra = (r['GRA No.'] || '').trim();
                const cleanName = fixName(r.NAME);
                const cleanPhone = fixPhone(r['CONTACT NO.']);
                const cleanLocationName = fixLocation(r.LOCATION);

                // --- 2. Validation ---
                if (!cleanLicense && !cleanGra) {
                    if (!skipInvalid) throw new Error('Missing license and GRA number');
                    rowResults.push({ index: i, success: false, message: 'Skipped: Missing license and GRA number' });
                    skippedCount++;
                    continue;
                }

                const latRaw = parseFloat(r.LATT || '0');
                const lngRaw = parseFloat(r.LONGIT || '0');
                let lat = isNaN(latRaw) ? 0 : latRaw;
                let lng = isNaN(lngRaw) ? 0 : lngRaw;

                if (Number.isNaN(lat) || Number.isNaN(lng)) {
                    if (!skipInvalid) throw new Error('Invalid coordinates');
                    rowResults.push({ index: i, success: false, message: 'Skipped: Invalid coordinates' });
                    skippedCount++;
                    continue;
                }

                // Fix swapped Lat/Lng (Basic Heuristic for UAE: Lat ~22-26, Lng ~51-56)
                if ((lat < 20 || lat > 30) && (lng >= 20 && lng <= 30)) {
                    const temp = lat; lat = lng; lng = temp;
                }

                const renewalDateISO = parseDateToISO(r['RENEWAL DATE:']);
                const amcDateISO = parseDateToISO(r['AMC Date:']);

                // --- 3. Duplicate Detection & Merge ---

                // Check for Existing Customer
                let existingCustomer = allCustomers?.find(c =>
                    (cleanLicense && c.gov_license_no === cleanLicense) ||
                    (cleanGra && c.gra_no === cleanGra)
                );

                if (!existingCustomer && cleanName && allCustomers) {
                    existingCustomer = allCustomers.find(c => c.name && c.name.toLowerCase() === cleanName.toLowerCase());
                }

                let customerId = existingCustomer?.id;
                let isNewCustomer = false;

                if (!customerId) {
                    // Create New Customer
                    if (!dryRun) {
                        const { data: newCust, error: custErr } = await supabase
                            .from('customers')
                            .insert({
                                name: cleanName,
                                gov_license_no: cleanLicense || null,
                                gra_no: cleanGra || null,
                                contact_phone: cleanPhone,
                                area: cleanLocationName
                            })
                            .select('id')
                            .single();

                        if (custErr) throw new Error('Customer insert failed: ' + custErr.message);
                        customerId = newCust.id;
                    } else {
                        customerId = -1; // Mock ID
                    }
                    isNewCustomer = true;
                    newCustCount++;
                } else {
                    existCustCount++;
                    // UPDATE Existing Customer (if fields provided)
                    if (!dryRun && cleanPhone && existingCustomer && existingCustomer.contact_phone !== cleanPhone) {
                        await supabase
                            .from('customers')
                            .update({ contact_phone: cleanPhone })
                            .eq('id', customerId);
                    }
                }

                // Check for Existing Location
                let locationId: number | null = null;
                let existingLocation = null;

                if (customerId && (!isNewCustomer || dryRun) && allLocations) {
                    existingLocation = allLocations.find(l =>
                        l.customer_id === customerId &&
                        (
                            (l.display_name && cleanName && l.display_name.toLowerCase() === cleanName.toLowerCase()) ||
                            (Math.abs((l.lat || 0) - lat) < 0.0002 && Math.abs((l.lng || 0) - lng) < 0.0002)
                        )
                    );
                }

                if (existingLocation) {
                    locationId = existingLocation.id;
                    // UPDATE Existing Location (Renewal Date is important)
                    if (!dryRun && renewalDateISO && existingLocation.gov_renewal_date !== renewalDateISO) {
                        await supabase
                            .from('customer_locations')
                            .update({ gov_renewal_date: renewalDateISO })
                            .eq('id', locationId);
                    }
                } else {
                    // Create New Location
                    if (!dryRun) {
                        const { data: loc, error: locErr } = await supabase
                            .from('customer_locations')
                            .insert({
                                customer_id: customerId,
                                display_name: cleanName,
                                lat,
                                lng,
                                full_address: cleanLocationName,
                                gov_renewal_date: renewalDateISO
                            })
                            .select('id')
                            .single();

                        if (locErr) throw new Error('Location insert failed: ' + locErr.message);
                        locationId = loc.id;
                    } else {
                        locationId = -1;
                    }
                }

                // --- 4. Contract Creation ---
                let contractId: number | null = null;

                if (amcDateISO) {
                    const start = new Date(amcDateISO);
                    const end = new Date(start);
                    end.setFullYear(end.getFullYear() + 1);
                    const due = new Date(start);
                    due.setDate(due.getDate() + 90);

                    // 4b. Auto-assign Technician
                    let techId: string | null = null;
                    if (allTechAreas) {
                        const match = allTechAreas.find(t => t.area && t.area.toLowerCase() === cleanLocationName?.toLowerCase());
                        if (match) techId = match.technician_id;
                    }

                     // Check for duplicate contract
                    let existingContract = null;
                    if (locationId !== -1) {
                         const { data: ec } = await supabase
                            .from('amc_contracts')
                            .select('id')
                            .eq('customer_location_id', locationId)
                            .eq('start_date', amcDateISO)
                            .maybeSingle();
                         existingContract = ec;
                    }

                    if (!existingContract) {
                        if (!dryRun) {
                            const { data: contract, error: contractErr } = await supabase
                                .from('amc_contracts')
                                .insert({
                                    customer_location_id: locationId,
                                    start_date: amcDateISO,
                                    end_date: end.toISOString(),
                                    status: 'active',
                                    amount_total: 1000,
                                    amount_police: 550,
                                    amount_company: 450,
                                    payment_status: 'pending',
                                    cycle_status: 'ok',
                                    next_due_date: due.toISOString(),
                                    last_effective_visit_date: amcDateISO,
                                    technician_id: techId
                                })
                                .select('id')
                                .single();

                            if (contractErr) throw new Error('Contract insert failed: ' + contractErr.message);
                            contractId = contract.id;
                            renewedCount++;
                        }
                    } else {
                         contractId = existingContract.id;
                         // Just link it, don't duplicate
                    }
                } else {
                    notRenewedCount++;
                }

                // --- 5. Undo Tracking ---
                if (!dryRun && importRunId && contractId) {
                    await supabase.from('import_run_items').insert({
                        import_run_id: importRunId,
                        customer_id: isNewCustomer ? customerId : null,
                        location_id: (!existingLocation && locationId !== -1) ? locationId : null,
                        contract_id: contractId
                    });
                }

                validCount++;
                rowResults.push({
                    index: i,
                    success: true,
                    message: dryRun ? 'Valid (dry run)' : (isNewCustomer ? 'Imported New Customer' : (existingLocation ? 'Active Contract on Existing Location' : 'Added New Location to Valid Customer')),
                    isDuplicate: !isNewCustomer && !!existingLocation
                });

            } catch (err: any) {
                rowResults.push({
                    index: i,
                    success: false,
                    message: err.message || 'Unknown error',
                });
                if (!rowResults[rowResults.length - 1].message.startsWith('Skipped')) {
                    invalidCount++;
                }
            }
        }

        // Update Import Run Summary & Quality Score
        if (!dryRun && importRunId) {
            const total = rows.length || 1;
            const validity = validCount / total;
            const completeness = (total - skippedCount) / total;
            const consistency = (validCount - invalidCount) / total; 

            const score = Math.floor((0.5 * validity + 0.3 * completeness + 0.2 * consistency) * 100);

            await supabase.from('import_runs').update({
                valid_rows: validCount,
                invalid_rows: invalidCount,
                skipped_rows: skippedCount,
                new_customers: newCustCount,
                existing_customers: existCustCount,
                renewed: renewedCount,
                not_renewed: notRenewedCount,
                quality_score: score
            }).eq('id', importRunId);
        }

        return NextResponse.json({ error: null, rowResults });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json(
            { error: e.message || 'Unknown error', rowResults: [] },
            { status: 500 }
        );
    }
}
