// Real SpacetimeDB WebSocket client — replaces the old HTTP+SQL workaround.
// Built on generated bindings in ./module_bindings (SpacetimeDB 2.8).
import { DbConnection } from './module_bindings'
import type { Sighting, Species, User } from './module_bindings/types'

export type { DbConnection } from './module_bindings'
export type { Sighting, Species, User } from './module_bindings/types'

const HOST = import.meta.env.VITE_SPACETIME_HOST ?? 'https://maincloud.spacetimedb.com'
const DATABASE = import.meta.env.VITE_SPACETIME_DATABASE ?? 'whale-spotting'
const TOKEN_KEY = 'whalespot.token'
const DEVICE_USER_COOKIE = 'whalespot.device_user'
const TOKEN_COOKIE = 'whalespot.token'

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

function eraseCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; path=/`
}

/** Remember which username this device last used (1-year cookie). */
export function setDeviceUser(username: string): void {
  writeCookie(DEVICE_USER_COOKIE, username)
}

export function getDeviceUser(): string | undefined {
  return readCookie(DEVICE_USER_COOKIE)
}

export function clearDeviceUser(): void {
  eraseCookie(DEVICE_USER_COOKIE)
}

/**
 * Token persists in localStorage AND a device cookie: if one store is cleared
 * (e.g. site data wipe) the other restores the same identity on this device.
 */
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  writeCookie(TOKEN_COOKIE, token)
}

export function getStoredToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? readCookie(TOKEN_COOKIE)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  eraseCookie(TOKEN_COOKIE)
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
  /** Live species catalogue snapshot (id-ordered). */
  species: () => SpeciesView[]
}

/** Client-side view of a catalogue row. */
export type SpeciesView = Species

export interface ConnectHandlers {
  onConnectError: (message: string) => void
  onDisconnected: (message?: string) => void
  onSightings: (rows: SightingView[]) => void
  onUsers: (rows: UserView[]) => void
  onSpecies: (rows: SpeciesView[]) => void
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
    const species = new Map<number, SpeciesView>()

    const emitSightings = () => handlers.onSightings([...sightings.values()])
    const emitUsers = () => handlers.onUsers([...users.values()])
    const emitSpecies = () => handlers.onSpecies([...species.values()].sort((a, b) => a.id - b.id))

    const builder = DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DATABASE)

    const token = getStoredToken()
    if (token) builder.withToken(token)

    builder
      .onConnect((conn, identity, returnedToken) => {
        // Persist the credential so refreshes/reconnects keep the same identity.
        localStorage.setItem(TOKEN_KEY, returnedToken)
        writeCookie(TOKEN_COOKIE, returnedToken)

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

        conn.db.species.onInsert((_, row) => {
          species.set(row.id, row)
          emitSpecies()
        })
        conn.db.species.onUpdate((_, _old, newRow) => {
          species.set(newRow.id, newRow)
          emitSpecies()
        })
        conn.db.species.onDelete((_, row) => {
          species.delete(row.id)
          emitSpecies()
        })

        conn.subscriptionBuilder()
          .onApplied(() => {
            settled = true
            resolve({
              connection: conn,
              identity: identityHex(identity),
              username,
              users: () => [...users.values()],
              species: () =>
                [...species.values()].sort((a, b) => a.id - b.id),
              disconnect: () => {
                disconnectedIntentionally = true
                conn.disconnect()
              },
            })
          })
          .onError((ctx) => {
            const message = 'message' in ctx ? String(ctx.message) : 'Subscription failed'
            if (!settled) reject(new Error(message))
            else handlers.onDisconnected(message)
          })
          .subscribe(['SELECT * FROM sighting', 'SELECT * FROM user', 'SELECT * FROM species'])
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
