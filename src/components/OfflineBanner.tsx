'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Initial check
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="bg-amber-500 text-white text-xs font-bold py-1 px-4 text-center flex items-center justify-center sticky top-0 z-50">
            <WifiOff className="w-3 h-3 mr-2" />
            <span>Offline Mode — Changes will sync automatically</span>
        </div>
    );
}
