'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Customer = {
    id: number;
    name: string;
    gov_license_no: string | null;
    gra_no: string | null;
    area: string | null;
};

type DuplicateGroup = {
    key: string;
    customers: Customer[];
};

export default function CustomerMergePage() {
    const [groups, setGroups] = useState<DuplicateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        findDuplicates();
    }, []);

    async function findDuplicates() {
        setLoading(true);
        const { data } = await supabase.from('customers').select('*');
        if (!data) {
            setLoading(false);
            return;
        }

        // Detecting duplicates client-side for simplicity (avoid complex SQL for now)
        // Group by License, GRA, or Name+Area
        const groupsMap = new Map<string, Customer[]>();

        data.forEach(c => {
            if (c.gov_license_no) {
                const key = 'LIC:' + c.gov_license_no;
                if (!groupsMap.has(key)) groupsMap.set(key, []);
                groupsMap.get(key)?.push(c);
            }
            if (c.gra_no) {
                const key = 'GRA:' + c.gra_no;
                if (!groupsMap.has(key)) groupsMap.set(key, []);
                groupsMap.get(key)?.push(c);
            }
            // Fuzzy name check is hard, let's do exact name match for now
            if (c.name) {
                const key = 'NAME:' + c.name.toLowerCase().trim();
                // only if > 1 char
                if (c.name.length > 2) {
                    if (!groupsMap.has(key)) groupsMap.set(key, []);
                    // Avoid adding same customer multiple times to same key bucket if iterating?
                    // Actually logic flaw: one customer can belong to multiple buckets.
                    // We simplistically iterate.
                    groupsMap.get(key)?.push(c);
                }
            }
        });

        // Filter groups with > 1 customer & Deduplicate within group & deduplicate groups
        const uniqueGroups: DuplicateGroup[] = [];
        const seenGroupKeys = new Set<string>();

        for (const [key, customers] of groupsMap.entries()) {
            if (customers.length < 2) continue;

            // Dedupe customers in this group
            const uniqueCusts = Array.from(new Set(customers.map(c => c.id)))
                .map(id => customers.find(c => c.id === id)!);

            if (uniqueCusts.length < 2) continue;

            // Create a unique key for the group based on sorted IDs to avoid "Group A+B" vs "Group B+A"
            const groupSig = uniqueCusts.map(c => c.id).sort().join(',');

            if (seenGroupKeys.has(groupSig)) continue;
            seenGroupKeys.add(groupSig);

            uniqueGroups.push({
                key: key, // Descriptive key (e.g. LIC:123)
                customers: uniqueCusts
            });
        }

        setGroups(uniqueGroups);
        setLoading(false);
    }

    async function mergeGroup(group: DuplicateGroup, primaryId: number) {
        if (!confirm('Merge all other customers in this group into the Primary? This is irreversible.')) return;
        setProcessing(true);

        const others = group.customers.filter(c => c.id !== primaryId);

        for (const duplicate of others) {
            const { error } = await supabase.rpc('merge_customers', {
                primary_id: primaryId,
                duplicate_id: duplicate.id
            });

            if (error) {
                alert('Failed to merge customer ' + duplicate.id + ': ' + error.message);
                setProcessing(false);
                return;
            }
        }

        alert('Merge successful!');
        // Remove this group from UI logic
        findDuplicates(); // reload
        setProcessing(false);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Customer Merge Tool</h1>
            <p className="text-gray-600">Identify and merge duplicate customer records.</p>

            {loading ? <p>Scanning database...</p> : (
                <div className="space-y-8">
                    {groups.length === 0 && <p className="text-green-600">No duplicates found based on License, GRA, or exact Name.</p>}

                    {groups.map((g) => (
                        <Card key={g.key} className="p-4 border-l-4 border-yellow-400">
                            <div className="mb-4">
                                <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                    MATCH: {g.key}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {g.customers.map(c => (
                                    <div key={c.id} className="border p-3 rounded bg-gray-50 flex flex-col justify-between">
                                        <div className="text-sm space-y-1">
                                            <div className="font-bold">{c.name}</div>
                                            <div>ID: {c.id}</div>
                                            <div>Area: {c.area || '-'}</div>
                                            <div>Lic: {c.gov_license_no || '-'}</div>
                                            <div>GRA: {c.gra_no || '-'}</div>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="mt-3 text-xs w-full"
                                            onClick={() => mergeGroup(g, c.id)}
                                            disabled={processing}
                                        >
                                            Set as Primary & Merge Others
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
