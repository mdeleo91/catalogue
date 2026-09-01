import { createClient } from '@supabase/supabase-js'

// Cloud mode is enabled by setting these env vars (in Vercel or .env.local):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Without them the app runs in on-device demo mode.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const isCloud = Boolean(supabase)
