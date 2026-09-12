import { authenticate, cors } from './_lib.js'
import { fetchProduct, marketCredential } from './_pricecharting.js'

// Is the price guide connected, and does a real lookup come back in the
// shape the app expects? Settings shows the answer, so a wrong token or a
// changed API is visible there rather than as silently empty prices.

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const token = marketCredential()
  if (!token) return res.status(200).json({ enabled: false, provider: 'PriceCharting' })

  try {
    const sample = await fetchProduct({ q: 'Super Metroid Super Nintendo' }, token)
    return res.status(200).json({
      enabled: true,
      provider: 'PriceCharting',
      ok: Boolean(sample?.prices?.cib || sample?.prices?.loose),
      sample,
    })
  } catch (error) {
    return res.status(200).json({ enabled: true, provider: 'PriceCharting', ok: false, error: error.message })
  }
}
