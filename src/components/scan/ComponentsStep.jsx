import { CheckRow, StepFooter, StepHeader } from './ScanChrome'
import { completenessPercent } from '../../lib/constants'

const ICONS = {
  'Cartridge/Disc': '🕹', Box: '📦', Manual: '📄', Inserts: '🧾',
  'Map/Poster': '🗺', 'Registration Card': '✉', Console: '🎮',
  'Power Supply': '🔌', 'AV Cables': '🔗', Controller: '🎮',
  Accessory: '🔌', Magazine: '📖', Guide: '📘', 'Tray/Insert': '📦',
}

// Screen 8. Pre-checked from what the model reported seeing; the user confirms
// what is actually in this physical copy, which is what drives completeness.
export default function ComponentsStep({ components, detected, onToggle, onNext, onBack }) {
  const pct = completenessPercent(components)
  const present = components.filter((c) => c.present).length

  return (
    <div>
      <StepHeader
        onBack={onBack}
        title="Confirm components"
        subtitle="Tick what this copy actually includes. This is what completeness is measured from."
      />

      {detected?.length > 0 && (
        <p className="mb-3 rounded-lg bg-accent/15 px-3 py-2 text-xs text-accent-soft">
          Pre-ticked from your photos: {detected.join(', ')}. Correct anything the camera missed.
        </p>
      )}

      <div className="space-y-2">
        {components.map((c) => (
          <CheckRow key={c.id} checked={c.present} onToggle={() => onToggle(c.id)} thumb={ICONS[c.name] || '▢'}>
            {c.name}
          </CheckRow>
        ))}
      </div>

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
