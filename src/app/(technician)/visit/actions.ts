'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { haversineDistance, MAX_ALLOWED_DISTANCE_METERS } from '@/lib/gps'

export async function submitVisit(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const contractId = formData.get('contractId') as string
    const visitType = formData.get('visitType') as string // 'normal' | 'shop_closed'
    const remarks = formData.get('remarks') as string
    const gpsLat = parseFloat(formData.get('gpsLat') as string)
    const gpsLng = parseFloat(formData.get('gpsLng') as string)
    const paymentCollected = formData.get('paymentCollected') === 'on'
    const paymentAmountContract = parseFloat(formData.get('paymentAmount') as string || '0')

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Unauthorized' }
    }

    // 2. BACKEND GPS CHECK
    // Fetch contract -> customer_location coordinates
    const { data: contract } = await supabase
        .from('amc_contracts')
        .select(`
      id, 
      customer_locations (
        lat,
        lng
      )
    `)
        .eq('id', contractId)
        .single()

    if (!contract || !contract.customer_locations) {
        return { error: 'Contract or location not found' }
    }

    // @ts-ignore
    const siteLat = contract.customer_locations.lat
    // @ts-ignore
    const siteLng = contract.customer_locations.lng

    const distance = haversineDistance(
        { lat: gpsLat, lng: gpsLng },
        { lat: siteLat, lng: siteLng }
    )

    if (distance > MAX_ALLOWED_DISTANCE_METERS) {
        return {
            error: `GPS validation failed. You are ${Math.round(distance)}m away. Max allowed is ${MAX_ALLOWED_DISTANCE_METERS}m.`
        }
    }

    // 3. Insert Visit
    const { error: insertError } = await supabase
        .from('amc_visits')
        .insert({
            amc_contract_id: contractId,
            technician_id: user.id,
            visit_type: visitType,
            gps_lat: gpsLat,
            gps_lng: gpsLng,
            distance_from_site_m: distance,
            remarks: remarks,
            payment_collected: paymentCollected,
            payment_amount: paymentCollected ? paymentAmountContract : 0,
        })

    if (insertError) {
        return { error: insertError.message }
    }

    // 4. Update Contract Logic (Simplified for now, can be moved to DB trigger)
    // If payment collected, update status
    const updates: any = {}
    if (paymentCollected) {
        updates.payment_status = 'collected_onsite'
    }

    // Update Last Effective Visit Date logic would go here or via trigger
    // For MVP let's assume 'normal' visit resets the clock immediately
    // Ideally this should typically be done via a Postgres Function to be atomic and correct

    if (Object.keys(updates).length > 0) {
        await supabase.from('amc_contracts').update(updates).eq('id', contractId)
    }

    revalidatePath('/technician')
    redirect('/technician')
}
