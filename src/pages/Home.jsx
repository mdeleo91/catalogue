import { Link } from 'react-router-dom'
import { Card, SectionTitle, EmptyState } from '../components/ui'
import { useStore } from '../lib/store'
import { overview, byHouse } from '../lib/stats'
import { currency, timeAgo } from '../lib/constants'

export default function Home() {
  const { state } = useStore()
  const stats = overview(state.items)
  const houses = byHouse(state.items, state.locations)
  const recent = state.activityLog.slice(0, 8)

  return (
    <div>
      <Card className="border-accent/30 bg-gradient-to-br from-accent to-accent-deep text-white">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Collection</span>
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            Know what you have. Know where it is.
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div>
            <div className="font-display text-4xl font-bold tabular-nums">{stats.total.toLocaleString()}</div>
            <div className="text-sm opacity-80">items · {stats.games} games</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{currency(stats.totalValue)}</div>
            <div className="text-sm opacity-80">estimated value*</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${stats.completePct}%` }} />
        </div>
        <div className="mt-1 text-xs opacity-80">{stats.completePct}% of items complete</div>
      </Card>

      <Link
        to="/scan"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-accent/50 bg-card py-3.5 text-sm font-bold text-accent-soft active:bg-accent/10"
      >
        ◉ Scan something
      </Link>

      <SectionTitle>Media</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {stats.byType.map((t) => (
          <Link key={t.id} to={`/collection?type=${t.id}`}>
            <Card className="flex items-baseline justify-between py-3">
              <span className="text-sm text-ink-2">{t.plural}</span>
              <span className="text-lg font-bold tabular-nums">{t.count}</span>
            </Card>
          </Link>
        ))}
      </div>

      <SectionTitle>Locations</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {houses.length === 0 && (
          <div className="p-4 text-sm text-ink-3">No located items yet.</div>
        )}
        {houses.map(([name, count]) => (
          <div key={name} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{name}</span>
            <span className="font-semibold tabular-nums">{count}</span>
          </div>
        ))}
      </Card>

      <SectionTitle action={<Link className="text-xs font-semibold text-accent" to="/wishlist">Wishlist →</Link>}>
        Recent activity
      </SectionTitle>
      {recent.length === 0 ? (
        <EmptyState icon="✎" title="No activity yet">
          Changes made by you and your co-collector will show up here.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {recent.map((a) => {
            const user = state.users.find((u) => u.id === a.userId)
            const body = (
              <>
                <span className="font-semibold">{user?.name || 'Someone'}</span>{' '}
                <span className="text-ink-2">{a.action}</span> <span>{a.subject}</span>
              </>
            )
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {a.itemId && state.items.some((i) => i.id === a.itemId) ? (
                    <Link to={`/items/${a.itemId}`}>{body}</Link>
                  ) : (
                    body
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{timeAgo(a.at)}</span>
              </div>
            )
          })}
        </Card>
      )}

      <p className="mt-6 text-center text-[11px] text-ink-3">
        *Values are estimates for planning only, not guaranteed resale prices.
      </p>
    </div>
  )
}
