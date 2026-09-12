import { useEffect, useState } from 'react'
import { Button, Card, SectionTitle } from './ui'
import { currency } from '../lib/constants'
import { applyMarket, isStale } from '../lib/market'
import { marketStatus, matchMarket, readMarket } from '../lib/marketApi'
import { useStore } from '../lib/store'

// Settings: is the price guide connected, and what does the collection look
// like against it. The two bulk actions are what turn an existing collection
// into a live-priced one.
export default function MarketStatusCard() {
  const { state, dispatch } = useStore()
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    marketStatus().then(setStatus)
  }, [])

  const matched = state.items.filter((i) => i.market?.productId)
  const unmatched = state.items.filter((i) => !i.market?.productId && i.type !== 'magazine' && i.type !== 'guide')
  const stale = matched.filter((i) => isStale(i.market))

  const run = async (label, list, fn) => {
    setProgress({ label, done: 0, total: list.length, hits: 0 })
    const patches = {}
    let hits = 0
    for (const [n, item] of list.entries()) {
      try {
        const patch = await fn(item)
        if (patch) {
          patches[item.id] = patch
          hits += 1
        }
      } catch (err) {
        if (err.code === 'not_configured' || err.code === 'signed_out') break
      }
      setProgress({ label, done: n + 1, total: list.length, hits })
      await new Promise((r) => setTimeout(r, 250))
    }
    if (Object.keys(patches).length) dispatch({ type: 'REFRESH_MARKET', payload: patches })
    setProgress((p) => ({ ...p, finished: true }))
  }

  const refreshAll = () =>
    run('Refreshing', matched, async (item) => {
      const { product } = await readMarket(item.market.productId)
      return product ? applyMarket(item, product) : null
    })

  const matchAll = () =>
    run('Matching', unmatched, async (item) => {
      const found = await matchMarket({ upc: item.upc, title: item.title, platform: item.platform, region: item.region })
      return found.product ? applyMarket(item, found.product, found.fetchedAt) : null
    })

  return (
    <>
      <SectionTitle>Market prices</SectionTitle>
      <Card className="space-y-3">
        {!status ? (
          <p className="text-sm text-ink-3">Checking the price guide…</p>
        ) : !status.enabled ? (
          <p className="text-sm text-ink-2">
            Not connected. Add a PriceCharting API token as <code className="text-xs">PRICECHARTING_TOKEN</code> to
            turn on live prices; until then, scans fall back to a web search for value.
          </p>
        ) : (
          <>
            <div className="text-sm">
              <span className={`font-semibold ${status.ok ? 'text-good' : 'text-bad'}`}>
                {status.ok ? 'Connected' : 'Connected, but the lookup failed'}
              </span>
              <span className="text-ink-3"> · {status.provider}</span>
            </div>
            {status.ok && status.sample && (
              <p className="text-xs text-ink-3">
                Test lookup: {status.sample.name} ({status.sample.console}) — loose{' '}
                {currency(status.sample.prices.loose)}, CIB {currency(status.sample.prices.cib)}.
              </p>
            )}
            {!status.ok && status.error && <p className="text-xs text-bad">{status.error}</p>}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Stat n={matched.length} label="matched" />
              <Stat n={unmatched.length} label="unmatched" />
              <Stat n={stale.length} label="stale" />
            </div>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" onClick={refreshAll} disabled={!!progress && !progress.finished || !matched.length}>
                Refresh all prices ({matched.length})
              </Button>
              <Button variant="secondary" className="w-full" onClick={matchAll} disabled={!!progress && !progress.finished || !unmatched.length}>
                Match unmatched items ({unmatched.length})
              </Button>
            </div>
            {progress && (
              <p className="text-xs text-ink-3">
                {progress.label} {progress.done} of {progress.total}
                {progress.finished ? ` — done, ${progress.hits} updated.` : '…'}
              </p>
            )}
            <p className="text-[11px] text-ink-3">
              Prices refresh in the background when the app opens and a figure is more than a day old.
              Estimated values you set by hand are never overwritten.
            </p>
          </>
        )}
      </Card>
    </>
  )
}

function Stat({ n, label }) {
  return (
    <div className="rounded-lg bg-surface py-2">
      <div className="text-base font-bold tabular-nums">{n}</div>
      <div className="text-ink-3">{label}</div>
    </div>
  )
}
