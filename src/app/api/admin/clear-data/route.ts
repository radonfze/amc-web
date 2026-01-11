import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY! // strict auth required
        );

        // Delete all contracts. Cascade should handle related visits/payments/events if set up.
        // If not, we might need to delete children first.
        // Assuming CASCADE is configured in DB schema or we just delete contracts.
        
        const { error } = await supabase
            .from('amc_contracts')
            .delete()
            .neq('id', 0); // Delete all where ID is not 0 (effectively all)

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'All contracts cleared.' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
