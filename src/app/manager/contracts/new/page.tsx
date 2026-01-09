'use client';

import { createManualContract } from '@/lib/actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

'use client';

import { createManualContract } from '@/lib/actions';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewContractPage() {
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [coords, setCoords] = useState<{ lat: string, lng: string }>({ lat: '', lng: '' });
    const [distance, setDistance] = useState<string>('');
    const [amcDate, setAmcDate] = useState<string>('');
    const [dayOfYear, setDayOfYear] = useState<string>('');
    const router = useRouter();

    // Office Coordinates (Configurable)
    const OFFICE = { lat: 25.800000, lng: 55.950000 };

    function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; // km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(3);
    }

    function toRad(val: number) {
        return val * Math.PI / 180;
    }

    const handleGps = () => {
        setGpsLoading(true);
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            setGpsLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);
                setCoords({ lat, lng });
                setDistance(calculateDistance(OFFICE.lat, OFFICE.lng, parseFloat(lat), parseFloat(lng)));
                setGpsLoading(false);
            },
            (error) => {
                alert("GPS Error: " + error.message);
                setGpsLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleAmcDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateStr = e.target.value;
        setAmcDate(dateStr);
        if (dateStr) {
            const date = new Date(dateStr);
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date.getTime() - start.getTime();
            const oneDay = 1000 * 60 * 60 * 24;
            const day = Math.floor(diff / oneDay);
            setDayOfYear(day.toString());
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        // Append calculated fields if missing from input
        if (!formData.get('distance')) formData.append('distance', distance);

        try {
            await createManualContract(formData);
            router.push('/manager/contracts');
        } catch (err: any) {
            alert("Error: " + err.message);
            setLoading(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 font-mono">AMC Entry Form v1.1</h1>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">

                {/* Section 1: Identity */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">1. Identity & Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Location Name *</label>
                            <input name="locationName" type="text" required placeholder="Display Name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">License No *</label>
                            <input name="licenseNumber" type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">GRA No *</label>
                            <input name="graNumber" type="text" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Customer Name (Optional)</label>
                            <input name="customerName" type="text" placeholder="Auto-generated if empty" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Contact No *</label>
                            <input name="phone" type="tel" required placeholder="050..." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                    </div>
                </div>

                {/* Section 2: GPS & Distance */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">2. GPS Coordinates</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Latitude *</label>
                            <input name="latitude" type="number" step="any" required value={coords.lat} onChange={e => setCoords({ ...coords, lat: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Longitude *</label>
                            <input name="longitude" type="number" step="any" required value={coords.lng} onChange={e => setCoords({ ...coords, lng: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm border p-2" />
                        </div>
                        <div className="col-span-2 flex justify-between items-center">
                            <button type="button" onClick={handleGps} disabled={gpsLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                                {gpsLoading ? 'Locating...' : '📍 Use GPS'}
                            </button>
                            <div className="text-right">
                                <label className="block text-xs font-medium text-gray-500 uppercase">Distance from Office</label>
                                <div className="text-lg font-bold text-gray-900">{distance ? `${distance} km` : '-'}</div>
                                <input type="hidden" name="distance" value={distance} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 3: Lifecycle */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">3. Contract Lifecycle</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">AMC Date (Start) *</label>
                            <input name="amcDate" type="date" required value={amcDate} onChange={handleAmcDateChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Renewal Date (End) *</label>
                            <input name="renewalDate" type="date" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Day of Year *</label>
                            <input name="day" type="number" required min="1" max="366" value={dayOfYear} readOnly className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm border p-2 cursor-not-allowed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Renewed *</label>
                            <input name="renewedDate" type="date" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Status *</label>
                            <select name="status" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2">
                                <option value="active">Active</option>
                                <option value="due_soon">Due Soon</option>
                                <option value="overdue">Overdue</option>
                                <option value="expired">Expired</option>
                                <option value="renewed">Renewed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Value (AED)</label>
                            <input name="amount" type="number" step="0.01" placeholder="0.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                        {loading ? 'Saving Entry...' : '✅ Save Entry'}
                    </button>
                </div>
            </form>
        </div>
    );
}
