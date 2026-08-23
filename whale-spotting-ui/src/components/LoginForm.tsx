import { useState } from 'react'
import './LoginForm.css'

interface LoginFormProps {
  /** App owns the connection; the form just collects the desired username. */
  onSubmit: (username: string) => void
  loading: boolean
  error: string
  /** Username remembered on this device (cookie) — enables one-click return. */
  deviceUser?: string
}

export default function LoginForm({ onSubmit, loading, error, deviceUser }: LoginFormProps) {
  const [username, setUsername] = useState(deviceUser ?? '')
  const [returning, setReturning] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = username.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  // Returning device: pre-fill + prominent one-click "continue as" button.
  const isReturning = !!deviceUser && username.trim() === deviceUser

  if (isReturning && !returning) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>Welcome back</h2>
          <p style={{ color: '#666' }}>
            This device was last used as <strong>{deviceUser}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              setReturning(true)
              onSubmit(deviceUser)
            }}
            disabled={loading}
            style={{ width: '100%', marginBottom: '0.75rem' }}
          >
            {loading ? 'Connecting...' : `Continue as ${deviceUser}`}
          </button>
          <button
            type="button"
            onClick={() => setReturning(true)}
            disabled={loading}
            style={{ width: '100%', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Use a different username
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Welcome to Whale Spotting</h2>
        {deviceUser && (
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 0 }}>
            This device was last used as <strong>{deviceUser}</strong> — you can enter that name to
            continue on this device.
          </p>
        )}
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
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !username.trim()}>
            {loading ? 'Connecting...' : 'Login & Start Spotting'}
          </button>
        </form>
      </div>
    </div>
  )
}
