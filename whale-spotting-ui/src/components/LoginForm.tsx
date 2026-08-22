import { useState } from 'react'
import './LoginForm.css'

interface LoginFormProps {
  /** App owns the connection; the form just collects the desired username. */
  onSubmit: (username: string) => void
  loading: boolean
  error: string
}

export default function LoginForm({ onSubmit, loading, error }: LoginFormProps) {
  const [username, setUsername] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = username.trim()
    if (!trimmed) return
    onSubmit(trimmed)
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

          <button type="submit" disabled={loading || !username.trim()}>
            {loading ? 'Connecting...' : 'Login & Start Spotting'}
          </button>
        </form>
      </div>
    </div>
  )
}
