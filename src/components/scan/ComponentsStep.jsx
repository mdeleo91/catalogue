import { useState } from 'react'
import { CheckRow, StepFooter, StepHeader } from './ScanChrome'
import { completenessPercent } from '../../lib/constants'
import { iconFor } from '../../lib/components'
import { inputCls } from '../ui'

// Screen 8. The checklist is the release's own as-sold contents when the
// model knows them — two discs, a longbox, a registration card — and the
// standard list for the item type when it does not. Pre-ticked from what was
// seen in the photos; the user confirms what this physical copy has, which is
// what completeness is measured from.
export default function ComponentsStep({
  title, components, detected, manifestKnown, listingsPending, onToggle, onAdd, onNext, onBack,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const pct = completenessPercent(components)
  const present = components.filter((c) => c.present).length
  const fromListings = components.filter((c) => c.source === 'listing')

  const submitAdd = () => {
    onAdd(name)
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <StepHeader
        onBack={onBack}
        title="Confirm components"
        subtitle={
          manifestKnown
            ? `A complete copy of ${title || 'this release'} shipped with these. Tick what yours has.`
            : 'Tick what this copy actually includes. This is what completeness is measured from.'
        }
      />

      {detected?.length > 0 && (
        <p className="mb-3 rounded-lg bg-accent/15 px-3 py-2 text-xs text-accent-soft">
          Pre-ticked from your photos: {detected.join(', ')}. Correct anything the camera missed.
        </p>
      )}

      <div className="space-y-2">
        {components.map((c) => (
          <CheckRow key={c.id} checked={c.present} onToggle={() => onToggle(c.id)} thumb={iconFor(c.name)}>
            {c.name}
            {c.unsure && <Tag>unsure it shipped with this</Tag>}
            {c.source === 'listing' && <Tag>seen in listings</Tag>}
            {c.source === 'photo' && <Tag>seen in your photos</Tag>}
          </CheckRow>
        ))}
      </div>

      {adding ? (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            className={inputCls}
            placeholder="e.g. Poster, Sticker sheet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
          />
          <button onClick={submitAdd} className="shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
            Add
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 text-sm font-semibold text-accent">
          + Add a part that isn't listed
        </button>
      )}

      {listingsPending && (
        <p className="mt-3 text-[11px] text-ink-3">
          Checking sold listings for what a complete copy includes — anything missing here will be
          added below.
        </p>
      )}
      {fromListings.length > 0 && (
        <p className="mt-3 text-[11px] text-ink-3">
          Sellers of complete copies also list: {fromListings.map((c) => c.name).join(', ')}.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-line bg-card p-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-ink-2">Completeness</span>
          <span className="font-semibold tabular-nums">
            {present} of {components.length} · {pct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <StepFooter primary="Continue" onPrimary={onNext} />
    </div>
  )
}

function Tag({ children }) {
  return (
    <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">
      {children}
    </span>
  )
}
