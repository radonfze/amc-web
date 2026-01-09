import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    const { importRunId } = await req.json();

    if (!importRunId) {
        return NextResponse.json({ error: 'Import Run ID is required' }, { status: 400 });
    }

    // 1. Load all items
    const { data: items, error } = await supabase
        .from('import_run_items')
        .select('*')
        .eq('import_run_id', importRunId);

    if (error || !items) {
        return NextResponse.json({ error: 'Failed to load import items' }, { status: 500 });
    }

    // 2. Delete contracts first
    for (const item of items) {
        if (item.contract_id) {
            await supabase.from('amc_contracts').delete().eq('id', item.contract_id);
        }
    }

    // 3. Delete locations
    for (const item of items) {
        if (item.location_id) {
            await supabase.from('customer_locations').delete().eq('id', item.location_id);
        }
    }

    // 4. Delete customers (only if no other locations exist)
    for (const item of items) {
        if (item.customer_id) {
            const { count } = await supabase
                .from('customer_locations')
                .select('*', { count: 'exact', head: true })
                .eq('customer_id', item.customer_id);

            if (count === 0) {
                await supabase.from('customers').delete().eq('id', item.customer_id);
            }
        }
    }

    // 5. Delete import run record itself to clean up history? 
    // User Prompt didn't specify, but usually "undo" removes the history log or marks it as reverted.
    // We should prob delete it or mark as reverted. Since table structure doesn't have status, we delete.
    await supabase.from('import_runs').delete().eq('id', importRunId);

    return NextResponse.json({ ok: true });
}
