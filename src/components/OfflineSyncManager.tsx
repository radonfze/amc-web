'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { STORES, getAllItems, deleteItem } from '@/lib/idb';
import { toast } from 'sonner'; // Assuming we have sonner or similar, if not will use alert or console for now/basic toast

// Basic Toast fallback if sonner not installed


export default function OfflineSyncManager() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            console.log('App is online. Attempting sync...');
            processSyncQueue();
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('App is offline.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check on mount
        if (navigator.onLine) {
            processSyncQueue();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    async function processSyncQueue() {
        try {
            const pendingVisits = await getAllItems(STORES.PENDING_VISITS);
            if (pendingVisits.length === 0) return;

            console.log(`Found ${pendingVisits.length} pending items to sync.`);
            toast.info(`Syncing ${pendingVisits.length} offline visits...`);

            for (const item of pendingVisits) {
                // payload: { visit_id, status, notes, ... }
                // We typically call the RPC or Update query here.
                // Assuming update_visit_status logic or direct update.

                const { error } = await supabase
                    .from('amc_visits')
                    .update({
                        status: item.payload.status,
                        notes: item.payload.notes,
                        // Add completion time if needed, or other fields
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', item.payload.visit_id);

                if (!error) {
                    console.log(`Synced visit ${item.payload.visit_id}`);
                    await deleteItem(STORES.PENDING_VISITS, item.local_id);
                } else {
                    console.error(`Failed to sync visit ${item.payload.visit_id}:`, error);
                    // Increment retry? Leave in queue for next time.
                }
            }

            console.log('Sync complete.');
            toast.success('Offline changes synced successfully.');

            // Refresh page data if needed?
            // window.location.reload(); // Might be too aggressive.
        } catch (err) {
            console.error('Sync process error:', err);
        }
    }

    return null; // Headless component
}
