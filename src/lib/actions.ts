'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function searchCustomers(query: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('customers')
        .select('id, name, gra_number, license_number, phone')
        .ilike('name', `%${query}%`)
        .limit(5);
    return data || [];
}

export async function createManualContract(formData: FormData) {
    const supabase = await createClient();

    // Fields from Form v1.1
    // Customer Name is now mandatory and handled strictly
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const locationName = formData.get('locationName') as string;
    const graNumber = formData.get('graNumber') as string;
    const licenseNumber = formData.get('licenseNumber') as string;
    const area = 'Dubai';

    // GPS & Distance
    const latitude = parseFloat(formData.get('latitude') as string) || 0;
    const longitude = parseFloat(formData.get('longitude') as string) || 0;
    const distanceKm = parseFloat(formData.get('distance') as string) || 0;

    // Lifecycle
    const amcDate = formData.get('amcDate') as string;
    const renewalDate = formData.get('renewalDate') as string;
    const visitDay = parseInt(formData.get('day') as string) || 1;
    let lastRenewed: string | null = formData.get('renewedDate') as string;
    if (!lastRenewed || lastRenewed.trim() === '') lastRenewed = null; // Fix: Empty string crashes Postgres Date column
    const status = formData.get('status') as string;
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const govtFees = parseFloat(formData.get('govtFees') as string) || 0;
    const amcValue = parseFloat(formData.get('amcValue') as string) || 0;

    if (!customerName) throw new Error("Customer Name is required");

    // 1. Find or Create Customer
    let customerId;
    let existingCustomer = null;

    try {
        // A. Check by Strict Unique Keys
        if (graNumber) {
            const { data } = await supabase.from('customers').select('id, name').eq('gra_number', graNumber).maybeSingle();
            if (data) existingCustomer = data;
        }
        if (!existingCustomer && licenseNumber) {
            const { data } = await supabase.from('customers').select('id, name').eq('license_number', licenseNumber).maybeSingle();
            if (data) existingCustomer = data;
        }

        // B. Check by Name (if not found by other keys)
        if (!existingCustomer) {
            const { data } = await supabase.from('customers').select('id, name').ilike('name', customerName).maybeSingle();
            if (data) existingCustomer = data;
        }

        if (existingCustomer) {
            // Reuse Existing Customer
            customerId = existingCustomer.id;
        } else {
            // Create New Customer
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

            if (custError) {
                console.error("Customer Create Error:", custError);
                throw new Error("Failed to create customer: " + custError.message);
            }
            customerId = newCustomer.id;
        }

        // 2. Create Location
        const { data: newLoc, error: locError } = await supabase
            .from('customer_locations')
            .insert({
                customer_id: customerId,
                display_name: locationName,
                full_address: '',
                google_plus_code: area,
                latitude,
                longitude,
                distance_km: distanceKm
            })
            .select()
            .single();

        if (locError) {
            console.error("Location Create Error:", locError);
            throw new Error("Failed to create location: " + locError.message);
        }

        // 3. Create Contract
        const { error: contractError } = await supabase
            .from('amc_contracts')
            .insert({
                customer_location_id: newLoc.id,
                start_date: amcDate,
                end_date: renewalDate,
                status: status,
                amount_total: amount,
                govt_fees: govtFees,
                amc_value: amcValue,
                payment_status: 'pending',
                cycle_status: 'ok',
                visit_day: visitDay,
                last_renewed_date: lastRenewed,
                last_effective_visit_date: amcDate,
                next_due_date: new Date(new Date(amcDate).setDate(new Date(amcDate).getDate() + 90)).toISOString().slice(0, 10)
            });

        if (contractError) {
            console.error("Contract Create Error:", contractError);
            throw new Error("Failed to create contract: " + contractError.message);
        }

        revalidatePath('/manager/contracts');
        return { success: true };
    } catch (e: any) {
        console.error("Server Action Error:", e);
        throw new Error(e.message || "An unexpected error occurred");
    }
}
