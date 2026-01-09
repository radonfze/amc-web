export type Coordinates = {
    lat: number
    lng: number
}

/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export function haversineDistance(coords1: Coordinates, coords2: Coordinates): number {
    const R = 6371000 // Earth radius in meters
    const dLat = toRad(coords2.lat - coords1.lat)
    const dLon = toRad(coords2.lng - coords1.lng)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coords1.lat)) *
        Math.cos(toRad(coords2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

function toRad(degrees: number): number {
    return (degrees * Math.PI) / 180
}

export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`
    }
    return `${(meters / 1000).toFixed(1)} km`
}

export const MAX_ALLOWED_DISTANCE_METERS = 20
