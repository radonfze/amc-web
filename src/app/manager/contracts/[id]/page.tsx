'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import ContractDetailCard from '@/components/ContractDetailCard';
import { AuditLog } from '@/components/AuditLog';
import { useRouter } from 'next/navigation';
import { 
  PrinterIcon, 
  PencilIcon, 
  EyeIcon, 
  TrashIcon, 
  XCircleIcon 
} from '@heroicons/react/24/outline';

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [contract, setContract] = useState<any>(null);
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [renewing, setRenewing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
             // 1. debug access 
             console.log("Loading contract:", resolvedParams.id);

            // First, try a simple fetch to see if we can access the contract at all
            const { data: simpleC, error: simpleError } = await supabase
                .from('amc_contracts')
                .select('id')
                .eq('id', resolvedParams.id)
                .single();

            if (simpleError) {
                console.error("Simple fetch error:", simpleError);
                setErrorMsg(`Error accessing contract table: ${simpleError.message} (${simpleError.code})`);
                setLoading(false);
                return;
            }

            if (!simpleC) {
                setErrorMsg(`Contract #${resolvedParams.id} does not exist in the database (Simple fetch returned null).`);
                setLoading(false);
                return;
            }

            // If simple fetch works, try the full fetch with relations
            const { data: c, error } = await supabase
                .from('amc_contracts')
                .select(`
          *,
          customer_locations (
             display_name,
             full_address,
             customers ( id, name, contact_phone, license_number, contact_person, phone )
          ),
          users:technician_id ( name ) 
        `)
                .eq('id', resolvedParams.id)
                .single();

            if (error) {
                console.error("Full fetch error:", error);
                // If the full fetch fails but simple worked, it's likely a relation permission issue
                setErrorMsg(`Error fetching contract details (likely permission on related tables): ${error.message}`);
                // We might still want to show what we have from simple fetch? No, simple fetch is just ID.
            } else if (c) {
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

        const newStart = new Date(contract.end_date);
        newStart.setDate(newStart.getDate() + 1); 

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

    async function handleCancel() {
        if (!confirm('Are you sure you want to CANCEL this contract? This action cannot be easily undone.')) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('amc_contracts')
            .update({ status: 'cancelled', terminated_at: new Date().toISOString() })
            .eq('id', contract.id);

        if (error) {
            alert('Failed to cancel: ' + error.message);
        } else {
            setContract({ ...contract, status: 'cancelled' });
        }
        setActionLoading(false);
    }

    async function handleDelete() {
        if (!confirm('DANGER: This will PERMANENTLY DELETE the contract and its history. Are you absolutely sure?')) return;
        setActionLoading(true);
        const { error } = await supabase
            .from('amc_contracts')
            .delete()
            .eq('id', contract.id);

        if (error) {
            alert('Failed to delete: ' + error.message);
            setActionLoading(false);
        } else {
            router.push('/manager/contracts');
        }
    }

    if (loading) return <div className="p-8">Loading Contract Details...</div>;
    // Show a better error or empty state if not found
    if (!contract) return (
        <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <div className="bg-red-50 p-6 rounded-full mb-4">
                <XCircleIcon className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-700">Contract Load Error</h2>
            <p className="text-red-700 mt-2 mb-6 max-w-lg font-mono text-sm bg-red-100 p-4 rounded border border-red-200">
                {errorMsg || "Unknown error: Contract found but data is null."}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/manager/contracts')}>Back to Contracts List</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Contract #{contract.id}
                        <EyeIcon className="w-5 h-5 text-gray-400" title="Viewing Mode" />
                    </h1>
                    <p className="text-sm text-gray-500">
                        Client: <span className="font-medium text-gray-900">{contract.customers?.name || contract.customer_name}</span>
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()} title="Print Contract">
                        <PrinterIcon className="w-4 h-4 mr-1" /> Print
                    </Button>
                    {/* Placeholder for Edit - assumes /edit route or similar */}
                    <Button variant="outline" size="sm" onClick={() => router.push(`/manager/contracts/${contract.id}/edit`)} disabled={contract.status === 'cancelled' || contract.status === 'renewed'} title="Edit Contract">
                         <PencilIcon className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    
                    {contract.status === 'active' || contract.status === 'due_soon' || contract.status === 'overdue' ? (
                         <>
                            <Button size="sm" onClick={handleRenew} disabled={renewing} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                                {renewing ? 'Renewing...' : 'Renew'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={actionLoading} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                <XCircleIcon className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                         </>
                    ) : null}

                    {(contract.status === 'draft' || contract.status === 'cancelled') && (
                        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={actionLoading} className="text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <TrashIcon className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <ContractDetailCard contract={contract} />

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Visit History</h3>
                            <span className="text-xs text-gray-500">{visits.length} visits</span>
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
