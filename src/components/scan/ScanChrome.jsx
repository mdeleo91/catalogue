import { Button } from '../ui'

// Shared header for the scan wizard: back arrow, title, optional right action.
export function StepHeader({ onBack, title, subtitle, action }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="-ml-1 p-1 text-xl text-ink-2" aria-label="Back">
            ←
          </button>
        ) : (
          <span />
        )}
        {action}
      </div>
      <h1 className="mt-1 text-xl font-bold leading-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
    </div>
  )
}

// Sticky footer so the primary action stays reachable on a long step.
export function StepFooter({ primary, onPrimary, primaryDisabled, secondary, onSecondary }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-card/95 px-4 pb-3 pt-3 backdrop-blur">
      <Button className="w-full" onClick={onPrimary} disabled={primaryDisabled}>
        {primary}
      </Button>
      {secondary && (
        <button onClick={onSecondary} className="mt-2 w-full py-1.5 text-sm font-semibold text-accent">
          {secondary}
        </button>
      )}
    </div>
  )
}

export function Chip({ selected, children, ...rest }) {
  return (
    <button
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        selected ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink-2'
      }`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function CheckRow({ checked, onToggle, children, thumb }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-2.5 text-left"
    >
      {thumb !== undefined && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-lg">
          {thumb}
        </span>
      )}
      <span className="flex-1 text-sm">{children}</span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
          checked ? 'border-accent bg-accent text-white' : 'border-line text-transparent'
        }`}
      >
        ✓
      </span>
    </button>
  )
}
