import { useEffect, useState } from 'react'
import { currency } from '../../lib/constants'
import { CONDITION_ADJUST, marketValueFor } from '../../lib/market'
import { valueFor } from '../../lib/valuation'
import { inputCls } from '../ui'

const TONE = { high: 'text-good', medium: 'text-warn', low: 'text-ink-3' }

// The estimated value, derived rather than typed.
//
// A collectible's value is a market fact about a specific copy, so this is not
// a blank box to guess into — it is the searched range, positioned by the
// condition and completeness the user picked, recalculated as they change
// them. Typing a number is the fallback for when the search finds nothing,
// not the default way in.
// Two sources, one card. A price-guide match (PriceCharting) is the primary:
// a median of recent sales per completeness, adjusted for condition by an
// explicit house factor. The AI web search is the fallback for releases the
// guide does not cover, positioned inside the range it found.
export default function ValueCard({
  state, market, candidates, onPickCandidate, condition, completeness, value, onChange, onRetry,
}) {
  const [manual, setManual] = useState(false)
  const [picking, setPicking] = useState(false)
  const data = state?.status === 'ok' ? state.data : null
  const fromGuide = market ? marketValueFor(market, { condition, completeness }) : null
  const priced = fromGuide || (data ? valueFor(data, { condition, completeness }) : null)
  const derived = priced?.amount ?? null

  // Keep the stored value in step with the derived one as condition and
  // completeness change, unless the user has deliberately taken it over.
  useEffect(() => {
    if (manual || derived == null) return
    onChange(String(derived))
  }, [derived, manual])

  if (market) {
    return (
      <Shell>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Estimated value</span>
          <span className="text-[11px] font-semibold text-good">price guide</span>
        </div>
        {fromGuide ? (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {currency(manual && value !== '' ? Number(value) : fromGuide.amount)}
              </span>
              <span className="text-xs text-ink-3">guide {currency(fromGuide.guide)}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {fromGuide.basis}
              {fromGuide.factor !== 1 && ` · ${fromGuide.condition} ×${fromGuide.factor}`}
              {fromGuide.approximate && ' — closest figure the guide has, not an exact match'}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-ink-3">
            The guide has no figure for a {(completeness || 'copy').toLowerCase()} copy of this release.
          </p>
        )}
        <a href={market.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-accent">
          {market.name}{market.console ? ` · ${market.console}` : ''} on PriceCharting
        </a>
        <GuidePrices prices={market.prices} />
        {candidates?.length > 1 && (
          <button onClick={() => setPicking((p) => !p)} className="mt-2 text-xs font-semibold text-ink-3 underline">
            {picking ? 'Keep this one' : 'Not the right product?'}
          </button>
        )}
        {picking && (
          <div className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {candidates.map((c) => (
              <button
                key={c.productId}
                onClick={() => {
                  onPickCandidate(c)
                  setPicking(false)
                }}
                className={`flex w-full items-baseline justify-between gap-2 px-2.5 py-2 text-left text-xs ${
                  c.productId === market.productId ? 'bg-accent/10' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {c.name} <span className="text-ink-3">· {c.console}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-2">{c.prices?.cib != null ? `CIB ${currency(c.prices.cib)}` : ''}</span>
              </button>
            ))}
          </div>
        )}
        {fromGuide && (manual ? (
          <div className="mt-3">
            <ManualEntry value={value} onChange={onChange} bare />
            <button
              onClick={() => {
                setManual(false)
                onChange(String(fromGuide.amount))
              }}
              className="mt-1 text-xs font-semibold text-accent"
            >
              Use the guide value instead
            </button>
          </div>
        ) : (
          <button onClick={() => setManual(true)} className="mt-3 text-xs font-semibold text-ink-3 underline">
            Set a different value
          </button>
        ))}
        {!fromGuide && <ManualEntry value={value} onChange={onChange} bare />}
        <p className="mt-2 text-[11px] text-ink-3">
          Guide prices are medians of recent sales and refresh daily. The condition factor
          ({Object.entries(CONDITION_ADJUST).map(([k, v]) => `${k} ×${v}`).join(', ')}) is this
          app's rule, not market data. An estimate for planning, not an appraisal.
        </p>
      </Shell>
    )
  }

  if (state?.status === 'loading') {
    return (
      <Shell>
        <p className="text-xs text-ink-3">Checking recent sales and current listings…</p>
      </Shell>
    )
  }

  // Switched off deployment-wide: fall back to a plain field rather than
  // explaining an error the user cannot act on.
  if (state?.status === 'error' && state.code === 'disabled') {
    return <ManualEntry value={value} onChange={onChange} />
  }

  if (state?.status === 'error') {
    return (
      <Shell>
        <p className="text-xs text-warn">
          {state.message}{' '}
          <button onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </p>
        <ManualEntry value={value} onChange={onChange} bare />
      </Shell>
    )
  }

  if (!data) return <ManualEntry value={value} onChange={onChange} />

  // Searched, but nothing usable came back for this configuration.
  if (!priced || priced.amount == null) {
    return (
      <Shell>
        <div className="text-xs text-ink-3">
          {priced?.reason || 'No reliable pricing found for this item.'} {data.note}
        </div>
        <ManualEntry value={value} onChange={onChange} bare />
        <Sources data={data} />
      </Shell>
    )
  }

  const shown = manual && value !== '' ? Number(value) : priced.amount

  return (
    <Shell>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
          Estimated value
        </span>
        <span className={`text-[11px] font-semibold ${TONE[data.confidence] || 'text-ink-3'}`}>
          {data.confidence} confidence
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{currency(shown)}</span>
        <span className="text-xs text-ink-3">
          of {currency(priced.low)}–{currency(priced.high)}
        </span>
      </div>

      <p className="mt-0.5 text-[11px] text-ink-3">
        {priced.condition}, {priced.basis}
        {priced.approximate && ' — closest market found, not an exact match'}
      </p>

      {data.note && <p className="mt-2 text-xs text-ink-2">{data.note}</p>}

      <Sources data={data} />

      {manual ? (
        <div className="mt-3">
          <ManualEntry value={value} onChange={onChange} bare />
          <button
            onClick={() => {
              setManual(false)
              onChange(String(priced.amount))
            }}
            className="mt-1 text-xs font-semibold text-accent"
          >
            Use the searched value instead
          </button>
        </div>
      ) : (
        <button
          onClick={() => setManual(true)}
          className="mt-3 text-xs font-semibold text-ink-3 underline"
        >
          Set a different value
        </button>
      )}

      <p className="mt-2 text-[11px] text-ink-3">
        Searched {data.asOf} from public listings, then adjusted for this copy's condition — an
        estimate for planning, not an appraisal or a guaranteed resale price.
      </p>
    </Shell>
  )
}

function GuidePrices({ prices }) {
  const rows = [
    ['Loose', prices?.loose], ['CIB', prices?.cib], ['New', prices?.new],
    ['Box only', prices?.boxOnly], ['Manual only', prices?.manualOnly],
  ].filter(([, v]) => v != null)
  if (!rows.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px] text-ink-3">
      {rows.map(([k, v]) => (
        <span key={k}>
          {k} <span className="font-semibold tabular-nums text-ink-2">{currency(v)}</span>
        </span>
      ))}
    </div>
  )
}

function Shell({ children }) {
  return <div className="rounded-xl border border-line bg-card p-3">{children}</div>
}

function Sources({ data }) {
  if (!data.sources?.length) return null
  return (
    <div className="mt-2 space-y-1 border-t border-line pt-2">
      {data.sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-baseline justify-between gap-2 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-accent">
            {s.label}
            {s.date ? <span className="text-ink-3"> · {s.date}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums text-ink-2">
            {s.price != null ? currency(s.price) : '—'}
            <span className="ml-1 text-[10px] uppercase text-ink-3">{s.kind}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

function ManualEntry({ value, onChange, bare }) {
  const field = (
    <>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-3">
        Estimated value ($)
      </label>
      <input
        className={inputCls}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  )
  return bare ? <div className="mt-2">{field}</div> : <Shell>{field}</Shell>
}
