'use client';

import { MapPin, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

type Props = {
    visit: {
        id: number;
        customer_name: string;
        location_name: string;
        time: string; // '09:00 AM'
        status: 'pending' | 'completed' | 'synced' | 'offline_pending';
        type: string; // 'Normal'
        distance?: number;
    };
    onQuickAction: (action: 'complete' | 'closed', id: number) => void;
};

export default function TechVisitCard({ visit, onQuickAction }: Props) {

    const isCompleted = visit.status === 'completed' || visit.status === 'synced' || visit.status === 'offline_pending';

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 active:scale-[0.99] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-gray-900 text-base">{visit.customer_name}</h3>
                    <div className="flex items-center text-gray-500 text-sm mt-0.5">
                        <MapPin className="w-3 h-3 mr-1" />
                        {visit.location_name}
                    </div>
                </div>
                {/* Status Badge */}
                <div>
                    {visit.status === 'offline_pending' && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                            Pending Sync
                        </span>
                    )}
                    {visit.status === 'synced' && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                            Completed
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                    <Clock className="w-3 h-3 mr-1" />
                    {visit.time}
                </div>
                <div className="bg-gray-50 px-2 py-1 rounded">
                    {visit.type}
                </div>
                {visit.distance && (
                    <div className="bg-gray-50 px-2 py-1 rounded">
                        {(visit.distance / 1000).toFixed(1)} km away
                    </div>
                )}
            </div>

            {/* Quick Actions Zone */}
            {!isCompleted ? (
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        href={`/tech/visit/${visit.id}`}
                        className="flex items-center justify-center bg-blue-600 text-white font-bold text-sm py-3 rounded-lg shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
                    >
                        Complete Visit
                    </Link>
                    <button
                        onClick={() => onQuickAction('closed', visit.id)}
                        className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 font-semibold text-sm py-3 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                        Shop Closed
                    </button>
                </div>
            ) : (
                <div className="w-full bg-green-50 text-green-700 text-sm font-semibold py-2 rounded-lg text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Visit Completed
                </div>
            )}
        </div>
    );
}
