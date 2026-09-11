import { DAILY_SCAN_LIMIT, authenticate, cors, readUsage, sharedCredential } from './_lib.js'

// Tells the Settings screen whether scanning is on and how much of today's
// quota the caller has used. Never returns the key itself.
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' })

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const cred = sharedCredential()
  return res.status(200).json({
    enabled: Boolean(cred),
    model: cred?.model || null,
    usedToday: cred ? await readUsage(auth.supabase) : null,
    dailyLimit: cred ? DAILY_SCAN_LIMIT : null,
  })
}
