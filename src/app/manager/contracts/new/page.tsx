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
    const [fineRate, setFineRate] = useState(200); // Default 200 fine per month

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
        renewedDate: '', // Previous Expiry Date
        lastCheckedDate: '',
        nextDueDate: '',
        status: '',
        distance: '',
        govtFees: '',
        amcValue: '',
        fineAmount: '0.00',
        amount: '',
        paidAmount: '0.00',
        balanceAmount: ''
    });

    const [daysFromExpiry, setDaysFromExpiry] = useState<number | null>(null);

    // Auto-calculate Renewal Date and Next Due Date whenever AMC Date or Duration changes
    useEffect(() => {
        if (form.amcDate) {
            const start = new Date(form.amcDate);
            if (!isNaN(start.getTime())) {
                // Renewal Date
                if (duration) {
                    const end = new Date(start);
                    end.setMonth(start.getMonth() + duration);
                    end.setDate(end.getDate() - 1);
                    const renewalStr = end.toISOString().split('T')[0];
                    setForm(prev => ({ ...prev, renewalDate: renewalStr }));
                }

                // Next Due Date (Default +90 days) - Only if not already set or assume auto-calc
                // Note: We'll overwrite it for now if it's empty.
                const due = new Date(start);
                due.setDate(due.getDate() + 90);
                const dueStr = due.toISOString().split('T')[0];
                
                // Last Checked = AMC Date (Default)
                
                setForm(prev => ({ 
                    ...prev, 
                    nextDueDate: prev.nextDueDate ? prev.nextDueDate : dueStr,
                    lastCheckedDate: prev.lastCheckedDate ? prev.lastCheckedDate : form.amcDate
                }));
            }
        }
    }, [form.amcDate, duration]);

    // Auto-calculate Fine when AMC Date or Renewed Date changes
    useEffect(() => {
        if (form.amcDate && form.renewedDate) {
            const start = new Date(form.amcDate);
            const prev = new Date(form.renewedDate);
            
            if (!isNaN(start.getTime()) && !isNaN(prev.getTime())) {
                const diffTime = start.getTime() - prev.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                setDaysFromExpiry(diffDays);

                let fine = 0;
                if (diffDays > 30) {
                    // Logic: Grace period 30 days. After that, charge for every month late?
                    // "after 30 days everymonth 160/200 each month"
                    // Assuming if days <= 30, fine 0.
                    // If days 31-60? 1 month fine? 
                    // Let's use: months = ceil((days - 30) / 30)
                    const lateDays = diffDays - 30;
                    const monthsLate = Math.ceil(lateDays / 30);
                    fine = monthsLate * fineRate;
                }
                
                // Update fine and totals
                setForm(prev => {
                    const newFine = fine.toFixed(2);
                    const g = parseFloat(prev.govtFees) || 0;
                    const a = parseFloat(prev.amcValue) || 0;
                    const total = g + a + fine;
                    const paid = parseFloat(prev.paidAmount) || 0;
                    
                    return {
                        ...prev,
                        fineAmount: newFine,
                        amount: total.toFixed(2),
                        balanceAmount: (total - paid).toFixed(2)
                    };
                });
            }
        } else {
            setDaysFromExpiry(null);
            setForm(prev => ({ ...prev, fineAmount: '0.00' }));
        }
    }, [form.amcDate, form.renewedDate, fineRate]); // Depend on fineRate too

    const handleFineRateToggle = () => {
        setFineRate(prev => (prev === 200 ? 160 : 200));
    };

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
        if (name !== 'customerName') {
            setForm((prev) => {
                const updated = { ...prev, [name]: value };

                // Auto-calc Total Amount
                if (['govtFees', 'amcValue', 'fineAmount', 'paidAmount'].includes(name)) {
                    const g = parseFloat(name === 'govtFees' ? value : prev.govtFees) || 0;
                    const a = parseFloat(name === 'amcValue' ? value : prev.amcValue) || 0;
                    const f = parseFloat(name === 'fineAmount' ? value : prev.fineAmount) || 0;
                    
                    const total = g + a + f;
                    updated.amount = total.toFixed(2);
                    
                    const paid = parseFloat(name === 'paidAmount' ? value : prev.paidAmount) || 0;
                    updated.balanceAmount = (total - paid).toFixed(2);
                }
                
                return updated;
            });
        }
    }

    function handleGPS() {
        if (!navigator.geolocation) {
            alert('GPS not supported on this browser');
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

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
            console.error(err);
            let msg = "GPS Error: " + err.message;
            if (err.code === 1) msg = "Location Access Denied. Please enable Location Services.";
            else if (err.code === 2) msg = "Location Unavailable.";
            else if (err.code === 3) msg = "Location request timed out.";
            alert(msg);
        }, options);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => {
            formData.append(key, value);
        });
        
        // Pass fineRate and others if needed by backend, though backend just takes fineAmount
        formData.append('fineRate', fineRate.toString());

        try {
            await createManualContract(formData);
            router.push('/manager/contracts');
        } catch (err: any) {
            alert("Error: " + err.message);
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 font-mono text-center">AMC Entry Form v1.2</h1>
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
                            🗺️ Map
                        </button>
                    </div>
                    {/* Map Component would go here if uncommented in original */}
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
                            <label className="text-xs text-gray-500 block mb-1">Expired Date (Previous)</label>
                             <input name="renewedDate" type="date" value={form.renewedDate} onChange={handleChange} className="input w-full border rounded px-3 py-2" placeholder="Previous Expiry" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2">
                         <div>
                            <label className="text-xs text-gray-500 block mb-1 font-semibold text-blue-600">Last AMC Checked Date</label>
                             <input name="lastCheckedDate" type="date" value={form.lastCheckedDate} onChange={handleChange} className="input w-full border rounded px-3 py-2 bg-blue-50" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1 font-semibold text-blue-600">Next AMC Due Date</label>
                             <input name="nextDueDate" type="date" value={form.nextDueDate} onChange={handleChange} className="input w-full border rounded px-3 py-2 bg-blue-50" />
                        </div>
                    </div>
                    
                    <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                         <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-yellow-700 font-semibold">Fine Calculation</label>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Rate:</span>
                                <button type="button" onClick={handleFineRateToggle} className="text-[10px] px-2 py-0.5 bg-white border rounded shadow-sm">
                                    {fineRate}/month
                                </button>
                             </div>
                         </div>
                         <div className="flex gap-2">
                             <div className="flex-1">
                                 <label className="text-[10px] text-gray-500 block">Days from Expiry</label>
                                 <input value={daysFromExpiry !== null ? daysFromExpiry : ''} readOnly className="input w-full border rounded px-2 py-1 bg-gray-100" placeholder="-" />
                             </div>
                             <div className="flex-1">
                                 <label className="text-[10px] text-gray-500 block">Fine Amount</label>
                                 <input name="fineAmount" type="number" step="0.01" value={form.fineAmount} onChange={handleChange} className="input w-full border rounded px-2 py-1 bg-white font-medium text-red-600" />
                             </div>
                         </div>
                         <p className="text-[10px] text-gray-400 mt-1">
                             {daysFromExpiry !== null && daysFromExpiry <= 30 ? "Within 30 days grace period (No Fine)" : daysFromExpiry !== null ? `Late by ${Math.ceil((daysFromExpiry - 30) / 30)} months` : "Enter AMC Date & Previous Expiry"}
                         </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-200 space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Contract Value Breakdown</label>
                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-500 block">Govt</label>
                                <input name="govtFees" type="number" step="0.01" value={form.govtFees} onChange={handleChange} placeholder="0.00" className="input w-full border rounded px-2 py-1" />
                            </div>
                           
                            <div>
                                <label className="text-[10px] text-gray-500 block">AMC</label>
                                <input name="amcValue" type="number" step="0.01" value={form.amcValue} onChange={handleChange} placeholder="0.00" className="input w-full border rounded px-2 py-1" />
                            </div>
                             <div>
                                <label className="text-[10px] text-gray-500 block text-red-500">Fine</label>
                                <input name="fineAmount" type="number" step="0.01" value={form.fineAmount} readOnly className="input w-full border rounded px-2 py-1 bg-gray-50 text-red-500" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block font-bold">Total</label>
                                <input name="amount" type="number" step="0.01" value={form.amount} readOnly className="input w-full border rounded px-2 py-1 bg-gray-100 font-bold text-gray-700" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2">
                            <div>
                                <label className="text-[10px] text-gray-500 block">Paid Amount</label>
                                <input name="paidAmount" type="number" step="0.01" value={form.paidAmount} onChange={handleChange} className="input w-full border rounded px-2 py-1 bg-green-50 text-green-700 font-medium" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block">Balance</label>
                                <input name="balanceAmount" type="number" step="0.01" value={form.balanceAmount} readOnly className="input w-full border rounded px-2 py-1 bg-gray-100 font-bold text-gray-900" />
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
