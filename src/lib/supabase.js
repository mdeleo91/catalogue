import { createClient } from '@supabase/supabase-js'

// Cloud mode is enabled by setting these env vars (in Vercel or .env.local):
//   VITE_SUPABASE_URL  — https://<project-ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY — the browser-safe key ("sb_publishable_…",
//   or a legacy "anon" JWT; both work). VITE_SUPABASE_ANON_KEY is accepted as
//   an alias since older Supabase projects label it that way.
// Without them the app runs in on-device demo mode.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null

export const isCloud = Boolean(supabase)
