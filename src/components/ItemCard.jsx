import { Link } from 'react-router-dom'
import { completenessPercent, typeLabel } from '../lib/constants'
import { locationPath } from '../lib/locations'
import { useStore } from '../lib/store'
import { CompletenessBadge, ConditionBadge } from './ui'

const TYPE_ICONS = {
  game: '🕹', magazine: '📖', guide: '📘', manual: '📄',
  box: '📦', console: '🎮', accessory: '🔌',
}

export default function ItemCard({ item }) {
  const { state } = useStore()
  const path = item.tempStatus
    ? item.tempStatus
    : item.locationId
      ? locationPath(state.locations, item.locationId)
      : 'No location'

  return (
    <Link
      to={`/items/${item.id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 active:bg-surface"
    >
      {item.photos?.[0]?.thumb ? (
        <img
          src={item.photos[0].thumb}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-line object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-xl">
          {TYPE_ICONS[item.type] || '▢'}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{item.title}</div>
        <div className="truncate text-xs text-ink-3">
          {[typeLabel(item.type), item.platform, item.releaseYear].filter(Boolean).join(' · ')}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <ConditionBadge condition={item.condition} />
          <CompletenessBadge
            completeness={item.completeness}
            pct={completenessPercent(item.components)}
          />
        </div>
      </div>
      <div className="max-w-[7rem] shrink-0 text-right text-[10px] leading-tight text-ink-3">
        {path}
      </div>
    </Link>
  )
}
