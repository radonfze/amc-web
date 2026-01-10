'use client';

import { createManualContract, searchCustomers } from '@/lib/actions';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
    ssr: false,
    loading: () => <p>Loading Map...</p>
});

// Hardcoded Office Location (Al Twar/Qusais area approx)
// Update these coordinates to your actual office location to get 0.000 when testing at desk.
// Hardcoded Office Location (Updated to User's location for 0 distance test)
const OFFICE_LAT = 25.799156;
const OFFICE_LNG = 55.970612;

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
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showMap, setShowMap] = useState(false);

    const [duration, setDuration] = useState(12); // Default 1 Year (12 months)

    const [form, setForm] = useState({
        licenseNumber: '',
        graNumber: '',
        locationName: '',
        phone: '',
        customerName: '',
        latitude: '',
        longitude: '',
        amcDate: '',
        renewalDate: '',
        day: '',
        renewedDate: '',
        status: '',
        distance: '',
        govtFees: '',
        amcValue: '',
        amount: ''
    });

    // Auto-calculate Renewal Date whenever AMC Date or Duration changes
    useEffect(() => {
        if (form.amcDate && duration) {
            const start = new Date(form.amcDate);
            // Handle date safety
            if (!isNaN(start.getTime())) {
                const end = new Date(start);
                end.setMonth(start.getMonth() + duration);
                // Subtract 1 day for standard contract logic (e.g. Jan 1 to Dec 31)
                end.setDate(end.getDate() - 1);

                const renewalStr = end.toISOString().split('T')[0];
                setForm(prev => ({ ...prev, renewalDate: renewalStr }));
            }
        }
    }, [form.amcDate, duration]);

    // Search Logic
    const handleNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setForm(prev => ({ ...prev, customerName: val }));

        if (val.length > 2) {
            try {
                const results = await searchCustomers(val);
                setSuggestions(results);
            } catch (err) {
                console.error("Search failed", err);
            }
        } else {
            setSuggestions([]);
        }
    };

    const selectCustomer = (cust: any) => {
        setForm(prev => ({
            ...prev,
            customerName: cust.name,
            graNumber: cust.gra_number || '',
            licenseNumber: cust.license_number || '',
            phone: cust.phone || '',
        }));
        setSuggestions([]);
    };

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        // Customer Name handled by search input specifically
        if (name !== 'customerName') {
            setForm((prev) => {
                const updated = { ...prev, [name]: value };

                // Auto-calc Total Amount
                if (name === 'govtFees' || name === 'amcValue') {
                    const g = parseFloat(name === 'govtFees' ? value : prev.govtFees) || 0;
                    const a = parseFloat(name === 'amcValue' ? value : prev.amcValue) || 0;
                    updated.amount = (g + a).toFixed(2);
                }

                // Auto-calc Day
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
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md text-sm border border-gray-200" onClick={() => setSuggestions([])}>

                <div className="space-y-3 relative">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Identity</h3>

                    {/* Searchable Name */}
                    <div className="relative">
                        <input
                            name="customerName"
                            value={form.customerName}
                            onChange={handleNameChange}
                            placeholder="Customer Name (Search) *"
                            autoComplete="off"
                            required
                            className="input w-full border rounded px-3 py-2 bg-blue-50 focus:bg-white transition-colors border-blue-200"
                        />
                        {suggestions.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                                {suggestions.map((cust: any) => (
                                    <div key={cust.id} onClick={(e) => { e.stopPropagation(); selectCustomer(cust); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-xs border-b last:border-0 border-gray-100">
                                        <span className="font-bold text-gray-800">{cust.name}</span>
                                        <span className="text-gray-500">{cust.phone}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <input name="licenseNumber" value={form.licenseNumber} onChange={handleChange} placeholder="License No *" required className="input w-full border rounded px-3 py-2" />
                    <input name="graNumber" value={form.graNumber} onChange={handleChange} placeholder="GRA No *" required className="input w-full border rounded px-3 py-2" />
                    <input name="locationName" value={form.locationName} onChange={handleChange} placeholder="Location Name *" required className="input w-full border rounded px-3 py-2" />
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="Contact No (050...) *" required className="input w-full border rounded px-3 py-2" />
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Location (GPS)</h3>
                    <div className="flex gap-2">
                        <input name="latitude" value={form.latitude} onChange={handleChange} placeholder="Latitude *" required className="input flex-1 border rounded px-3 py-2 bg-gray-50" />
                        <input name="longitude" value={form.longitude} onChange={handleChange} placeholder="Longitude *" required className="input flex-1 border rounded px-3 py-2 bg-gray-50" />
                        <button type="button" onClick={handleGPS} className="px-3 py-2 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 whitespace-nowrap">
                            📍 Use GPS
                        </button>
                        <button type="button" onClick={() => setShowMap(true)} className="px-3 py-2 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 whitespace-nowrap">
                            🗺️ Pick on Map
                        </button>
                    </div>
                    {showMap && LocationPicker && (
                        <LocationPicker
                            initialLat={parseFloat(form.latitude) || OFFICE_LAT}
                            initialLng={parseFloat(form.longitude) || OFFICE_LNG}
                            onCancel={() => setShowMap(false)}
                            onSelect={(lat, lng) => {
                                const dist = haversine(lat, lng, OFFICE_LAT, OFFICE_LNG).toFixed(3);
                                setForm(prev => ({
                                    ...prev,
                                    latitude: lat.toFixed(6),
                                    longitude: lng.toFixed(6),
                                    distance: dist
                                }));
                                setShowMap(false);
                            }}
                        />
                    )}
                    <div className="flex justify-between items-center bg-gray-50 border rounded px-3 py-2">
                        <span className="text-gray-500">Distance from Office</span>
                        <input name="distance" value={form.distance} onChange={handleChange} placeholder="0.000" required className="bg-transparent text-right w-20 outline-none font-mono font-bold text-gray-900" readOnly />
                        <span className="ml-1 text-gray-500">km</span>
                    </div>
                    <p className="text-[10px] text-gray-400 text-right">Straight-line distance from 25.80, 55.95</p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b pb-1">Lifecycle</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">AMC Date (Start)</label>
                            <input name="amcDate" type="date" value={form.amcDate} onChange={handleChange} required className="input w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Duration</label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="input w-full border rounded px-3 py-2 bg-white"
                            >
                                <option value={3}>3 Months</option>
                                <option value={6}>6 Months</option>
                                <option value={12}>1 Year</option>
                                <option value={24}>2 Years</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Renewal Date</label>
                            <input name="renewalDate" type="date" value={form.renewalDate} onChange={handleChange} required className="input w-full border rounded px-3 py-2 bg-gray-50" readOnly />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Day (1-366)</label>
                            <input name="day" type="number" min="1" max="366" value={form.day} onChange={handleChange} required className="input w-full border rounded px-3 py-2 bg-gray-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Expired Date (Previous)</label>
                            <input name="renewedDate" type="date" value={form.renewedDate} onChange={handleChange} className="input w-full border rounded px-3 py-2" />
                        </div>
                        <div>
                            {/* Placeholder to keep grid alignment or empty */}
                        </div>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Contract Value Breakdown</label>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-500 block">Govt Charge</label>
                                <input name="govtFees" type="number" step="0.01" value={form.govtFees} onChange={handleChange} placeholder="0.00" className="input w-full border rounded px-2 py-1" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block">Our AMC</label>
                                <input name="amcValue" type="number" step="0.01" value={form.amcValue} onChange={handleChange} placeholder="0.00" className="input w-full border rounded px-2 py-1" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block">Total</label>
                                <input name="amount" type="number" step="0.01" value={form.amount} readOnly className="input w-full border rounded px-2 py-1 bg-gray-100 font-bold text-gray-700" />
                            </div>
                        </div>
                    </div>

                    <select name="status" value={form.status} onChange={handleChange} required className="input w-full border rounded px-3 py-2 bg-white mt-2">
                        <option value="">Select Status *</option>
                        <option value="active">Active</option>
                        <option value="due_soon">Due Soon</option>
                        <option value="overdue">Overdue</option>
                        <option value="expired">Expired</option>
                        <option value="renewed">Renewed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50">
                    {loading ? 'Saving Entry...' : '✅ Save Entry'}
                </button>
            </form>
        </div>
    );
}
