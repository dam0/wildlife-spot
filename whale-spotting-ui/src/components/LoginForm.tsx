import { useState } from 'react'
import './LoginForm.css'

interface ClientConnection {
  identity: string
  call: (reducer: string, args: unknown[]) => Promise<void>
  query: (sql: string) => Promise<unknown[]>
}

interface LoginFormProps {
  onLogin: (identity: string, username: string, client: ClientConnection) => void
}

async function connectToSpaceTimeDB(username: string): Promise<ClientConnection> {
  const baseUrl = 'https://maincloud.spacetimedb.com/v1/database/c2005e41717def13284e2f1db2b97d13de55786ef7e4050e9dec2bc8946d615b'

  console.log(`Attempting to connect to SpacetimeDB Cloud via HTTP at ${baseUrl}`)

  // Create HTTP-based client
  const client: ClientConnection = {
    identity: `user-${Date.now()}`,

    call: async (reducer: string, args: unknown[]) => {
      console.log('[HTTP] Calling reducer:', reducer, 'with args:', args)

      try {
        // Implement operations using SQL since HTTP API uses SQL directly
        if (reducer === 'register_user') {
          // User registration is handled automatically when inserting sightings
          console.log('[HTTP] User registration handled via sighting inserts')
         } else if (reducer === 'report_sighting') {
           const [speciesId, lat, lng, description, podSize] = args as [number, number, number, string, number]
           const timestamp = Math.floor(Date.now() / 1000)
           const sql = `INSERT INTO sighting (user_identity, species_id, latitude, longitude, description, pod_size, timestamp) VALUES ('${client.identity}', ${speciesId}, ${lat}, ${lng}, '${description.replace(/'/g, "''")}', ${podSize}, ${timestamp})`
           console.log('[HTTP] Insert SQL:', sql)
           await client.query(sql)
         } else if (reducer === 'update_sighting') {
           const [sightingId, speciesId, lat, lng, description, podSize] = args as [number, number, number, number, string, number]
           const timestamp = Math.floor(Date.now() / 1000) // Convert to seconds for U64
           const sql = `UPDATE sighting SET species_id = ${speciesId}, latitude = ${lat}, longitude = ${lng}, description = '${description.replace(/'/g, "''")}', pod_size = ${podSize}, timestamp = ${timestamp} WHERE id = ${sightingId}`
           await client.query(sql)
        } else if (reducer === 'delete_sighting') {
          const [sightingId] = args as [number]
          const sql = `DELETE FROM sighting WHERE id = ${sightingId}`
          await client.query(sql)
        }
      } catch (err) {
        console.error('[HTTP] Failed to execute operation:', err)
        throw err
      }
    },

    query: async (sql: string) => {
      console.log('[HTTP] Executing query:', sql)

      try {
        const response = await fetch(`${baseUrl}/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Accept': 'application/json',
          },
          mode: 'cors',
          body: sql,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
        }

        const result = await response.json()
        console.log('[HTTP] Query result:', result)

        // The API returns results directly as an array
        return Array.isArray(result) ? result : []
      } catch (err) {
        console.error('[HTTP] Failed to execute query:', err)
        throw err
      }
    },
  }

  try {
    // Skip user registration for now to test basic connectivity
    console.log(`[SpacetimeDB] Client created for ${username} (skipping registration)`)
    return client
  } catch (err) {
    console.error('[SpacetimeDB] Failed to create client:', err)
    throw err instanceof Error ? err : new Error('Failed to create client')
  }
}



export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!username.trim()) {
        setError('Please enter a username')
        setLoading(false)
        return
      }

      const client = await connectToSpaceTimeDB(username)
      onLogin(client.identity, username, client)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Welcome to Whale Spotting</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login & Start Spotting'}
          </button>
         </form>
       </div>
     </div>
   )
}
