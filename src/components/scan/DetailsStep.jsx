import { StepFooter, StepHeader } from './ScanChrome'
import SourcePicker from '../SourcePicker'
import { Field, inputCls } from '../ui'
import { ACQUISITION_METHODS } from '../../lib/constants'

// Screen 5. Only what the photos cannot tell us: how this copy came to be
// yours. Condition and completeness were discovered on the earlier steps, and
// the value follows from them on the next.
export default function DetailsStep({ draft, onChange, onNext, onBack, onSaveForLater, knownSources }) {
  return (
    <div>
      <StepHeader
        onBack={onBack}
        title="Purchase info"
        subtitle="How this copy came to you. All optional."
        action={
          <button onClick={onSaveForLater} className="text-sm font-semibold text-accent">
            Save for later
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase price ($)">
          <input
            className={inputCls}
            type="number"
            inputMode="decimal"
            value={draft.purchasePrice}
            onChange={(e) => onChange({ purchasePrice: e.target.value })}
          />
        </Field>
        <Field label="Purchase date">
          <input
            className={inputCls}
            type="date"
            value={draft.purchaseDate}
            onChange={(e) => onChange({ purchaseDate: e.target.value })}
          />
        </Field>
        <Field label="How acquired">
          <select
            className={inputCls}
            value={draft.acquisitionMethod}
            onChange={(e) => onChange({ acquisitionMethod: e.target.value })}
          >
            {ACQUISITION_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <SourcePicker value={draft.source} onChange={(v) => onChange({ source: v })} known={knownSources} />
        </Field>
      </div>

      <StepFooter primary="Continue" onPrimary={onNext} />
    </div>
  )
}
