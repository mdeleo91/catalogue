import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import LocationPicker from '../components/LocationPicker'
import { Button, Card, CompletenessBadge, ConditionBadge, SectionTitle } from '../components/ui'
import { completenessPercent, currency, timeAgo, typeLabel } from '../lib/constants'
import { locationChain, locationPath } from '../lib/locations'
import { useStore } from '../lib/store'

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const [moving, setMoving] = useState(false)
  const item = state.items.find((i) => i.id === id)

  if (!item) {
    return (
      <div className="py-16 text-center text-sm text-ink-3">
        Item not found. <Link className="text-accent" to="/collection">Back to collection</Link>
      </div>
    )
  }

  const pct = completenessPercent(item.components)
  const chain = item.locationId ? locationChain(state.locations, item.locationId) : []
  const history = state.locationHistory.filter(
    (h) => h.subjectType === 'item' && h.subjectId === item.id,
  )
  const duplicates = state.items.filter(
    (i) => i.id !== item.id && i.type === item.type &&
      i.title.toLowerCase() === item.title.toLowerCase() && i.platform === item.platform,
  )
  const related = item.franchise
    ? state.items.filter((i) => i.id !== item.id && i.franchise === item.franchise)
    : []

  const move = ({ locationId, tempStatus }) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id: item.id, patch: { locationId, tempStatus } } })
    setMoving(false)
  }

  const remove = () => {
    if (!confirm(`Delete "${item.title}" from the collection? This cannot be undone.`)) return
    dispatch({ type: 'DELETE_ITEM', payload: item.id })
    navigate('/collection')
  }

  return (
    <div className="pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">{item.title}</h1>
          <div className="mt-1 text-sm text-ink-2">
            {[typeLabel(item.type), item.platform, item.releaseYear].filter(Boolean).join(' · ')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <ConditionBadge condition={item.condition} />
            <CompletenessBadge completeness={item.completeness} pct={pct} />
          </div>
        </div>
        <Link
          to={`/items/${item.id}/edit`}
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-2"
        >
          Edit
        </Link>
      </div>

      {item.photos?.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {item.photos.map((p, i) => (
            <img key={i} src={p.full || p.thumb} alt={`${item.title} photo ${i + 1}`} className="h-28 rounded-lg border border-line object-cover" />
          ))}
        </div>
      )}

      <SectionTitle>Location</SectionTitle>
      <Card>
        {item.tempStatus ? (
          <div className="text-sm font-semibold text-warn">◷ {item.tempStatus}</div>
        ) : chain.length ? (
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {chain.map((node, i) => (
              <span key={node.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-ink-3">→</span>}
                <Link to={`/locations/${node.id}`} className={i === chain.length - 1 ? 'font-semibold text-accent' : 'text-ink-2'}>
                  {node.name}
                </Link>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-ink-3">No location assigned.</div>
        )}
        <button onClick={() => setMoving(!moving)} className="mt-2 text-xs font-semibold text-accent">
          {moving ? 'Cancel move' : 'Move item →'}
        </button>
        {moving && (
          <div className="mt-2">
            <LocationPicker value={{ locationId: item.locationId, tempStatus: item.tempStatus }} onChange={move} />
          </div>
        )}
      </Card>

      {item.components?.length > 0 && (
        <>
          <SectionTitle>Components</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {item.components.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className={c.present ? '' : 'text-ink-3 line-through'}>
                  {c.present ? '✓' : '✗'} {c.name}
                </span>
                {c.present && c.condition && <ConditionBadge condition={c.condition} />}
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Details</SectionTitle>
      <Card className="py-2">
        <Row label="Publisher" value={item.publisher} />
        <Row label="Developer" value={item.developer} />
        <Row label="Region" value={item.region} />
        <Row label="Edition" value={item.edition} />
        <Row label="Franchise" value={item.franchise} />
        <Row label="Genre" value={item.genre} />
        <Row label="Issue #" value={item.issueNumber} />
        <Row label="Publication date" value={item.publicationDate} />
        <Row label="Author" value={item.author} />
        <Row label="ISBN" value={item.isbn} />
        <Row label="Model" value={item.model} />
        <Row label="Serial number" value={item.serialNumber} />
        <Row label="Working status" value={item.workingStatus} />
        <Row label="Notes" value={item.notes} />
      </Card>

      <SectionTitle>Acquisition & value</SectionTitle>
      <Card className="py-2">
        <Row label="Acquired" value={item.acquisitionMethod} />
        <Row label="Source" value={item.source} />
        <Row label="Purchase date" value={item.purchaseDate} />
        <Row label="Purchase price" value={item.purchasePrice != null ? currency(item.purchasePrice) : null} />
        <Row label="Estimated value" value={item.estimatedValue != null ? `${currency(item.estimatedValue)} (estimate)` : null} />
        {item.purchasePrice != null && item.estimatedValue != null && (
          <Row
            label="Estimated change"
            value={
              <span className={item.estimatedValue - item.purchasePrice >= 0 ? 'text-good' : 'text-bad'}>
                {item.estimatedValue - item.purchasePrice >= 0 ? '+' : ''}
                {currency(item.estimatedValue - item.purchasePrice)}
              </span>
            }
          />
        )}
      </Card>

      {item.valuation?.sources?.length > 0 && (
        <>
          <SectionTitle>Where this value came from</SectionTitle>
          <Card className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">
                {item.valuation.low != null && item.valuation.high != null
                  ? `Range ${currency(item.valuation.low)}–${currency(item.valuation.high)}`
                  : 'Searched estimate'}
              </span>
              <span className="text-xs text-ink-3">searched {item.valuation.asOf}</span>
            </div>
            {item.valuation.note && <p className="text-xs text-ink-2">{item.valuation.note}</p>}
            <div className="space-y-1 border-t border-line pt-2">
              {item.valuation.sources.map((s, i) => (
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
            <p className="text-[11px] text-ink-3">
              Public listings at the time of the search — an estimate, not an appraisal.
            </p>
          </Card>
        </>
      )}

      {duplicates.length > 0 && (
        <>
          <SectionTitle>Other copies ({duplicates.length})</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {duplicates.map((d) => (
              <Link key={d.id} to={`/items/${d.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{d.condition} · {d.completeness}</span>
                <span className="text-xs text-ink-3">
                  {d.tempStatus || (d.locationId ? locationPath(state.locations, d.locationId) : 'No location')}
                </span>
              </Link>
            ))}
          </Card>
        </>
      )}

      {related.length > 0 && (
        <>
          <SectionTitle>More from {item.franchise}</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {related.slice(0, 6).map((r) => (
              <Link key={r.id} to={`/items/${r.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-xs text-ink-3">{typeLabel(r.type)}</span>
              </Link>
            ))}
          </Card>
        </>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>Location history</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {history.map((h) => (
              <div key={h.id} className="px-4 py-2.5 text-sm">
                <div className="font-medium">
                  {h.locationId ? locationPath(state.locations, h.locationId) : h.tempStatus || h.path}
                </div>
                <div className="text-xs text-ink-3">
                  {new Date(h.at).toLocaleDateString()} · {timeAgo(h.at)} ·{' '}
                  {state.users.find((u) => u.id === h.by)?.name || 'Unknown'}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="mt-6">
        <Button variant="danger" onClick={remove} className="w-full">
          Delete item
        </Button>
      </div>
    </div>
  )
}
