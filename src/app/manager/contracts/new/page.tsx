'use client';

import { createManualContract } from '@/lib/actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const OFFICE_LAT = 25.800000;
const OFFICE_LNG = 55.950000;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NewContractPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        licenseNumber: '', // mapped from license_no
        graNumber: '',     // mapped from gra_no
        locationName: '',  // mapped from location_name
        phone: '',         // mapped from contact_no
        customerName: '',  // extra optional field
        latitude: '',
        longitude: '',
        amcDate: '',       // mapped from amc_date
        renewalDate: '',   // mapped from renewal_date
        day: '',
        renewedDate: '',   // mapped from renewed
        status: '',
        distance: '',      // mapped from distance_km
        amount: ''         // extra field for contract value
    });

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setForm((prev) => {
            const updated = { ...prev, [name]: value };

            // Auto-calc Day if AMC Date changes
            if (name === 'amcDate' && value) {
                const date = new Date(value);
                const start = new Date(date.getFullYear(), 0, 0);
                const diff = date.getTime() - start.getTime();
                const oneDay = 1000 * 60 * 60 * 24;
                const day = Math.floor(diff / oneDay);
                updated.day = day.toString();
            }
            return updated;
        });
    }

    function handleGPS() {
        if (!navigator.geolocation) {
            alert('GPS not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude.toFixed(6);
            const lng = pos.coords.longitude.toFixed(6);
            const dist = haversine(Number(lat), Number(lng), OFFICE_LAT, OFFICE_LNG).toFixed(3);
            setForm((prev) => ({
                ...prev,
                latitude: lat,
                longitude: lng,
                distance: dist,
            }));
        }, (err) => {
            alert("GPS Error: " + err.message);
        });
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        // Map form state to FormData expected by Server Action
        Object.entries(form).forEach(([key, value]) => {
            formData.append(key, value);
        });

        try {
            await createManualContract(formData);
            router.push('/manager/contracts');
        } catch (err: any) {
            alert("Error: " + err.message);
            setLoading(false);
        }
    }

    return (
        <div className="max-w-md mx-auto py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 font-mono text-center">AMC Entry Form v1.1</h1>
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md text-sm border border-gray-200">

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Identity</h3>
                    <input name="licenseNumber" value={form.licenseNumber} onChange={handleChange} placeholder="License No *" required className="input w-full border rounded px-3 py-2" />
                    <input name="graNumber" value={form.graNumber} onChange={handleChange} placeholder="GRA No *" required className="input w-full border rounded px-3 py-2" />
                    <input name="locationName" value={form.locationName} onChange={handleChange} placeholder="Location Name *" required className="input w-full border rounded px-3 py-2" />
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="Contact No (050...) *" required className="input w-full border rounded px-3 py-2" />
                    <input name="customerName" value={form.customerName} onChange={handleChange} placeholder="Customer Name (Optional)" className="input w-full border rounded px-3 py-2" />
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Location (GPS)</h3>
                    <div className="flex gap-2">
                        <input name="latitude" value={form.latitude} onChange={handleChange} placeholder="Latitude *" required className="input flex-1 border rounded px-3 py-2 bg-gray-50" />
                        <input name="longitude" value={form.longitude} onChange={handleChange} placeholder="Longitude *" required className="input flex-1 border rounded px-3 py-2 bg-gray-50" />
                        <button type="button" onClick={handleGPS} className="px-3 py-2 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 whitespace-nowrap">
                            📍 Use GPS
                        </button>
                    </div>
                    <input name="distance" value={form.distance} onChange={handleChange} placeholder="Distance (km) *" required className="input w-full border rounded px-3 py-2 bg-gray-50" readOnly />
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Lifecycle</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">AMC Date (Start)</label>
                            <input name="amcDate" type="date" value={form.amcDate} onChange={handleChange} required className="input w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Renewal Date</label>
                            <input name="renewalDate" type="date" value={form.renewalDate} onChange={handleChange} required className="input w-full border rounded px-3 py-2" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Day (1-366)</label>
                            <input name="day" type="number" min="1" max="366" value={form.day} onChange={handleChange} required className="input w-full border rounded px-3 py-2 bg-gray-50" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Last Renewed</label>
                            <input name="renewedDate" type="date" value={form.renewedDate} onChange={handleChange} required className="input w-full border rounded px-3 py-2" />
                        </div>
                    </div>

                    <select name="status" value={form.status} onChange={handleChange} required className="input w-full border rounded px-3 py-2 bg-white">
                        <option value="">Select Status *</option>
                        <option value="active">Active</option>
                        <option value="due_soon">Due Soon</option>
                        <option value="overdue">Overdue</option>
                        <option value="expired">Expired</option>
                        <option value="renewed">Renewed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>

                    <input name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} placeholder="Contract Value (AED)" className="input w-full border rounded px-3 py-2" />
                </div>

                <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50">
                    {loading ? 'Saving Entry...' : '✅ Save Entry'}
                </button>
            </form>
        </div>
    );
}
