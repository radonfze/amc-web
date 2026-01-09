'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PaymentRow from '@/components/PaymentRow';

export default function PaymentsPage() {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPayments();
    }, []);

    async function loadPayments() {
        // Note: This matches the user's requested query, assuming foreign key relationships exist
        // amc_contracts_view is a view, so we can't join it directly via supabase-js easily unless we define relationship manually or just fetch separately.
        // However, the user provided exact code: .select('*, users(name), amc_contracts_view(customer_name, location_name)')
        // Supabase JS relationships work on keys. amc_contracts table has fks. The view does not have FKs defined in Supabase unless inferred.
        // To make this robust, we might need to join 'amc_contracts' (the table) instead of the view for the relation, or rely on View if we set it up.
        // Let's try to query the payments table and join meaningful relations.

        // Correction: Payments has amc_contract_id -> amc_contracts. amc_contracts has -> customer_location -> customer.
        // This deep nesting is hard in one SDK call.
        // BUT the user's prompt implies a simpler path.
        // Let's stick to the user's Code IF possible. User code:
        // .from('payments').select('*, users(name), amc_contracts_view(customer_name, location_name)')
        // Relationships on views are tricky in PostgREST unless explicitly defined.
        // A safer bet for now is to join 'amc_contracts' which is a real table, and fetch contract info.
        // But 'amc_contracts' doesn't have name/location directly (normalized).

        // Hack/Fix: I will fetch payments and then manually enrich or just display simplified info to avoid errors, 
        // OR try to fetch `amc_contracts(..., customer_locations(...))`

        const { data, error } = await supabase
            .from('payments')
            .select(`
        *,
        users (name),
        amc_contracts (
            id,
            total_amount: amount_total, -- ALIASING
            customer_locations (
                display_name,
                customers (name)
            )
        )
      `)
            .order('collected_at', { ascending: false });

        if (error) {
            console.error("Error loading payments:", error);
        }

        if (data) {
            // FLATTERN data to match PaymentRow expectation (amc_contracts_view.customer_name)
            const flatPayments = data.map((p: any) => ({
                ...p,
                amc_contracts_view: {
                    customer_name: p.amc_contracts?.customer_locations?.customers?.name || 'Unknown',
                    location_name: p.amc_contracts?.customer_locations?.display_name || 'Unknown'
                },
                users: p.users // preserve user info
            }));
            setPayments(flatPayments);
        }
        setLoading(false);
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Payments Report</h1>
                <span className="text-sm text-gray-500">Total Collected: AED {payments.reduce((acc, p) => acc + (p.amount || 0), 0)}</span>
            </div>

            {loading ? (
                <p className="text-gray-500">Loading payments...</p>
            ) : (
                <div className="space-y-3">
                    {payments.length === 0 && <p className="text-gray-500">No payments recorded.</p>}
                    {payments.map((p) => (
                        <PaymentRow key={p.id} payment={p} />
                    ))}
                </div>
            )}
        </div>
    );
}
