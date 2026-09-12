import { authenticate, cors } from './_lib.js'
import { fetchProduct, marketCredential, rankCandidates, searchProducts } from './_pricecharting.js'

// Match an item to a PriceCharting product, or re-read one by id.
//
//   { upc }                       exact barcode lookup
//   { title, platform, region }   ranked candidates, best first
//   { id }                        current prices for a known product
//
// Auth and membership are required as for every AI route: the token is a
// paid key and the quota is the collection's.

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  const { id, upc, title, platform, region } = req.body || {}
  if (!id && !upc && !title) {
    return res.status(400).json({ error: 'Send an id, a upc, or a title.' })
  }

  const auth = await authenticate(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const token = marketCredential()
  if (!token) {
    return res.status(503).json({ error: 'Market prices are not configured for this deployment.', code: 'not_configured' })
  }

  try {
    if (id) {
      const product = await fetchProduct({ id: String(id) }, token)
      return res.status(200).json({ product, fetchedAt: new Date().toISOString() })
    }

    // The barcode is the one exact key; when the photos gave us one, try it
    // before any fuzzy title search.
    if (upc) {
      const product = await fetchProduct({ upc: String(upc).replace(/\D/g, '') }, token).catch(() => null)
      if (product) return res.status(200).json({ product, candidates: [product], matchedBy: 'upc', fetchedAt: new Date().toISOString() })
      if (!title) return res.status(200).json({ product: null, candidates: [], matchedBy: 'upc' })
    }

    const q = [title, platform].filter(Boolean).join(' ')
    const candidates = rankCandidates(await searchProducts(q, token), { title, platform, region })
    const best = candidates[0] && candidates[0].score >= 10 ? candidates[0] : null
    return res.status(200).json({
      product: best,
      candidates: candidates.slice(0, 6),
      matchedBy: best ? 'title' : null,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('market lookup failed', error)
    if (error.status === 401 || error.status === 403) {
      return res.status(502).json({ error: "PriceCharting rejected this deployment's token." })
    }
    return res.status(502).json({ error: 'Market lookup failed. Try again shortly.' })
  }
}
