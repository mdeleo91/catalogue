import { currency } from '../../lib/constants'

const TONE = { high: 'text-good', medium: 'text-warn', low: 'text-ink-3' }

// Shows a searched valuation with the listings it came from, so the number can
// be judged rather than taken on faith.
export default function ValueCard({ state, onUse, onRetry, applied }) {
  if (state?.status === 'loading') {
    return (
      <div className="rounded-xl border border-line bg-card p-3 text-xs text-ink-3">
        Checking recent sales and current listings…
      </div>
    )
  }

  // Switched off deployment-wide: say nothing rather than show an error.
  if (state?.status === 'error' && state.code === 'disabled') return null

  if (state?.status === 'error') {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
        {state.message}
        <button onClick={onRetry} className="ml-1 font-semibold underline">Try again</button>
      </div>
    )
  }

  const v = state?.status === 'ok' ? state.data : null
  if (!v) return null

  if (v.estimate == null) {
    return (
      <div className="rounded-xl border border-line bg-card p-3 text-xs text-ink-3">
        No reliable pricing found for this item. {v.note} Enter a value yourself if you have one.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">
          Market value
        </span>
        <span className={`text-[11px] font-semibold ${TONE[v.confidence] || 'text-ink-3'}`}>
          {v.confidence} confidence
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{currency(v.estimate)}</span>
        {v.low != null && v.high != null && (
          <span className="text-xs text-ink-3">
            range {currency(v.low)}–{currency(v.high)}
          </span>
        )}
      </div>

      {v.completeness && (
        <div className="text-[11px] text-ink-3">priced as {v.completeness.toLowerCase()}</div>
      )}
      {v.note && <p className="mt-1 text-xs text-ink-2">{v.note}</p>}

      {v.sources?.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-line pt-2">
          {v.sources.map((s, i) => (
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
      )}

      <button
        onClick={() => onUse(v.estimate)}
        disabled={applied}
        className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold ${
          applied ? 'bg-good/15 text-good' : 'bg-accent text-white'
        }`}
      >
        {applied ? `✓ Using ${currency(v.estimate)}` : `Use ${currency(v.estimate)} as estimated value`}
      </button>

      <p className="mt-2 text-[11px] text-ink-3">
        Searched {v.asOf} from public listings — an estimate for planning, not an appraisal or a
        guaranteed resale price.
      </p>
    </div>
  )
}
