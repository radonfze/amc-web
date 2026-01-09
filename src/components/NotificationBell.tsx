'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Bell } from 'lucide-react';

export function NotificationBell() {
    const [items, setItems] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        load();
        // Optional: Realtime subscription could go here
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    async function load() {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10);
        setItems(data || []);
    }

    async function markRead(id: number) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setItems(items.filter(i => i.id !== id));
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-900 transition"
            >
                <Bell size={20} />
                {items.length > 0 && (
                    <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {items.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white shadow-xl rounded-lg border border-gray-100 text-sm z-20 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-semibold text-gray-700 flex justify-between">
                            <span>Notifications</span>
                            {items.length > 0 && (
                                <button onClick={() => items.forEach(i => markRead(i.id))} className="text-xs text-blue-600 hover:underline">
                                    Mark all read
                                </button>
                            )}
                        </div>
                        {items.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-xs">No new notifications</div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto">
                                {items.map((n) => (
                                    <div
                                        key={n.id}
                                        className="block px-4 py-3 border-b hover:bg-gray-50 transition group relative"
                                    >
                                        <Link href={`/manager/contracts/${n.entity_id}`} onClick={() => markRead(n.id)}>
                                            <div className="font-semibold text-gray-800 mb-0.5">{n.title}</div>
                                            <div className="text-gray-600 text-xs mb-1 line-clamp-2">{n.body}</div>
                                            <div className="text-[10px] text-gray-400">
                                                {new Date(n.created_at).toLocaleString()}
                                            </div>
                                        </Link>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                            className="absolute top-2 right-2 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100"
                                            title="Mark read"
                                        >
                                            •
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
