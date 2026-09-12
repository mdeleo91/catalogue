import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
} from 'react'
import { uid } from './id'
import { locationPath, isDescendant } from './locations'
import { buildSeedState } from './seed'
import { supabase } from './supabase'

const STORAGE_KEY = 'catalog-state-v1'
const SETTINGS_KEY = 'catalog-settings-v1'

const StoreContext = createContext(null)

function now() {
  return new Date().toISOString()
}

function activity(state, action, subject, refs = {}) {
  return {
    id: uid('act'),
    userId: state.currentUserId,
    action,
    subject,
    at: now(),
    ...refs,
  }
}

function historyEntry(state, subjectType, subjectId, locationId, tempStatus) {
  return {
    id: uid('hist'),
    subjectType,
    subjectId,
    locationId: locationId || null,
    tempStatus: tempStatus || null,
    path: locationId ? locationPath(state.locations, locationId) : tempStatus || 'Unknown',
    at: now(),
    by: state.currentUserId,
  }
}

function reducer(state, { type, payload }) {
  switch (type) {
    case 'SET_USER':
      if (state.cloud) return state // in cloud mode identity comes from the signed-in account
      return { ...state, currentUserId: payload }

    case 'ADD_ITEM': {
      const item = {
        ...payload,
        id: payload.id || uid('item'),
        createdAt: now(),
        createdBy: state.currentUserId,
        updatedAt: now(),
      }
      const hist = historyEntry(state, 'item', item.id, item.locationId, item.tempStatus)
      return {
        ...state,
        items: [item, ...state.items],
        locationHistory: [hist, ...state.locationHistory],
        activityLog: [activity(state, 'added', item.title, { itemId: item.id }), ...state.activityLog],
      }
    }

    case 'UPDATE_ITEM': {
      const { id, patch, note } = payload
      const prev = state.items.find((i) => i.id === id)
      if (!prev) return state
      const nextItem = { ...prev, ...patch, updatedAt: now() }
      const moved =
        patch.locationId !== undefined &&
        (patch.locationId !== prev.locationId || patch.tempStatus !== prev.tempStatus)
      return {
        ...state,
        items: state.items.map((i) => (i.id === id ? nextItem : i)),
        locationHistory: moved
          ? [historyEntry(state, 'item', id, nextItem.locationId, nextItem.tempStatus), ...state.locationHistory]
          : state.locationHistory,
        activityLog: [
          activity(state, moved ? 'moved' : 'updated', `${prev.title}${note ? ` — ${note}` : ''}`, { itemId: id }),
          ...state.activityLog,
        ],
      }
    }

    // A price refresh is not an edit anyone made: it patches items without
    // touching the activity log, so the history stays about people.
    case 'REFRESH_MARKET': {
      const patches = payload || {}
      if (!Object.keys(patches).length) return state
      return {
        ...state,
        items: state.items.map((i) => (patches[i.id] ? { ...i, ...patches[i.id], updatedAt: now() } : i)),
      }
    }

    case 'DELETE_ITEM': {
      const prev = state.items.find((i) => i.id === payload)
      if (!prev) return state
      return {
        ...state,
        items: state.items.filter((i) => i.id !== payload),
        activityLog: [activity(state, 'removed', prev.title), ...state.activityLog],
      }
    }

    case 'ADD_LOCATION': {
      const loc = { ...payload, id: payload.id || uid('loc'), createdAt: now() }
      return {
        ...state,
        locations: [...state.locations, loc],
        activityLog: [activity(state, 'created location', loc.name, { locationId: loc.id }), ...state.activityLog],
      }
    }

    case 'UPDATE_LOCATION': {
      const { id, patch } = payload
      return {
        ...state,
        locations: state.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }
    }

    // Move a location node (usually a container) to a new parent. Everything
    // inside moves with it automatically because items reference the node.
    case 'MOVE_LOCATION': {
      const { id, newParentId } = payload
      const node = state.locations.find((l) => l.id === id)
      if (!node || id === newParentId) return state
      if (newParentId && isDescendant(state.locations, newParentId, id)) return state
      const locations = state.locations.map((l) =>
        l.id === id ? { ...l, parentId: newParentId || null } : l,
      )
      const interim = { ...state, locations }
      return {
        ...interim,
        locationHistory: [historyEntry(interim, 'location', id, id, null), ...state.locationHistory],
        activityLog: [activity(state, 'moved', node.name, { locationId: id }), ...state.activityLog],
      }
    }

    case 'DELETE_LOCATION': {
      const hasChildren = state.locations.some((l) => l.parentId === payload)
      const hasItems = state.items.some((i) => i.locationId === payload)
      if (hasChildren || hasItems) return state
      return { ...state, locations: state.locations.filter((l) => l.id !== payload) }
    }

    case 'ADD_WISH': {
      const wish = { ...payload, id: uid('wish'), createdAt: now() }
      return {
        ...state,
        wishlist: [wish, ...state.wishlist],
        activityLog: [activity(state, 'wishlisted', wish.title), ...state.activityLog],
      }
    }

    case 'UPDATE_WISH':
      return {
        ...state,
        wishlist: state.wishlist.map((w) => (w.id === payload.id ? { ...w, ...payload.patch } : w)),
      }

    case 'DELETE_WISH':
      return { ...state, wishlist: state.wishlist.filter((w) => w.id !== payload) }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...payload } }

    case 'IMPORT_STATE': {
      if (state.cloud) {
        // In cloud mode an import replaces collection content but never
        // identity — users and the current account come from Supabase.
        return {
          ...state,
          items: payload.items || [],
          locations: payload.locations || [],
          locationHistory: payload.locationHistory || [],
          activityLog: payload.activityLog || [],
          wishlist: payload.wishlist || [],
        }
      }
      return { ...payload }
    }

    case 'RESET_DEMO':
      if (state.cloud) return state
      return buildSeedState()

    case 'REPLACE_STATE': // cloud refetch
      return payload

    default:
      return state
  }
}

function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Could not load settings', e)
  }
  return {}
}

// ---------------------------------------------------------------------------
// Local (demo) mode: whole state persisted to this browser.
// ---------------------------------------------------------------------------

function loadInitialLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Could not load saved collection, starting fresh', e)
  }
  return buildSeedState()
}

function LocalStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadInitialLocal)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Could not persist collection (storage quota?)', e)
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch, syncError: null }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// ---------------------------------------------------------------------------
// Cloud mode: state lives in Supabase, scoped to the shared collection.
// Writes are diffed against the previous state and upserted/deleted row by
// row; realtime events from other devices trigger a refetch.
// ---------------------------------------------------------------------------

const CLOUD_TABLES = {
  items: 'items',
  locations: 'locations',
  locationHistory: 'location_history',
  activityLog: 'activity',
  wishlist: 'wishlist',
}

const byDesc = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''))

function CloudStoreProvider({ cloud, children }) {
  const { collectionId, userId } = cloud
  const [state, setState] = useState(null)
  const stateRef = useRef(null)
  const pendingWrites = useRef(0)
  const refetchTimer = useRef(null)
  const [syncError, setSyncError] = useState(null)

  const fetchState = useCallback(async () => {
    try {
      const keys = Object.keys(CLOUD_TABLES)
      const [membersRes, ...contentRes] = await Promise.all([
        supabase.from('collection_members').select('user_id, display_name').eq('collection_id', collectionId),
        ...keys.map((k) =>
          supabase.from(CLOUD_TABLES[k]).select('id, data').eq('collection_id', collectionId),
        ),
      ])
      const failed = [membersRes, ...contentRes].find((r) => r.error)
      if (failed) throw failed.error

      const content = {}
      keys.forEach((k, i) => {
        content[k] = (contentRes[i].data || []).map((row) => row.data)
      })
      content.items.sort(byDesc('createdAt'))
      content.locationHistory.sort(byDesc('at'))
      content.activityLog.sort(byDesc('at'))
      content.wishlist.sort(byDesc('createdAt'))

      const next = {
        version: 1,
        cloud: true,
        users: (membersRes.data || []).map((m) => ({ id: m.user_id, name: m.display_name })),
        currentUserId: userId,
        ...content,
        settings: stateRef.current?.settings || loadLocalSettings(),
      }
      stateRef.current = next
      setState(next)
      setSyncError(null)
    } catch (e) {
      console.error('Could not load collection from Supabase', e)
      setSyncError('Could not load the collection — check your connection and pull to refresh.')
      if (!stateRef.current) {
        // Leave a usable (empty) state so the app renders rather than hanging.
        const empty = {
          version: 1,
          cloud: true,
          users: cloud.members || [],
          currentUserId: userId,
          items: [], locations: [], locationHistory: [], activityLog: [], wishlist: [],
          settings: loadLocalSettings(),
        }
        stateRef.current = empty
        setState(empty)
      }
    }
  }, [collectionId, userId, cloud.members])

  const persistDiff = useCallback(
    async (prev, next) => {
      pendingWrites.current += 1
      try {
        for (const [key, table] of Object.entries(CLOUD_TABLES)) {
          if (prev[key] === next[key]) continue
          const prevMap = new Map(prev[key].map((r) => [r.id, r]))
          const nextIds = new Set(next[key].map((r) => r.id))
          const upserts = next[key]
            .filter((r) => prevMap.get(r.id) !== r)
            .map((r) => ({
              id: r.id,
              collection_id: collectionId,
              data: r,
              updated_at: new Date().toISOString(),
            }))
          const deletes = prev[key].filter((r) => !nextIds.has(r.id)).map((r) => r.id)
          if (upserts.length) {
            const { error } = await supabase.from(table).upsert(upserts)
            if (error) throw error
          }
          if (deletes.length) {
            const { error } = await supabase
              .from(table)
              .delete()
              .in('id', deletes)
              .eq('collection_id', collectionId)
            if (error) throw error
          }
        }
        setSyncError(null)
      } catch (e) {
        console.error('Cloud save failed', e)
        setSyncError('Could not save to the cloud — your last change may not be synced. Check your connection.')
      } finally {
        pendingWrites.current -= 1
      }
    },
    [collectionId],
  )

  const dispatch = useCallback(
    (action) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reducer(prev, action)
      if (next === prev) return
      stateRef.current = next
      setState(next)
      if (action.type === 'SET_SETTINGS') {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next.settings))
        } catch (e) {
          console.warn('Could not persist settings', e)
        }
        return
      }
      persistDiff(prev, next)
    },
    [persistDiff],
  )

  useEffect(() => {
    fetchState()

    const scheduleRefetch = () => {
      clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(() => {
        if (pendingWrites.current === 0) fetchState()
      }, 1200)
    }

    const channel = supabase.channel(`catalog-${collectionId}`)
    for (const table of [...Object.values(CLOUD_TABLES), 'collection_members']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `collection_id=eq.${collectionId}` },
        scheduleRefetch,
      )
    }
    channel.subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(refetchTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [collectionId, fetchState])

  const value = useMemo(() => ({ state, dispatch, syncError }), [state, dispatch, syncError])

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-3">
        Loading your collection…
      </div>
    )
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// ---------------------------------------------------------------------------

export function StoreProvider({ cloud, children }) {
  if (cloud) return <CloudStoreProvider cloud={cloud}>{children}</CloudStoreProvider>
  return <LocalStoreProvider>{children}</LocalStoreProvider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export function useCurrentUser() {
  const { state } = useStore()
  return (
    state.users.find((u) => u.id === state.currentUserId) ||
    state.users[0] || { id: state.currentUserId, name: 'Collector' }
  )
}
