import { useState, useEffect, useRef } from 'react'

type LandCheckInstance = {
  isLand(lon: number, lat: number): boolean
  check(lon: number, lat: number): {
    land: boolean
    kind: 'land' | 'sea' | 'coast'
    confidence: number
    landFraction: number
    cell: string
    refined: boolean
  }
  level: number
  stats: { runs: number }
}

type UseLandCheckResult = {
  landCheck: LandCheckInstance | null
  isLoading: boolean
  error: string | null
  isSea: (lat: number, lng: number) => boolean
}

export function useLandCheck(): UseLandCheckResult {
  const [landCheck, setLandCheck] = useState<LandCheckInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lcRef = useRef<LandCheckInstance | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { LandCheck } = await import('../lib/landcheck.js')
        const datasetUrl = new URL('/data/landsea_L10.tfls', window.location.origin).href
        const lc = await LandCheck.fromUrl(datasetUrl) as LandCheckInstance
        if (!cancelled) {
          lcRef.current = lc
          setLandCheck(lc)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load landcheck dataset')
          setIsLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const isSea = (lat: number, lng: number): boolean => {
    const lc = lcRef.current
    if (!lc) return true // default to sea if not loaded
    return !lc.isLand(lng, lat) // isLand takes (lon, lat)
  }

  return { landCheck, isLoading, error, isSea }
}
