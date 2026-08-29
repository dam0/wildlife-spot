/**
 * Water/land detection via OSM Nominatim reverse geocoding.
 *
 * Reverse-geocodes a lat/lng pair and inspects the returned address object.
 * If Nominatim returns no `address` (open ocean) or the `address` contains
 * water-type keys, the location is classified as water.
 *
 * Rate limit: Nominatim allows 1 req/sec. Calls are debounced via a simple
 * queue so rapid map clicks/drag-ends don't exceed the limit.
 *
 * Fallback: if the API is unreachable or errors, we resolve `true` (assume
 * water) so we never block the user from placing a pin due to a network issue.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

/** Address keys that indicate the location is a water body. */
const WATER_ADDRESS_KEYS = [
  'water',
  'bay',
  'ocean',
  'sea',
  'strait',
  'channel',
  'gulf',
  'cove',
  'harbour',
  'harbor',
  ' inlet',
  'fjord',
  'sound',
  'lagoon',
  'lake',
  'river',
  'estuary',
  'cape',
  'beach',
  'coast',
] as const

/** Minimal subset of the Nominatim reverse-geocode response. */
interface NominatimResponse {
  address?: Record<string, string> | null
  error?: string
}

/** Simple rate-limiter: ensures at least 1s between Nominatim requests. */
let lastRequestTime = 0
const MIN_INTERVAL_MS = 1100

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const wait = Math.max(0, lastRequestTime + MIN_INTERVAL_MS - now)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestTime = Date.now()
  return fetch(url)
}

/**
 * Returns `true` if the given coordinates are on water (ocean, sea, bay, etc.).
 *
 * Strategy:
 * 1. Reverse-geocode via Nominatim.
 * 2. No `address` object → open ocean → water.
 * 3. `address` contains a water-type key → water.
 * 4. Otherwise → land.
 *
 * On any error, resolves `true` (don't block UX on network failures).
 */
export async function isWater(lat: number, lng: number): Promise<boolean> {
  try {
    const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`

    const res = await rateLimitedFetch(url)
    if (!res.ok) return true

    const data: NominatimResponse = await res.json()

    // No address means open ocean — Nominatim has no land data for this point.
    if (!data.address || Object.keys(data.address).length === 0) {
      return true
    }

    // Check for water-type address keys.
    const addressStr = JSON.stringify(data.address).toLowerCase()
    return WATER_ADDRESS_KEYS.some((key) => addressStr.includes(key))
  } catch {
    // Network failure or parse error — don't block the user.
    return true
  }
}
