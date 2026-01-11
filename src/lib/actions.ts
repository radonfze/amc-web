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

    // 0. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: Please login first");

    // Fields from Form v1.2
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const locationName = formData.get('locationName') as string;
    const graNumber = (formData.get('graNumber') as string)?.trim() || null;
    const licenseNumber = (formData.get('licenseNumber') as string)?.trim() || null;
    const area = 'Dubai';

    // GPS & Distance
    const latitude = parseFloat(formData.get('latitude') as string) || 0;
    const longitude = parseFloat(formData.get('longitude') as string) || 0;
    const distanceKm = parseFloat(formData.get('distance') as string) || 0;

    // Lifecycle
    const amcDate = formData.get('amcDate') as string;
    const renewalDate = formData.get('renewalDate') as string;
    
    // visit_day logic: Derive from amcDate if not provided (Form v1.2 removed the input)
    let visitDay = 1;
    if (amcDate) {
        const d = new Date(amcDate);
        if (!isNaN(d.getTime())) {
            const start = new Date(d.getFullYear(), 0, 0);
            const diff = d.getTime() - start.getTime();
            const oneDay = 1000 * 60 * 60 * 24;
            visitDay = Math.floor(diff / oneDay);
        }
    }

    let lastRenewed: string | null = formData.get('renewedDate') as string;
    if (!lastRenewed || lastRenewed.trim() === '') lastRenewed = null; 
    const status = formData.get('status') as string;
    
    // Financials
    const govtFees = parseFloat(formData.get('govtFees') as string) || 0;
    const amcValue = parseFloat(formData.get('amcValue') as string) || 0;
    const fineAmount = parseFloat(formData.get('fineAmount') as string) || 0;
    const paidAmount = parseFloat(formData.get('paidAmount') as string) || 0;
    
    // Total should match frontend, but let's recalculate or trust frontend?
    // Frontend: Amount = Govt + AMC + Fine
    // Backend should ensure consistency or take 'amount' as single source?
    // Let's use individual components to sum up for 'amount_total' to be safe, 
    // OR trust 'amount' param if passed (frontend calculated it).
    // The table has 'amount_total'
    const amountTotal = parseFloat(formData.get('amount') as string) || (govtFees + amcValue + fineAmount);
    const balanceAmount = amountTotal - paidAmount;

    // Infer Payment Status
    let paymentStatus = 'pending';
    if (paidAmount >= amountTotal && amountTotal > 0) paymentStatus = 'paid_online'; // Assuming paid full
    else if (paidAmount > 0) paymentStatus = 'partial';

    if (!customerName) throw new Error("Customer Name is required");

    // Calculate Next Due Date Safely (only if not provided by user)
    // NOTE: Override nextDueDate using const from earlier logic if needed
    
    const lastCheckedDate = formData.get('lastCheckedDate') as string || null;
    let nextDueDate = formData.get('nextDueDate') as string || null;
    
    if (!nextDueDate && amcDate) {
        const d = new Date(amcDate);
        if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + 90);
            nextDueDate = d.toISOString().slice(0, 10);
        }
    }

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
                amount_total: amountTotal,
                govt_fees: govtFees,
                amc_value: amcValue,
                fine_amount: fineAmount,
                paid_amount: paidAmount,
                balance_amount: balanceAmount,
                payment_status: paymentStatus,
                cycle_status: 'ok',
                visit_day: visitDay,
                last_renewed_date: lastRenewed,
                last_effective_visit_date: lastCheckedDate || amcDate, 
                next_due_date: nextDueDate,
                technician_id: user.id 
            });

        if (contractError) {
            console.error("Contract Create Error:", contractError);
            throw new Error("Failed to create contract: " + contractError.message);
        }

        revalidatePath('/manager/contracts');
        return { success: true };
    } catch (e: any) {
        console.error("Server Action Error (Create Contract):", e);
        throw new Error(e.message || "An unexpected error occurred");
    }
}

export async function updateManualContract(contractId: number, formData: FormData) {
    const supabase = await createClient();

    // 0. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: Please login first");

    // Fields
    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const locationName = formData.get('locationName') as string;
    const graNumber = (formData.get('graNumber') as string)?.trim() || null;
    const licenseNumber = (formData.get('licenseNumber') as string)?.trim() || null;
    
    // GPS
    const latitude = parseFloat(formData.get('latitude') as string) || 0;
    const longitude = parseFloat(formData.get('longitude') as string) || 0;
    const distanceKm = parseFloat(formData.get('distance') as string) || 0;

    // Lifecycle
    const amcDate = formData.get('amcDate') as string;
    const renewalDate = formData.get('renewalDate') as string;
    let lastRenewed: string | null = formData.get('renewedDate') as string;
    if (!lastRenewed || lastRenewed.trim() === '') lastRenewed = null; 
    const status = formData.get('status') as string;

    // Financials
    const govtFees = parseFloat(formData.get('govtFees') as string) || 0;
    const amcValue = parseFloat(formData.get('amcValue') as string) || 0;
    const fineAmount = parseFloat(formData.get('fineAmount') as string) || 0;
    const paidAmount = parseFloat(formData.get('paidAmount') as string) || 0;
    const amountTotal = parseFloat(formData.get('amount') as string) || (govtFees + amcValue + fineAmount);
    const balanceAmount = amountTotal - paidAmount;

    // Payment Status
    let paymentStatus = 'pending';
    if (paidAmount >= amountTotal && amountTotal > 0) paymentStatus = 'paid_online';
    else if (paidAmount > 0) paymentStatus = 'partial';

    // 1. Get Existing Contract to find links
    const { data: contract, error: fetchErr } = await supabase
        .from('amc_contracts')
        .select('customer_location_id, customer_locations(id, customer_id)')
        .eq('id', contractId)
        .single();
    
    if (fetchErr || !contract) throw new Error("Contract not found");

    const locationId = contract.customer_location_id;
    // @ts-ignore
    const customerId = contract.customer_locations?.customer_id;

    // 2. Update Customer (if exists)
    if (customerId) {
        await supabase.from('customers').update({
            name: customerName,
            phone,
            gra_number: graNumber,
            license_number: licenseNumber
        }).eq('id', customerId);
    }

    // 3. Update Location
    if (locationId) {
        await supabase.from('customer_locations').update({
            display_name: locationName,
            latitude,
            longitude,
            distance_km: distanceKm
        }).eq('id', locationId);
    }

    // Date Fields
    const lastCheckedDate = formData.get('lastCheckedDate') as string || null;
    const nextDueDate = formData.get('nextDueDate') as string || null;

    // 4. Update Contract
    const { error: updateErr } = await supabase
        .from('amc_contracts')
        .update({
            start_date: amcDate,
            end_date: renewalDate,
            status: status,
            amount_total: amountTotal,
            govt_fees: govtFees,
            amc_value: amcValue,
            fine_amount: fineAmount,
            paid_amount: paidAmount,
            balance_amount: balanceAmount,
            payment_status: paymentStatus,
            last_renewed_date: lastRenewed,
            last_effective_visit_date: lastCheckedDate,
            next_due_date: nextDueDate
        })
        .eq('id', contractId);

    if (updateErr) throw new Error("Failed to update contract: " + updateErr.message);

    revalidatePath('/manager/contracts');
    revalidatePath(`/manager/contracts/${contractId}`);
    return { success: true };
}
