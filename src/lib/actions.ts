'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createManualContract(formData: FormData) {
    const supabase = await createClient();

    const customerName = formData.get('customerName') as string;
    const phone = formData.get('phone') as string;
    const locationName = formData.get('locationName') as string;
    const area = formData.get('area') as string;
    const address = formData.get('address') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;

    // 1. Create or Find Customer
    // Check by phone to avoid dupes
    let customerId;
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .single();

    if (existingCustomer) {
        customerId = existingCustomer.id;
    } else {
        const { data: newCustomer, error: custError } = await supabase
            .from('customers')
            .insert({ name: customerName, phone, area })
            .select()
            .single();
        if (custError) throw new Error("Failed to create customer: " + custError.message);
        customerId = newCustomer.id;
    }

    // 2. Create Location
    const { data: newLoc, error: locError } = await supabase
        .from('customer_locations')
        .insert({
            customer_id: customerId,
            display_name: locationName,
            full_address: address, // Assuming no GPS for manual entry yet, or could add field
            google_plus_code: area // Using area as simplistic locator
        })
        .select()
        .single();

    if (locError) throw new Error("Failed to create location: " + locError.message);

    // 3. Create Contract (Active)
    const { error: contractError } = await supabase
        .from('amc_contracts')
        .insert({
            customer_location_id: newLoc.id,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            amount_total: amount,
            payment_status: 'pending',
            cycle_status: 'ok',
            next_due_date: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 90)).toISOString().slice(0, 10) // +90 days
        });

    if (contractError) throw new Error("Failed to create contract: " + contractError.message);

    revalidatePath('/manager/contracts');
    return { success: true };
}
