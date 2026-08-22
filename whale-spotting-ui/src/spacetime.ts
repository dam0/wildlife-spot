// Real SpacetimeDB WebSocket client — replaces the old HTTP+SQL workaround.
// Built on generated bindings in ./module_bindings (SpacetimeDB 2.8).
import { DbConnection } from './module_bindings'
import type { Sighting, User } from './module_bindings/types'

export type { DbConnection } from './module_bindings'
export type { Sighting, User } from './module_bindings/types'

const HOST = import.meta.env.VITE_SPACETIME_HOST ?? 'https://maincloud.spacetimedb.com'
const DATABASE = import.meta.env.VITE_SPACETIME_DATABASE ?? 'whale-spotting'
const TOKEN_KEY = 'whalespot.token'

export function getStoredToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Client-side view of a sighting row (ids/identities flattened to primitives). */
export type SightingView = Omit<Sighting, 'id' | 'userIdentity'> & {
  id: number
  userIdentity: string
}

export type UserView = Omit<User, 'identity'> & { identity: string }

/** snake_case row shape that MapComponent renders (username joined in by App). */
export interface SightingRow {
  id: number
  latitude: number
  longitude: number
  species_id: number
  description: string
  timestamp: number
  username: string
  pod_size?: number
}

export interface SpacetimeSession {
  connection: DbConnection
  /** Hex string of this client's SpacetimeDB identity. */
  identity: string
  username: string
  disconnect: () => void
  /** Live snapshot of registered spotters, keyed by identity hex. */
  users: () => UserView[]
}

export interface ConnectHandlers {
  onConnectError: (message: string) => void
  onDisconnected: (message?: string) => void
  onSightings: (rows: SightingView[]) => void
  onUsers: (rows: UserView[]) => void
}

function identityHex(value: unknown): string {
  if (value && typeof value === 'object' && 'toHexString' in value) {
    return (value as { toHexString(): string }).toHexString()
  }
  return String(value)
}

function toView(row: Sighting): SightingView {
  return { ...row, id: Number(row.id), userIdentity: identityHex(row.userIdentity) }
}

/**
 * Opens a WebSocket connection to SpacetimeDB, restores the stored auth token
 * (so returning users keep their identity), registers live-table listeners and
 * subscribes to all sightings and users. Resolves once the first subscription
 * snapshot has been applied.
 */
export function connectToSpacetimeDB(
  username: string,
  handlers: ConnectHandlers,
): Promise<SpacetimeSession> {
  let settled = false
  let disconnectedIntentionally = false

  return new Promise<SpacetimeSession>((resolve, reject) => {
    const sightings = new Map<number, SightingView>()
    const users = new Map<string, UserView>()

    const emitSightings = () => handlers.onSightings([...sightings.values()])
    const emitUsers = () => handlers.onUsers([...users.values()])

    const builder = DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DATABASE)

    const token = getStoredToken()
    if (token) builder.withToken(token)

    builder
      .onConnect((conn, identity, returnedToken) => {
        // Persist the credential so refreshes/reconnects keep the same identity.
        localStorage.setItem(TOKEN_KEY, returnedToken)

        conn.db.sighting.onInsert((_, row) => {
          sightings.set(Number(row.id), toView(row))
          emitSightings()
        })
        conn.db.sighting.onUpdate((_, _old, newRow) => {
          sightings.set(Number(newRow.id), toView(newRow))
          emitSightings()
        })
        conn.db.sighting.onDelete((_, row) => {
          sightings.delete(Number(row.id))
          emitSightings()
        })

        conn.db.user.onInsert((_, row) => {
          users.set(identityHex(row.identity), { ...row, identity: identityHex(row.identity) })
          emitUsers()
        })
        conn.db.user.onDelete((_, row) => {
          users.delete(identityHex(row.identity))
          emitUsers()
        })

        conn.subscriptionBuilder()
          .onApplied(() => {
            settled = true
            resolve({
              connection: conn,
              identity: identityHex(identity),
              username,
              users: () => [...users.values()],
              disconnect: () => {
                disconnectedIntentionally = true
                clearStoredToken()
                conn.disconnect()
              },
            })
          })
          .onError((ctx) => {
            const message = 'message' in ctx ? String(ctx.message) : 'Subscription failed'
            if (!settled) reject(new Error(message))
            else handlers.onDisconnected(message)
          })
          .subscribe(['SELECT * FROM sighting', 'SELECT * FROM user'])
      })
      .onConnectError(() => {
        const message = `Could not reach SpacetimeDB at ${HOST}. Check your connection and try again.`
        if (!settled) reject(new Error(message))
        else handlers.onConnectError(message)
      })
      .onDisconnect(() => {
        if (!disconnectedIntentionally) {
          handlers.onDisconnected('Connection lost. Your latest sightings will sync when you reload.')
        }
      })
      .build()
  })
}

/** Typed mutation surface for map components — backed by real reducers. */
export interface MapClient {
  reportSighting: (
    speciesId: number,
    lat: number,
    lng: number,
    description: string,
    podSize: number,
  ) => Promise<void>
  updateSighting: (
    sightingId: number,
    speciesId: number,
    lat: number,
    lng: number,
    description: string,
    podSize: number,
  ) => Promise<void>
  deleteSighting: (sightingId: number) => Promise<void>
}

export function makeMapClient(connection: DbConnection): MapClient {
  return {
    reportSighting: (...args) => reportSighting(connection, ...args),
    updateSighting: (...args) => updateSighting(connection, ...args),
    deleteSighting: (id) => deleteSighting(connection, id),
  }
}

/** Register (or rename) this spotter. Rejects with a friendly message server-side. */
export async function registerUser(connection: DbConnection, username: string): Promise<void> {
  await connection.reducers.registerUser({ username })
}

export async function reportSighting(
  connection: DbConnection,
  speciesId: number,
  latitude: number,
  longitude: number,
  description: string,
  podSize: number,
): Promise<void> {
  await connection.reducers.reportSighting({ speciesId, latitude, longitude, description, podSize })
}

export async function updateSighting(
  connection: DbConnection,
  sightingId: number,
  speciesId: number,
  latitude: number,
  longitude: number,
  description: string,
  podSize: number,
): Promise<void> {
  await connection.reducers.updateSighting({
    sightingId: BigInt(sightingId),
    speciesId,
    latitude,
    longitude,
    description,
    podSize,
  })
}

export async function deleteSighting(
  connection: DbConnection,
  sightingId: number,
): Promise<void> {
  await connection.reducers.deleteSighting({ sightingId: BigInt(sightingId) })
}
