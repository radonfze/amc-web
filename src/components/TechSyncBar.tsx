'use client';

import { useState, useEffect } from 'react';
import { getAllItems, STORES } from '@/lib/idb';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TechSyncBar() {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Poll IDB every 2 seconds to check for pending items
        // In a robust app we'd use an event bus or shared state, but polling is fine for V1 MVP
        const interval = setInterval(async () => {
            try {
                const visits = await getAllItems(STORES.PENDING_VISITS);
                setPendingCount(visits.length);
                // We can detect syncing if count decreases or via prop, but simple count is enough
            } catch (e) {
                console.error(e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    if (pendingCount === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-30">
            <div className="bg-gray-900 text-white rounded-lg shadow-lg p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-sm font-medium">Syncing {pendingCount} update{pendingCount !== 1 ? 's' : ''}...</span>
                </div>
                <div className="text-xs text-gray-400">
                    Auto-sync active
                </div>
            </div>
        </div>
    );
}
