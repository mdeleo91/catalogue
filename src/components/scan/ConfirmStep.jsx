import { Button } from '../ui'
import { StepHeader } from './ScanChrome'
import { completenessPercent, currency, typeLabel } from '../../lib/constants'
import { locationPath } from '../../lib/locations'
import { useStore } from '../../lib/store'

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 px-3 py-2.5 text-sm">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

// Screen 9. Last look before anything is written to the collection.
export default function ConfirmStep({ draft, onSave, onBack, onEdit, saving }) {
  const { state } = useStore()
  const { fields, photos, components } = draft
  const present = components.filter((c) => c.present).length

  return (
    <div>
      <StepHeader onBack={onBack} title="Almost done" subtitle="Review everything before saving." />

      <div className="flex gap-3 rounded-xl border border-line bg-card p-3">
        {photos[0] && (
          <img src={photos[0].full} alt="" className="h-24 w-20 shrink-0 rounded-lg border border-line object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{fields.title}</div>
          <div className="text-xs text-ink-3">
            {[fields.platform, typeLabel(fields.type || 'game'), fields.region].filter(Boolean).join(' · ')}
          </div>
          <button onClick={onEdit} className="mt-2 text-xs font-semibold text-accent">
            Edit details
          </button>
        </div>
      </div>

      <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        <Row label="Condition" value={draft.condition} />
        <Row
          label="Completeness"
          value={`${draft.completeness} · ${present} of ${components.length} (${completenessPercent(components)}%)`}
        />
        <Row label="Purchase price" value={draft.purchasePrice ? currency(Number(draft.purchasePrice)) : null} />
        <Row label="Purchase date" value={draft.purchaseDate} />
        <Row label="Source" value={draft.source} />
        <Row label="Estimated value" value={draft.estimatedValue ? `${currency(Number(draft.estimatedValue))} (estimate)` : null} />
        <Row
          label="Location"
          value={
            draft.tempStatus ||
            (draft.locationId ? locationPath(state.locations, draft.locationId) : 'Not set')
          }
        />
        <Row label="Photos" value={`${photos.length}`} />
      </div>

      <div className="mt-5">
        <Button className="w-full" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save to collection'}
        </Button>
      </div>
    </div>
  )
}
