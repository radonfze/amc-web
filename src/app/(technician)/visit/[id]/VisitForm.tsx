'use client'

import { useState, useActionState } from 'react'
import { submitVisit } from '../actions'
import { haversineDistance, MAX_ALLOWED_DISTANCE_METERS, formatDistance } from '@/lib/gps'

interface VisitFormProps {
    contractId: string
    siteLat: number
    siteLng: number
}

const initialState = {
    error: '',
}

export default function VisitForm({ contractId, siteLat, siteLng }: VisitFormProps) {
    const [gpsProcessing, setGpsProcessing] = useState(false)
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
    const [distance, setDistance] = useState<number | null>(null)
    const [clientError, setClientError] = useState<string | null>(null)

    const [visitType, setVisitType] = useState('normal')

    // @ts-ignore
    const [state, formAction, isPending] = useActionState(submitVisit, initialState)

    const handleGetLocation = () => {
        setGpsProcessing(true)
        setClientError(null)

        if (!navigator.geolocation) {
            setClientError('Geolocation is not supported by your browser')
            setGpsProcessing(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const currentCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                }
                setCoords(currentCoords)

                const dist = haversineDistance(currentCoords, { lat: siteLat, lng: siteLng })
                setDistance(dist)

                setGpsProcessing(false)
            },
            (geoError) => {
                setClientError('Error getting location: ' + geoError.message)
                setGpsProcessing(false)
            },
            { enableHighAccuracy: true, timeout: 15000 }
        )
    }

    return (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">

            {/* 1. GPS Check Section */}
            <div className="mb-6 border-b border-gray-100 pb-6">
                <h3 className="mb-2 font-semibold text-gray-900">Step 1: Verify Location</h3>
                <p className="text-sm text-gray-500 mb-4">You must be at the site to start.</p>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={gpsProcessing}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {gpsProcessing ? 'Locating...' : 'Get GPS Location'}
                    </button>

                    {distance !== null && (
                        <div className={`text-sm font-medium ${distance <= MAX_ALLOWED_DISTANCE_METERS ? 'text-green-600' : 'text-red-600'}`}>
                            Distance: {formatDistance(distance)}
                            {distance <= MAX_ALLOWED_DISTANCE_METERS ? ' (OK)' : ' (Too Far)'}
                        </div>
                    )}
                </div>

                {clientError && <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">{clientError}</p>}
            </div>

            {/* 2. Submission Form */}
            {/* Only show form if GPS is valid for better UX */}
            {coords && distance !== null && distance <= MAX_ALLOWED_DISTANCE_METERS && (
                <form action={formAction} className="space-y-4">
                    <input type="hidden" name="contractId" value={contractId} />
                    <input type="hidden" name="gpsLat" value={coords.lat} />
                    <input type="hidden" name="gpsLng" value={coords.lng} />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="visitType"
                                    value="normal"
                                    checked={visitType === 'normal'}
                                    onChange={() => setVisitType('normal')}
                                    className="text-blue-600"
                                />
                                Normal Visit
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="visitType"
                                    value="shop_closed"
                                    checked={visitType === 'shop_closed'}
                                    onChange={() => setVisitType('shop_closed')}
                                    className="text-red-600"
                                />
                                Shop Closed
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                        <textarea
                            name="remarks"
                            required
                            rows={3}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            placeholder="Enter visit details..."
                        />
                    </div>

                    {visitType === 'normal' && (
                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="paymentCollected" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="font-medium text-gray-900">Payment Collected?</span>
                            </label>
                            <p className="text-xs text-gray-500 ml-6 mt-1">Check this if you collected AED 1000 cash/check onsite.</p>
                            <input type="hidden" name="paymentAmount" value="1000" />
                        </div>
                    )}

                    {state?.error && (
                        <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                            {state.error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full rounded-md bg-green-600 px-4 py-3 text-white font-semibold shadow hover:bg-green-700 disabled:opacity-50"
                    >
                        {isPending ? 'Submitting...' : 'Submit Visit'}
                    </button>
                </form>
            )}
        </div>
    )
}
