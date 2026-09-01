import { useState } from 'react'
import { Button, Card, EmptyState, Field, SectionTitle, inputCls } from '../components/ui'
import { COMPLETENESS_STATES, CONDITIONS, PLATFORMS, currency } from '../lib/constants'
import { useStore } from '../lib/store'

const PRIORITIES = ['High', 'Medium', 'Low']
const PRIORITY_TONE = { High: 'bg-bad/15 text-bad', Medium: 'bg-warn/15 text-warn', Low: 'bg-ink-3/20 text-ink-2' }

const empty = { title: '', platform: '', desiredCondition: '', desiredCompleteness: '', targetPrice: '', priority: 'Medium' }

export default function Wishlist() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(empty)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = () => {
    if (!form.title.trim()) return
    dispatch({
      type: 'ADD_WISH',
      payload: {
        ...form,
        title: form.title.trim(),
        targetPrice: form.targetPrice === '' ? null : Number(form.targetPrice),
      },
    })
    setForm(empty)
    setAdding(false)
  }

  const sorted = [...state.wishlist].sort(
    (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority),
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Wishlist</h1>
        <button onClick={() => setAdding(!adding)} className="text-sm font-semibold text-accent">
          {adding ? 'Cancel' : '+ Add wish'}
        </button>
      </div>

      {adding && (
        <Card className="mt-3 space-y-3">
          <Field label="Title">
            <input className={inputCls} value={form.title} onChange={set('title')} placeholder="EarthBound" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select className={inputCls} value={form.platform} onChange={set('platform')}>
                <option value="">—</option>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Desired condition">
              <select className={inputCls} value={form.desiredCondition} onChange={set('desiredCondition')}>
                <option value="">Any</option>
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Desired completeness">
              <select className={inputCls} value={form.desiredCompleteness} onChange={set('desiredCompleteness')}>
                <option value="">Any</option>
                {COMPLETENESS_STATES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Target price ($)">
              <input className={inputCls} type="number" value={form.targetPrice} onChange={set('targetPrice')} />
            </Field>
          </div>
          <Button onClick={save} className="w-full">Add to wishlist</Button>
        </Card>
      )}

      <SectionTitle>Wanted ({sorted.length})</SectionTitle>
      {sorted.length === 0 ? (
        <EmptyState icon="✦" title="Nothing on the wishlist">
          Track the games and media you're hunting for, with target prices and priorities.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {sorted.map((w) => (
            <Card key={w.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{w.title}</div>
                <div className="text-xs text-ink-3">
                  {[w.platform, w.desiredCompleteness || 'Any completeness', w.desiredCondition && `${w.desiredCondition}+`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {w.targetPrice != null && (
                  <span className="text-sm font-semibold tabular-nums">&lt;{currency(w.targetPrice)}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_TONE[w.priority] || ''}`}>
                  {w.priority}
                </span>
                <button
                  onClick={() => dispatch({ type: 'DELETE_WISH', payload: w.id })}
                  className="text-ink-3"
                  aria-label={`Remove ${w.title} from wishlist`}
                >
                  ✕
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
