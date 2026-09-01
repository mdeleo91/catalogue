import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

// Auth + collection membership for cloud mode. Provides:
//   { loading, session, membership, collection, members, refreshMembership,
//     signIn, signUp, signOut, createCollection, joinCollection }
// In local/demo mode (no Supabase env) the provider is never mounted and
// useMaybeAuth() returns null.

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [membership, setMembership] = useState(undefined)
  const [collection, setCollection] = useState(null)
  const [members, setMembers] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refreshMembership = useCallback(async () => {
    const uid = (await supabase.auth.getSession()).data.session?.user?.id
    if (!uid) {
      setMembership(null)
      setCollection(null)
      setMembers([])
      return
    }
    const { data: mine, error } = await supabase
      .from('collection_members')
      .select('collection_id, role, display_name')
      .eq('user_id', uid)
      .limit(1)
    if (error) {
      console.error('membership lookup failed', error)
      setMembership(null)
      return
    }
    if (!mine || mine.length === 0) {
      setMembership(null)
      setCollection(null)
      setMembers([])
      return
    }
    const m = mine[0]
    setMembership(m)
    const [{ data: coll }, { data: all }] = await Promise.all([
      supabase.from('collections').select('id, name, invite_code').eq('id', m.collection_id).single(),
      supabase.from('collection_members').select('user_id, display_name').eq('collection_id', m.collection_id),
    ])
    setCollection(coll || null)
    setMembers((all || []).map((row) => ({ id: row.user_id, name: row.display_name })))
  }, [])

  useEffect(() => {
    if (session === undefined) return
    refreshMembership()
  }, [session, refreshMembership])

  const value = useMemo(
    () => ({
      loading: session === undefined || (session && membership === undefined),
      session: session || null,
      membership: membership || null,
      collection,
      members,
      refreshMembership,

      signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password) => supabase.auth.signUp({ email, password }),
      signOut: () => supabase.auth.signOut(),

      createCollection: async (name, displayName) => {
        const { error } = await supabase.rpc('create_collection', {
          p_name: name,
          p_display_name: displayName,
        })
        if (error) throw new Error(error.message)
        await refreshMembership()
      },
      joinCollection: async (code, displayName) => {
        const { error } = await supabase.rpc('join_collection', {
          p_code: code,
          p_display_name: displayName,
        })
        if (error) throw new Error(error.message)
        await refreshMembership()
      },
    }),
    [session, membership, collection, members, refreshMembership],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider (cloud mode)')
  return ctx
}

// Safe in both modes: null when running in local/demo mode.
export function useMaybeAuth() {
  return useContext(AuthContext)
}
