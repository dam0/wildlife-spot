import { useState, useEffect } from 'react'
import './SightingForm.css'

interface ClientConnection {
  identity: string
  call: (reducer: string, args: unknown[]) => Promise<void>
  query: (sql: string) => Promise<unknown[]>
}

interface SightingFormProps {
  client: ClientConnection | null
  identity: string | null
}

const WHALE_SPECIES = [
  { id: 1, name: 'Blue Whale' },
  { id: 2, name: 'Humpback Whale' },
  { id: 3, name: 'Gray Whale' },
  { id: 4, name: 'Sperm Whale' },
  { id: 5, name: 'Killer Whale' },
  { id: 6, name: 'Minke Whale' },
]

export default function SightingForm({ client, identity }: SightingFormProps) {
  const [speciesId, setSpeciesId] = useState('1')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString())
          setLongitude(position.coords.longitude.toString())
        },
        (err) => {
          setError(`Geolocation error: ${err.message}`)
        }
      )
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!client || !identity) {
        setError('Not authenticated')
        return
      }

      if (!latitude || !longitude) {
        setError('Location is required')
        return
      }

      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)

      if (isNaN(lat) || isNaN(lng)) {
        setError('Invalid coordinates')
        return
      }

       await client.call('report_sighting', [
         parseInt(speciesId),
         lat,
         lng,
         description || 'No description',
       ])

      setSuccess('Sighting reported successfully!')
      setDescription('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report sighting')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sighting-form-container">
      <h3>Report a Sighting</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="species">Whale Species</label>
          <select
            id="species"
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            disabled={loading}
          >
            {WHALE_SPECIES.map((species) => (
              <option key={species.id} value={species.id}>
                {species.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any additional details about the sighting..."
            disabled={loading}
            rows={4}
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Submitting...' : 'Report Sighting'}
        </button>
      </form>
    </div>
  )
}
