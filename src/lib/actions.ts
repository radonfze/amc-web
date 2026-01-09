'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createManualContract(formData: FormData) {
    const supabase = await createClient();

    // Fields from Form v1.1
    const customerName = formData.get('customerName') as string || `Client ${formData.get('licenseNumber')}`; // Fallback if empty
    const phone = formData.get('phone') as string;
    const locationName = formData.get('locationName') as string;
    const graNumber = formData.get('graNumber') as string;
    const licenseNumber = formData.get('licenseNumber') as string;
    const area = 'Dubai'; // Default as form doesn't capture area explicitly anymore (relies on GPS)

    // GPS & Distance
    const latitude = parseFloat(formData.get('latitude') as string) || 0;
    const longitude = parseFloat(formData.get('longitude') as string) || 0;
    const distanceKm = parseFloat(formData.get('distance') as string) || 0;

    // Lifecycle
    const amcDate = formData.get('amcDate') as string; // Start
    const renewalDate = formData.get('renewalDate') as string; // End
    const visitDay = parseInt(formData.get('day') as string) || 1;
    const lastRenewed = formData.get('renewedDate') as string;
    const status = formData.get('status') as string;
    const amount = parseFloat(formData.get('amount') as string) || 0;

    // 1. Create or Check Customer
    if (graNumber) {
        const { data: dup } = await supabase.from('customers').select('id').eq('gra_number', graNumber).maybeSingle();
        if (dup) throw new Error(`Customer with GRA ${graNumber} already exists.`);
    }
    if (licenseNumber) {
        const { data: dup } = await supabase.from('customers').select('id').eq('license_number', licenseNumber).maybeSingle();
        if (dup) throw new Error(`Customer with License ${licenseNumber} already exists.`);
    }

    // Check Name Availability (only if explicitly provided)
    if (formData.get('customerName')) {
        const { data: existingName } = await supabase.from('customers').select('id').ilike('name', customerName).maybeSingle();
        if (existingName) {
            throw new Error(`Customer name "${customerName}" is already taken.`);
        }
    }

    let customerId;
    const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
            name: customerName,
            phone,
            area,
            gra_number: graNumber,
            license_number: licenseNumber
        })
        .select()
        .single();

    if (custError) throw new Error("Failed to create customer: " + custError.message);
    customerId = newCustomer.id;

    // 2. Create Location
    const { data: newLoc, error: locError } = await supabase
        .from('customer_locations')
        .insert({
            customer_id: customerId,
            display_name: locationName,
            full_address: '', // Optional
            google_plus_code: area, // Using area as simplistic locator
            latitude,
            longitude,
            distance_km: distanceKm
        })
        .select()
        .single();

    if (locError) throw new Error("Failed to create location: " + locError.message);

    // 3. Create Contract
    const { error: contractError } = await supabase
        .from('amc_contracts')
        .insert({
            customer_location_id: newLoc.id,
            start_date: amcDate,
            end_date: renewalDate,
            status: status,
            amount_total: amount,
            payment_status: 'pending',
            cycle_status: 'ok',
            visit_day: visitDay,
            last_renewed_date: lastRenewed,
            last_effective_visit_date: amcDate, // Initial assumption
            next_due_date: new Date(new Date(amcDate).setDate(new Date(amcDate).getDate() + 90)).toISOString().slice(0, 10)
        });

    if (contractError) throw new Error("Failed to create contract: " + contractError.message);

    revalidatePath('/manager/contracts');
    return { success: true };
}
