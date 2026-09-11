import { Chip, StepFooter, StepHeader } from './ScanChrome'
import ValueCard from './ValueCard'
import { Field, inputCls } from '../ui'
import { ACQUISITION_METHODS, COMPLETENESS_STATES, CONDITIONS } from '../../lib/constants'

// Screen 5. Everything here is what the AI cannot know from a photograph.
export default function DetailsStep({ draft, onChange, onNext, onBack, onSaveForLater, value, onRetryValue }) {
  return (
    <div>
      <StepHeader
        onBack={onBack}
        title="Add details"
        subtitle="Tell us about your specific copy."
        action={
          <button onClick={onSaveForLater} className="text-sm font-semibold text-accent">
            Save for later
          </button>
        }
      />

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Condition</div>
      <div className="grid grid-cols-3 gap-2">
        {CONDITIONS.map((c) => (
          <Chip key={c} selected={draft.condition === c} onClick={() => onChange({ condition: c })}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        Completeness
      </div>
      <select
        className={inputCls}
        value={draft.completeness}
        onChange={(e) => onChange({ completeness: e.target.value })}
      >
        {COMPLETENESS_STATES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        Purchase info <span className="font-normal normal-case text-ink-3">(optional)</span>
      </div>
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
          <input
            className={inputCls}
            placeholder="Local game store"
            value={draft.source}
            onChange={(e) => onChange({ source: e.target.value })}
          />
        </Field>
      </div>

      <div className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        Value
      </div>
      <ValueCard
        state={value}
        condition={draft.condition}
        completeness={draft.completeness}
        value={draft.estimatedValue}
        onChange={(v) => onChange({ estimatedValue: v })}
        onRetry={onRetryValue}
      />

      <StepFooter primary="Continue" onPrimary={onNext} />
    </div>
  )
}
