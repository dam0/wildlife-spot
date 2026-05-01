import { useState, useEffect } from 'react'
import './App.css'
import MapComponent from './components/MapComponent'
import LoginForm from './components/LoginForm'

interface ClientConnection {
  identity: string
  call: (reducer: string, args: unknown[]) => Promise<void>
  query: (sql: string) => Promise<unknown[]>
}

function App() {
  const [identity, setIdentity] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('')
  const [client, setClient] = useState<ClientConnection | null>(null)

  useEffect(() => {
    const savedSession = sessionStorage.getItem('whaleSpottingSession')
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession)
        setIdentity(session.identity)
        setUsername(session.username)
        // Note: Client connection needs to be re-established on page reload
        // For now, we'll require users to log in again
      } catch (err) {
        console.error('Failed to restore session:', err)
      }
    }
  }, [])

  const handleLogin = (newIdentity: string, newUsername: string, conn: ClientConnection) => {
    console.log('[App] handleLogin called with client:', conn)
    setIdentity(newIdentity)
    setUsername(newUsername)
    setClient(conn)
    sessionStorage.setItem(
      'whaleSpottingSession',
      JSON.stringify({
        identity: newIdentity,
        username: newUsername,
      })
    )
  }

  const handleLogout = () => {
    setIdentity(null)
    setUsername('')
    setClient(null)
    sessionStorage.removeItem('whaleSpottingSession')
  }

  return (
    <div className="app">
      <header>
        <h1>🐋 Whale Spotting</h1>
        {identity && <p>Logged in as: {username}</p>}
      </header>

      {!identity ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        <div className="main-content">
          <MapComponent client={client} username={username} />
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default App
