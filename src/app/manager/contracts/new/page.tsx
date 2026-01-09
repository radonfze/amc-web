'use client';

import { createManualContract } from '@/lib/actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewContractPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
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
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Contract</h1>
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">

                {/* Section 1: Customer */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">1. Customer Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                            <input name="phone" type="tel" required placeholder="0501234567" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                            <p className="text-xs text-gray-500 mt-1">We'll check if this customer exists first.</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Customer Name *</label>
                            <input name="customerName" type="text" required placeholder="Company or Person Name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">GRA Number</label>
                            <input name="graNumber" type="text" placeholder="e.g. 12948" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">License Number</label>
                            <input name="licenseNumber" type="text" placeholder="e.g. 102938" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                            <p className="text-xs text-gray-500 mt-1">GRA or License must be unique.</p>
                        </div>
                    </div>
                </div>

                {/* Section 2: Location */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">2. Location</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Location Name *</label>
                            <input name="locationName" type="text" required placeholder="e.g. Head Office, Warehouse 1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Area *</label>
                            <input name="area" type="text" required placeholder="e.g. Al Quoz, Downtown" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full Address (Optional)</label>
                            <textarea name="address" rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" placeholder="Building, Street, Unit..."></textarea>
                        </div>
                    </div>
                </div>

                {/* Section 3: Contract */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">3. Contract Terms</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                            <input name="startDate" type="date" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">End Date *</label>
                            <input name="endDate" type="date" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Total Contract Value (AED) *</label>
                            <input name="amount" type="number" step="0.01" required placeholder="0.00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2" />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                        {loading ? 'Creating...' : 'Create Contract'}
                    </button>
                </div>
            </form>
        </div>
    );
}
