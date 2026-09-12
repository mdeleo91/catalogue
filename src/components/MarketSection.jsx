import { useState } from 'react'
import { Card, SectionTitle } from './ui'
import { currency, timeAgo } from '../lib/constants'
import { applyMarket, marketValueFor, priceChange } from '../lib/market'
import { matchMarket, readMarket } from '../lib/marketApi'
import { useStore } from '../lib/store'

// The live price of one piece in the collection: what the guide says today,
// how that has moved, and when it was last checked. Unmatched items can be
// matched from here; matched ones can be re-read on demand.
export default function MarketSection({ item }) {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [candidates, setCandidates] = useState(null)
  if (!state.cloud) return null

  const market = item.market
  const value = market ? marketValueFor(market, { condition: item.condition, completeness: item.completeness }) : null
  const change = priceChange(item)

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      const { product } = await readMarket(market.productId)
      if (product) dispatch({ type: 'REFRESH_MARKET', payload: { [item.id]: applyMarket(item, product) } })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const match = async () => {
    setBusy(true)
    setError(null)
    try {
      const found = await matchMarket({ upc: item.upc, title: item.title, platform: item.platform, region: item.region })
      if (found.product) {
        dispatch({ type: 'REFRESH_MARKET', payload: { [item.id]: applyMarket(item, found.product, found.fetchedAt) } })
        setCandidates(null)
      } else {
        setCandidates(found.candidates || [])
      }
    } catch (err) {
      setError(err.code === 'not_configured' ? 'Market prices are not set up for this deployment.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const choose = (product) => {
    dispatch({ type: 'REFRESH_MARKET', payload: { [item.id]: applyMarket(item, product) } })
    setCandidates(null)
  }

  return (
    <>
      <SectionTitle>Market value</SectionTitle>
      <Card className="space-y-2">
        {market ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular-nums">{value ? currency(value.amount) : '—'}</span>
              {change && (
                <span className={`text-sm font-semibold tabular-nums ${change.delta >= 0 ? 'text-good' : 'text-bad'}`}>
                  {change.delta >= 0 ? '▲' : '▼'} {currency(Math.abs(change.delta))} ({Math.round(Math.abs(change.pct) * 100)}%)
                </span>
              )}
            </div>
            <p className="text-xs text-ink-3">
              {value
                ? `${value.basis}${value.factor !== 1 ? ` · ${value.condition} ×${value.factor}` : ''} · guide ${currency(value.guide)}`
                : `No guide figure for a ${(item.completeness || 'copy').toLowerCase()} copy.`}
              {change && ` · since ${timeAgo(change.since)}`}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
              {[['Loose', market.prices?.loose], ['CIB', market.prices?.cib], ['New', market.prices?.new],
                ['Box only', market.prices?.boxOnly], ['Manual only', market.prices?.manualOnly]]
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <span key={k}>
                    {k} <span className="font-semibold tabular-nums text-ink-2">{currency(v)}</span>
                  </span>
                ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <a href={market.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-accent">
                {market.name}{market.console ? ` · ${market.console}` : ''} on PriceCharting
              </a>
              <button onClick={refresh} disabled={busy} className="shrink-0 font-semibold text-accent">
                {busy ? 'Checking…' : 'Refresh'}
              </button>
            </div>
            <p className="text-[11px] text-ink-3">
              Checked {market.fetchedAt ? timeAgo(market.fetchedAt) : 'never'}. Refreshes automatically when
              the app opens and the figure is more than a day old.
              {item.valueSource === 'manual' && ' Your estimated value was set by hand, so it is not overwritten.'}
            </p>
            <button onClick={match} disabled={busy} className="text-[11px] text-ink-3 underline">
              Not the right product? Re-match
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">Not matched to the price guide yet.</p>
            <button onClick={match} disabled={busy} className="text-sm font-semibold text-accent">
              {busy ? 'Searching…' : 'Match to price guide'}
            </button>
          </>
        )}
        {candidates && (
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {candidates.length === 0 && <p className="px-2.5 py-2 text-xs text-ink-3">Nothing in the guide matched.</p>}
            {candidates.map((c) => (
              <button key={c.productId} onClick={() => choose(c)} className="flex w-full items-baseline justify-between gap-2 px-2.5 py-2 text-left text-xs">
                <span className="min-w-0 flex-1 truncate">
                  {c.name} <span className="text-ink-3">· {c.console}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-2">{c.prices?.cib != null ? `CIB ${currency(c.prices.cib)}` : ''}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-bad">{error}</p>}
      </Card>
    </>
  )
}
