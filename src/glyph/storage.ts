// Task §2.3 — per-user, local-only glyph library persistence (design D8, NFR-3).
//
// IndexedDB only. No network, ever — the glyph library is personal handwriting
// and never leaves the device by default. One record per glyph (keyed
// `userId::symbol`) so single-sample re-capture (§3.4) is a get→replace→put on
// one record, and a `userId` index gives a whole-library load.

import type { Glyph } from './types'

const DB_NAME = 'mathcanvas'
const DB_VERSION = 1
const STORE = 'glyphs'
const DEFAULT_USER = 'local'

interface GlyphRecord {
  /** `${userId}::${symbol}` */
  key: string
  userId: string
  symbol: string
  glyph: Glyph
}

function recordKey(userId: string, symbol: string): string {
  return `${userId}::${symbol}`
}

/** Wrap an IDBRequest as a promise. */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openLibraryDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('userId', 'userId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** Insert or replace one glyph. */
export async function putGlyph(
  glyph: Glyph,
  userId: string = DEFAULT_USER,
): Promise<void> {
  const db = await openLibraryDB()
  const record: GlyphRecord = {
    key: recordKey(userId, glyph.symbol),
    userId,
    symbol: glyph.symbol,
    glyph,
  }
  const store = tx(db, 'readwrite')
  await reqToPromise(store.put(record))
}

/** Fetch one glyph, or undefined if not captured. */
export async function getGlyph(
  symbol: string,
  userId: string = DEFAULT_USER,
): Promise<Glyph | undefined> {
  const db = await openLibraryDB()
  const store = tx(db, 'readonly')
  const rec = await reqToPromise<GlyphRecord | undefined>(
    store.get(recordKey(userId, symbol)),
  )
  return rec?.glyph
}

/** Load the whole library for a user as a symbol→Glyph map. */
export async function getLibrary(
  userId: string = DEFAULT_USER,
): Promise<Record<string, Glyph>> {
  const db = await openLibraryDB()
  const index = tx(db, 'readonly').index('userId')
  const recs = await reqToPromise<GlyphRecord[]>(index.getAll(userId))
  const out: Record<string, Glyph> = {}
  for (const r of recs) out[r.symbol] = r.glyph
  return out
}

/** Remove one glyph (e.g. to reset a capture). */
export async function deleteGlyph(
  symbol: string,
  userId: string = DEFAULT_USER,
): Promise<void> {
  const db = await openLibraryDB()
  const store = tx(db, 'readwrite')
  await reqToPromise(store.delete(recordKey(userId, symbol)))
}

/** Test/debug helper: wipe the whole store. */
export async function clearLibrary(): Promise<void> {
  const db = await openLibraryDB()
  const store = tx(db, 'readwrite')
  await reqToPromise(store.clear())
}

/** Reset the cached connection (tests reopen a fresh DB). */
export function _resetConnectionForTests(): void {
  dbPromise = null
}
