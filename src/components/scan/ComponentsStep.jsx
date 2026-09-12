import { useState } from 'react'
import { StepFooter, StepHeader } from './ScanChrome'
import { completenessPercent } from '../../lib/constants'
import { inputCls } from '../ui'

// Screen 8. The checklist is the release's own as-sold contents when the
// model knows them — two discs, a longbox, a registration card — and the
// standard list for the item type when it does not. Pre-ticked from what was
// seen in the photos; the user confirms what this physical copy has, which is
// what completeness is measured from.
//
// Each row has three states, not two: present, missing, or omitted. Omitted
// means the discovery was wrong and the release never shipped with the part —
// it stops counting rather than reading as a missing piece.
export default function ComponentsStep({
  title, components, detected, manifestKnown, listingsPending, completeness,
  onToggle, onOmit, onAdd, onNext, onBack,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const counted = components.filter((c) => !c.omitted)
  const omitted = components.length - counted.length
  const pct = completenessPercent(components)
  const present = counted.filter((c) => c.present).length
  const fromListings = components.filter((c) => c.source === 'listing' && !c.omitted)

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
          <Row key={c.id} c={c} onToggle={() => onToggle(c.id)} onOmit={() => onOmit(c.id)} />
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
          <span className="text-ink-2">
            Completeness
            {completeness && <span className="ml-2 font-semibold text-accent-soft">{completeness}</span>}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {present} of {counted.length} · {pct ?? 0}%
          </span>
        </div>
        {omitted > 0 && (
          <p className="mt-0.5 text-[11px] text-ink-3">
            {omitted} {omitted === 1 ? 'part' : 'parts'} omitted — didn't ship with this release, not counted.
          </p>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>

      <StepFooter primary="Continue" onPrimary={onNext} />
    </div>
  )
}

function Row({ c, onToggle, onOmit }) {
  if (c.omitted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-ink-3">
        <span className="min-w-0 flex-1 truncate line-through">{c.name}</span>
        <span className="shrink-0 text-[11px]">not counted</span>
        <button onClick={onOmit} className="shrink-0 text-xs font-semibold text-accent">
          Restore
        </button>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="flex items-center">
        <button onClick={onToggle} className="flex flex-1 items-center gap-3 p-2.5 text-left">
          <span className="flex-1 text-sm">
            {c.name}
            {c.unsure && <Tag>unsure it shipped with this</Tag>}
            {c.source === 'listing' && <Tag>seen in listings</Tag>}
            {c.source === 'photo' && <Tag>seen in your photos</Tag>}
          </span>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
              c.present ? 'border-accent bg-accent text-white' : 'border-line text-transparent'
            }`}
          >
            ✓
          </span>
        </button>
        <button
          onClick={onOmit}
          title="This release didn't ship with it"
          className="shrink-0 border-l border-line px-3 py-2.5 text-xs text-ink-3"
        >
          Omit
        </button>
      </div>
      {c.condition && (
        <p className="border-t border-line px-2.5 py-1.5 text-[11px] text-ink-3">
          Looks <span className="font-semibold text-ink-2">{c.condition}</span>
          {c.conditionNote ? ` — ${c.conditionNote}` : ''}
        </p>
      )}
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
