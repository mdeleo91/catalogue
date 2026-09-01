import { BarChart } from '../components/BarChart'
import { Card, SectionTitle } from '../components/ui'
import { currency, typeLabel } from '../lib/constants'
import { countBy, decadeOf, insights, overview, platformCompletion, sumBy } from '../lib/stats'
import { useStore } from '../lib/store'

function StatTile({ label, value, sub, tone }) {
  return (
    <Card className="py-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-0.5 text-xl font-bold tabular-nums ${tone || ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </Card>
  )
}

export default function Analytics() {
  const { state } = useStore()
  const items = state.items
  const stats = overview(items)
  const gainPct = stats.totalSpent > 0 ? Math.round((stats.gain / stats.totalSpent) * 1000) / 10 : null

  return (
    <div className="pb-8">
      <h1 className="text-xl font-bold">Analytics</h1>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatTile label="Total items" value={stats.total.toLocaleString()} />
        <StatTile label="Estimated value*" value={currency(stats.totalValue)} />
        <StatTile label="Total spent" value={currency(stats.totalSpent)} sub="where recorded" />
        <StatTile
          label="Estimated difference*"
          value={`${stats.gain >= 0 ? '+' : ''}${currency(stats.gain)}`}
          sub={gainPct != null ? `${gainPct >= 0 ? '+' : ''}${gainPct}% vs spent` : null}
          tone={stats.gain >= 0 ? 'text-good' : 'text-bad'}
        />
      </div>

      <SectionTitle>Collection by platform</SectionTitle>
      <Card>
        <BarChart rows={countBy(items, (i) => i.platform)} />
      </Card>

      <SectionTitle>Collection by media type</SectionTitle>
      <Card>
        <BarChart rows={countBy(items, (i) => typeLabel(i.type, true))} />
      </Card>

      <SectionTitle>Collection by decade</SectionTitle>
      <Card>
        <BarChart rows={countBy(items, decadeOf).sort((a, b) => a[0].localeCompare(b[0]))} />
      </Card>

      <SectionTitle>Estimated value by platform*</SectionTitle>
      <Card>
        <BarChart
          rows={sumBy(items, (i) => i.platform, (i) => i.estimatedValue)}
          format={(v) => currency(v)}
        />
      </Card>

      <SectionTitle>Estimated value by location*</SectionTitle>
      <Card>
        <BarChart
          rows={sumBy(items, (i) => {
            if (i.tempStatus || !i.locationId) return 'Other / Temporary'
            const root = state.locations.find((l) => !l.parentId && isUnder(state.locations, i.locationId, l.id))
            return root?.name || 'Other / Temporary'
          }, (i) => i.estimatedValue)}
          format={(v) => currency(v)}
        />
      </Card>

      <SectionTitle>Set completion</SectionTitle>
      {platformCompletion(items).length === 0 ? (
        <Card className="text-sm text-ink-3">
          Add games from platforms with known library sizes (NES, SNES, Genesis…) to see completion.
        </Card>
      ) : (
        <div className="space-y-2">
          {platformCompletion(items).map((row) => (
            <Card key={row.platform} className="py-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{row.platform}</span>
                <span className="tabular-nums text-ink-2">
                  {row.owned} / ~{row.librarySize} · {row.pct}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, row.pct)}%` }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Insights</SectionTitle>
      {insights(items).length === 0 ? (
        <Card className="text-sm text-ink-3">Insights appear as your collection data grows.</Card>
      ) : (
        <Card className="space-y-2">
          {insights(items).map((line, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-accent">✦</span>
              <span>{line}</span>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-6 text-center text-[11px] text-ink-3">
        *All values are estimates for planning purposes, not guaranteed resale prices.
      </p>
    </div>
  )
}

// True when locationId sits inside the tree rooted at rootId.
function isUnder(locations, locationId, rootId) {
  let node = locations.find((l) => l.id === locationId)
  let guard = 0
  while (node && guard++ < 50) {
    if (node.id === rootId) return true
    node = locations.find((l) => l.id === node.parentId)
  }
  return false
}
