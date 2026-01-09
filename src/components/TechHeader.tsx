'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wifi, WifiOff, Map as MapIcon, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function TechHeader() {
    const [isOnline, setIsOnline] = useState(true);
    const [techName, setTechName] = useState('Technician');
    const router = useRouter();

    useEffect(() => {
        // Check online status
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Get Tech Name
        async function getName() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // In a real app we'd fetch profile name, for now user email or 'Tech'
                // const { data } = await supabase.from('profiles').select('name').eq('id', user.id).single();
                // setTechName(data?.name || 'Technician');
                // For V1 MVP fast path:
                setTechName('Technician');
            }
        }
        getName();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="sticky top-0 z-20 bg-white shadow-sm">
            {/* Offline Banner Integrated */}
            {!isOnline && (
                <div className="bg-amber-500 text-white text-xs font-bold py-1 px-2 text-center flex items-center justify-center">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Offline Mode
                </div>
            )}

            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                    <h1 className="text-lg font-bold text-gray-900 leading-tight">Hello, {techName}</h1>
                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/tech/map" className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition">
                        <MapIcon className="w-5 h-5" />
                    </Link>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>
        </div>
    );
}
