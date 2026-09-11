import { Button } from '../ui'
import { StepHeader } from './ScanChrome'
import { typeLabel } from '../../lib/constants'

const ROWS = [
  ['Publisher', 'publisher'],
  ['Developer', 'developer'],
  ['Release date', 'releaseYear'],
  ['Region', 'region'],
  ['Edition', 'edition'],
  ['Issue #', 'issueNumber'],
  ['Genre', 'genre'],
]

// Screen 4. Overall confidence is the lowest per-field score the model gave,
// so the badge reflects the weakest part of the match rather than the best.
export default function ResultStep({ draft, onAccept, onReject, onBack }) {
  const { fields, confidence, photos, summary } = draft
  const scores = Object.values(confidence || {}).filter((n) => typeof n === 'number')
  const overall = scores.length ? Math.round(Math.min(...scores) * 100) : null
  const tone = overall == null ? 'text-ink-3' : overall >= 90 ? 'text-good' : overall >= 70 ? 'text-warn' : 'text-bad'

  return (
    <div>
      <StepHeader onBack={onBack} title="We found a match" subtitle="Check the details before continuing." />

      {photos[0] && (
        <img
          src={photos[0].full}
          alt=""
          className="mx-auto h-48 w-40 rounded-xl border border-line object-cover"
        />
      )}

      {overall != null && (
        <div className={`mt-3 text-center text-xs font-semibold ${tone}`}>
          ● {overall}% confidence
          {overall < 90 && <span className="ml-1 font-normal text-ink-3">· check the flagged fields</span>}
        </div>
      )}

      <div className="mt-3 text-center">
        <div className="text-lg font-bold leading-tight">{fields.title}</div>
        <div className="text-sm text-ink-2">
          {[fields.platform, typeLabel(fields.type || 'game')].filter(Boolean).join(' · ')}
        </div>
      </div>

      {summary && <p className="mt-2 text-center text-xs text-ink-3">{summary}</p>}

      <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {ROWS.filter(([, key]) => fields[key]).map(([label, key]) => {
          const score = confidence?.[key]
          const low = typeof score === 'number' && score < 0.9
          return (
            <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="text-ink-3">{label}</span>
              <span className="flex items-center gap-2 text-right font-medium">
                {fields[key]}
                {low && (
                  <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                    {Math.round(score * 100)}%
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 space-y-2">
        <Button className="w-full" onClick={onAccept}>Looks good</Button>
        <Button variant="secondary" className="w-full" onClick={onReject}>
          Not the right item
        </Button>
      </div>
    </div>
  )
}
