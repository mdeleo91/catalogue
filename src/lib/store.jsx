import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { uid } from './id'
import { locationPath, isDescendant } from './locations'
import { buildSeedState } from './seed'

const STORAGE_KEY = 'catalog-state-v1'

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

    case 'IMPORT_STATE':
      return { ...payload }

    case 'RESET_DEMO':
      return buildSeedState()

    default:
      return state
  }
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Could not load saved collection, starting fresh', e)
  }
  return buildSeedState()
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadInitial)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('Could not persist collection (storage quota?)', e)
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export function useCurrentUser() {
  const { state } = useStore()
  return state.users.find((u) => u.id === state.currentUserId) || state.users[0]
}
