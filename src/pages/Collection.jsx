import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ItemCard from '../components/ItemCard'
import { EmptyState, inputCls } from '../components/ui'
import { CONDITIONS, COMPLETENESS_STATES, ITEM_TYPES, PLATFORMS } from '../lib/constants'
import { locationPath } from '../lib/locations'
import { useStore } from '../lib/store'

const SORTS = {
  recent: ['Recently added', (a, b) => b.createdAt.localeCompare(a.createdAt)],
  title: ['Title A–Z', (a, b) => a.title.localeCompare(b.title)],
  value: ['Highest value', (a, b) => (b.estimatedValue || 0) - (a.estimatedValue || 0)],
  year: ['Release year', (a, b) => (a.releaseYear || 9999) - (b.releaseYear || 9999)],
}

export default function Collection() {
  const { state } = useStore()
  const [params, setParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)

  const q = params.get('q') || ''
  const filters = {
    type: params.get('type') || '',
    platform: params.get('platform') || '',
    condition: params.get('condition') || '',
    completeness: params.get('completeness') || '',
  }
  const sort = params.get('sort') || 'recent'

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.items
      .filter((item) => {
        if (filters.type && item.type !== filters.type) return false
        if (filters.platform && item.platform !== filters.platform) return false
        if (filters.condition && item.condition !== filters.condition) return false
        if (filters.completeness && item.completeness !== filters.completeness) return false
        if (!needle) return true
        const hay = [
          item.title, item.platform, item.publisher, item.franchise, item.genre,
          item.notes, item.serialNumber,
          item.locationId ? locationPath(state.locations, item.locationId) : item.tempStatus,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
      .sort(SORTS[sort]?.[1] || SORTS.recent[1])
  }, [state.items, state.locations, q, filters.type, filters.platform, filters.condition, filters.completeness, sort])

  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Search titles, platforms, locations…"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`shrink-0 rounded-lg border px-3 text-sm font-semibold ${
            activeFilters ? 'border-accent text-accent' : 'border-line text-ink-2'
          }`}
        >
          Filter{activeFilters ? ` (${activeFilters})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-line bg-card p-3">
          <select className={inputCls} value={filters.type} onChange={(e) => setParam('type', e.target.value)}>
            <option value="">All types</option>
            {ITEM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.plural}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.platform} onChange={(e) => setParam('platform', e.target.value)}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.condition} onChange={(e) => setParam('condition', e.target.value)}>
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={inputCls} value={filters.completeness} onChange={(e) => setParam('completeness', e.target.value)}>
            <option value="">Any completeness</option>
            {COMPLETENESS_STATES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className={`${inputCls} col-span-2`} value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            {Object.entries(SORTS).map(([k, [label]]) => (
              <option key={k} value={k}>Sort: {label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span>{results.length} item{results.length === 1 ? '' : 's'}</span>
        <Link to="/items/new" className="font-semibold text-accent">+ Add manually</Link>
      </div>

      <div className="mt-2 space-y-2">
        {results.length === 0 ? (
          <EmptyState title="Nothing here yet">
            Try a different search, or add items with{' '}
            <Link to="/scan" className="font-semibold text-accent">Scan</Link>.
          </EmptyState>
        ) : (
          results.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
