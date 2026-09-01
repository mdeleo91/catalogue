import { conditionRank } from '../lib/constants'

export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`rounded-xl border border-line bg-card p-4 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">{children}</h2>
      {action}
    </div>
  )
}

export function ConditionBadge({ condition }) {
  if (!condition) return null
  const rank = conditionRank(condition)
  const tone = rank <= 2 ? 'bg-good/15 text-good' : rank <= 4 ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{condition}</span>
}

export function CompletenessBadge({ completeness, pct }) {
  if (!completeness) return null
  const tone =
    completeness === 'Complete'
      ? 'bg-good/15 text-good'
      : completeness === 'Near Complete'
        ? 'bg-warn/15 text-warn'
        : 'bg-ink-3/20 text-ink-2'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {completeness}
      {pct != null ? ` · ${pct}%` : ''}
    </span>
  )
}

// AI confidence indicator: green = confident, amber = confirm, red = guess.
export function ConfidenceBadge({ value }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const tone = pct >= 90 ? 'text-good' : pct >= 70 ? 'text-warn' : 'text-bad'
  const label = pct >= 90 ? 'AI identified' : 'confirm'
  return (
    <span className={`text-[10px] font-medium ${tone}`} title={`AI confidence ${pct}%`}>
      {pct}% {label}
    </span>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-ink-2">
        {label}
        {hint}
      </span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export function Button({ children, variant = 'primary', className = '', ...rest }) {
  const styles = {
    primary: 'bg-accent text-white active:bg-accent-deep disabled:opacity-40',
    secondary: 'border border-line bg-card text-ink active:bg-surface',
    danger: 'border border-bad/40 bg-card text-bad active:bg-bad/10',
  }
  return (
    <button
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function EmptyState({ icon = '▢', title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <div className="text-3xl text-ink-3">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-ink-2">{children}</div>
    </div>
  )
}
