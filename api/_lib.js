import { createClient } from '@supabase/supabase-js'

// Shared helpers for the /api functions. Vercel does not route files whose
// name starts with an underscore, so this is library code, not an endpoint.

export const MAX_IMAGES = 6
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024

export const DEFAULT_MODEL = 'claude-opus-5'

// Auth is by bearer token and no cookies are involved, so a permissive origin
// is safe here: a token, not the browser's origin check, is what gates access.
export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

// The shared fallback key the deployment owner may or may not provide.
export function appKey(env = process.env) {
  return env.ANTHROPIC_API_KEY || null
}

// Verifies the caller and that they belong to a collection. Returns either
// { supabase, user } or { status, error } for the caller to return verbatim.
export async function authenticate(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '').trim()
  if (!token) return { status: 401, error: 'Sign in to use AI identification.' }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  )

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return { status: 401, error: 'Your session has expired — sign in again.' }
  }

  // Row-level security scopes this to the caller, so a stranger who merely
  // signed up gets nothing back and is refused.
  const { data: memberships, error: memberError } = await supabase
    .from('collection_members')
    .select('collection_id')
    .limit(1)
  if (memberError) return { status: 500, error: 'Could not verify your collection membership.' }
  if (!memberships?.length) {
    return { status: 403, error: 'Only members of a collection can use AI identification.' }
  }

  return { supabase, user: userData.user }
}

// Which credential this caller's scan should run on. The caller's own key
// wins, so each member is billed for their own scanning; the deployment-wide
// key is only a fallback for whoever chooses to provide one.
//
// RLS means this query can only ever return the caller's own row — the
// endpoint cannot reach another member's key even by accident.
export async function resolveCredential(supabase) {
  const { data, error } = await supabase
    .from('user_ai_keys')
    .select('provider, api_key, model')
    .limit(1)
    .maybeSingle()

  if (!error && data?.api_key) {
    return { source: 'user', apiKey: data.api_key, model: data.model || DEFAULT_MODEL }
  }

  const shared = appKey()
  if (!shared) return { source: null }
  return {
    source: 'app',
    apiKey: shared,
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  }
}

// Daily ceiling on scans that run on the SHARED key. Members using their own
// key pay their own way and are not limited.
export const DAILY_SCAN_LIMIT = Number(process.env.AI_DAILY_SCAN_LIMIT || 100)

// Counts this scan and returns { count, limited }. Fails open on a database
// error: a broken counter should not take scanning down, and the provider's
// own monthly spend cap is the hard backstop.
export async function consumeScan(supabase, limit = DAILY_SCAN_LIMIT) {
  const { data, error } = await supabase.rpc('record_ai_scan')
  if (error) {
    console.warn('scan quota unavailable, allowing request', error.message)
    return { count: null, limited: false }
  }
  return { count: data, limited: data > limit }
}

// Today's usage without counting anything, for the Settings screen.
export async function readUsage(supabase) {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('scans, day')
    .eq('day', new Date().toISOString().slice(0, 10))
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.scans ?? 0
}

export const NOT_CONFIGURED =
  'No AI key is set up. Add your own provider key under Settings → AI identification, and scanning will be billed to your account.'
