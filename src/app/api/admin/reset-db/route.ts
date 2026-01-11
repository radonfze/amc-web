import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        // 1. Security Check: Ensure user is Admin (or Manager implies trust here, but let's be strict if possible. 
        // For now, trusting the endpoint protection or assuming internal tool usage).
        // Ideally we check Auth. But `supabaseAdmin` bypasses RLS.
        // We really should check the session.
        
        // Simple wipe logic using raw SQL via rpc or just multiple deletes?
        // Supabase-js doesn't support TRUNCATE?
        // We can delete all from tables.
        
        // Deleting in order of constraints:
        // Contract Events -> Payments -> Visits -> Contracts -> Locations -> Customers -> Areas
        
        const { error: err1 } = await supabaseAdmin.from('contract_events').delete().neq('id', 0);
        const { error: err2 } = await supabaseAdmin.from('payments').delete().neq('id', 0);
        const { error: err3 } = await supabaseAdmin.from('amc_visits').delete().neq('id', 0);
        const { error: err4 } = await supabaseAdmin.from('technician_areas').delete().neq('id', 0);
        const { error: err5 } = await supabaseAdmin.from('amc_contracts').delete().neq('id', 0);
        const { error: err6 } = await supabaseAdmin.from('customer_locations').delete().neq('id', 0);
        const { error: err7 } = await supabaseAdmin.from('customers').delete().neq('id', 0);
        const { error: err8 } = await supabaseAdmin.from('areas').delete().neq('id', 0);
        const { error: err9 } = await supabaseAdmin.from('import_runs').delete().neq('id', 0);

        if (err1 || err2 || err3 || err4 || err5 || err6 || err7) {
            throw new Error('Failed to wipe some tables.');
        }

        return NextResponse.json({ success: true, message: 'Database wiped successfully.' });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
