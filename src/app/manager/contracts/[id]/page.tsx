'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import ContractDetailCard from '@/components/ContractDetailCard';
import { AuditLog } from '@/components/AuditLog';

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [contract, setContract] = useState<any>(null);
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [renewing, setRenewing] = useState(false);

    useEffect(() => {
        async function load() {
            const { data: c } = await supabase
                .from('amc_contracts')
                .select(`
          *,
          customer_locations (
             display_name,
             customers ( id, name, contact_phone )
          ),
          users:technician_id ( name ) 
        `)
                .eq('id', resolvedParams.id)
                .single();

            if (c) {
                setContract(c);
                const { data: v } = await supabase
                    .from('amc_visits')
                    .select('*')
                    .eq('amc_contract_id', c.id)
                    .order('visit_date', { ascending: false });
                setVisits(v || []);
            }
            setLoading(false);
        }
        load();
    }, [resolvedParams.id]);

    async function handleRenew() {
        if (!confirm('Renew this contract for another year? This will create a new Active contract and archive this one.')) return;
        setRenewing(true);

        // We can call an RPC function or a server action. 
        // Since we created 'renew_contract' RPC in SQL:
        const newStart = new Date(contract.end_date);
        newStart.setDate(newStart.getDate() + 1); // Start next day

        const { data: newId, error } = await supabase.rpc('renew_contract', {
            p_old_id: contract.id,
            p_new_start: newStart.toISOString().slice(0, 10)
        });

        if (error) {
            alert('Renewal failed: ' + error.message);
            setRenewing(false);
        } else {
            alert('Contract Renewed! Redirecting to new contract...');
            window.location.href = `/manager/contracts/${newId}`;
        }
    }

    if (loading) return <div className="p-8">Loading...</div>;
    if (!contract) return <div className="p-8">Contract not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <h1 className="text-2xl font-bold text-gray-900">Contract #{contract.id}</h1>
                <div className="space-x-2">
                    {contract.status === 'active' || contract.status === 'overdue' || contract.status === 'due_soon' ? (
                        <Button onClick={handleRenew} disabled={renewing} className="bg-green-600 hover:bg-green-700">
                            {renewing ? 'Renewing...' : 'Renew Contract'}
                        </Button>
                    ) : (
                        <span className="px-3 py-1 bg-gray-200 rounded text-gray-600 font-medium capitalize">
                            {contract.status}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ContractDetailCard contract={contract} />

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-bold text-gray-900">Visit History</h3>
                        </div>
                        {visits.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">No visits recorded yet.</div>
                        ) : (
                            <div>
                                {visits.map((v) => (
                                    <div key={v.id} className="px-6 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${v.visit_type === 'normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {v.visit_type?.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(v.visit_date).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-800 mb-1">{v.remarks || 'No remarks'}</div>
                                        <div className="text-xs text-gray-500 flex gap-4">
                                            <span>Distance: {v.distance_from_site_m ? v.distance_from_site_m.toFixed(1) : 'N/A'} m</span>
                                            {v.payment_collected && (
                                                <span className="text-green-600 font-medium">Payment Collected: AED {v.payment_amount}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <Card>
                        <h3 className="font-semibold text-gray-900 mb-4">Audit Log</h3>
                        <div className="max-h-96 overflow-y-auto">
                            <AuditLog entityType="contract" entityId={contract.id} />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
