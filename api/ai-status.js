import { DAILY_SCAN_LIMIT, authenticate, cors, readUsage, resolveCredential } from './_lib.js'

// Tells the Settings screen which credential a scan would actually run on,
// without ever returning the key itself.
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' })

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const cred = await resolveCredential(auth.supabase)
  const usedToday = cred.source === 'app' ? await readUsage(auth.supabase) : null
  return res.status(200).json({
    source: cred.source,          // 'user' | 'app' | null
    model: cred.model || null,
    // Only meaningful on the shared key; own-key scans are unlimited.
    usedToday,
    dailyLimit: cred.source === 'app' ? DAILY_SCAN_LIMIT : null,
  })
}
