import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import MapComponent from './components/MapComponent'
import LoginForm from './components/LoginForm'
import {
  clearStoredToken,
  connectToSpacetimeDB,
  getStoredToken,
  makeMapClient,
  registerUser,
  type SpacetimeSession,
  type SightingView,
  type SightingRow,
  type UserView,
  type MapClient,
} from './spacetime'

const USERNAME_KEY = 'whalespot.username'

function App() {
  const [session, setSession] = useState<SpacetimeSession | null>(null)
  const [username, setUsername] = useState('')
  const [sightings, setSightings] = useState<SightingView[]>([])
  const [users, setUsers] = useState<UserView[]>([])
  const [banner, setBanner] = useState('')
  const [loginError, setLoginError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [restoring, setRestoring] = useState(true)

  const handleLoginSubmit = useCallback(
    async (name: string) => {
      setConnecting(true)
      setLoginError('')
      try {
        const s = await connectToSpacetimeDB(name, {
          onConnectError: (message) => {
            setBanner(message)
            setSession(null)
          },
          onDisconnected: (message) => {
            if (message) setBanner(message)
          },
          onSightings: (rows) => setSightings(rows),
          onUsers: (rows) => setUsers(rows),
        })

        // Deterministic ownership check: the subscription cache holds every
        // registered spotter, so "taken by someone else" is knowable without
        // parsing reducer error strings.
        const takenByOther = s.users().some(
          (u) => u.username === name && u.identity !== s.identity,
        )
        try {
          if (takenByOther) throw new Error('username already taken')
          await registerUser(s.connection, name)
        } catch (err) {
          s.disconnect()
          clearStoredToken()
          setLoginError(
            takenByOther || /already taken/i.test(String(err))
              ? 'That username is already taken — please pick another.'
              : 'Registration failed. Please try again.',
          )
          return
        }

        localStorage.setItem(USERNAME_KEY, name)
        setBanner('')
        setSession(s)
        setUsername(name)
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Login failed')
      } finally {
        setConnecting(false)
      }
    },
    [],
  )

  // Silent session restore: a stored token reconnects with the same identity.
  // register_user is an idempotent upsert for the same identity, so this also
  // re-asserts the saved username.
  // Guard: StrictMode double-invokes effects in dev — connect only once.
  const restoreStarted = useRef(false)
  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true
    const savedToken = getStoredToken()
    const savedName = localStorage.getItem(USERNAME_KEY)
    if (savedToken && savedName) {
      handleLoginSubmit(savedName).finally(() => setRestoring(false))
    } else {
      setRestoring(false)
    }
  }, [handleLoginSubmit])

  const handleLogout = () => {
    session?.disconnect()
    clearStoredToken()
    localStorage.removeItem(USERNAME_KEY)
    setSession(null)
    setUsername('')
    setSightings([])
    setUsers([])
    setBanner('')
  }

  const mapClient: MapClient | null = useMemo(
    () => (session ? makeMapClient(session.connection) : null),
    [session],
  )

  const rowsForMap: SightingRow[] = useMemo(
    () =>
      sightings.map((s) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        species_id: s.speciesId,
        description: s.description,
        // Reducer timestamps are unix seconds; UI renders with Date(ms).
        timestamp: Number(s.timestamp) * 1000,
        username: users.find((u) => u.identity === s.userIdentity)?.username ?? 'Unknown',
        pod_size: s.podSize,
      })),
    [sightings, users],
  )

  return (
    <div className="app">
      <header>
        <h1>🐋 Whale Spotting</h1>
        {session && <p>Logged in as: {username}</p>}
      </header>

      {banner && <div className="error-message" style={{ margin: '0 1rem' }}>{banner}</div>}

      {restoring ? (
        <p style={{ padding: '1rem' }}>Reconnecting…</p>
      ) : !session ? (
        <LoginForm onSubmit={handleLoginSubmit} loading={connecting} error={loginError} />
      ) : (
        mapClient && (
          <div className="main-content">
            <MapComponent
              client={mapClient}
              username={username}
              sightings={rowsForMap}
            />
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        )
      )}
    </div>
  )
}

export default App
