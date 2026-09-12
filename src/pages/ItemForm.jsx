import { useMemo, useState } from 'react'
import SourcePicker, { knownSources } from '../components/SourcePicker'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import LocationPicker from '../components/LocationPicker'
import { Button, ConfidenceBadge, Field, SectionTitle, inputCls } from '../components/ui'
import {
  ACQUISITION_METHODS, COMPLETENESS_STATES, CONDITIONS, DEFAULT_COMPONENTS,
  ITEM_TYPES, PLATFORMS, REGIONS,
} from '../lib/constants'
import { uid } from '../lib/id'
import { useStore } from '../lib/store'

const emptyItem = (type = 'game') => ({
  type,
  title: '',
  platform: '',
  publisher: '',
  developer: '',
  releaseYear: '',
  region: '',
  edition: '',
  genre: '',
  franchise: '',
  issueNumber: '',
  publicationDate: '',
  isbn: '',
  author: '',
  model: '',
  serialNumber: '',
  workingStatus: '',
  condition: 'Very Good',
  completeness: 'Incomplete',
  components: DEFAULT_COMPONENTS[type].map((name) => ({ id: uid('comp'), name, present: true, condition: null })),
  photos: [],
  locationId: null,
  tempStatus: null,
  purchasePrice: '',
  purchaseDate: '',
  acquisitionMethod: 'Unknown',
  source: '',
  estimatedValue: '',
  notes: '',
  aiFields: {},
})

export default function ItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routerState = useLocation().state
  const { state, dispatch } = useStore()
  const existing = id ? state.items.find((i) => i.id === id) : null

  const [form, setForm] = useState(() => {
    if (existing) return { ...emptyItem(existing.type), ...existing }
    const base = emptyItem(routerState?.prefill?.type || 'game')
    if (routerState?.prefill) {
      const clean = Object.fromEntries(
        Object.entries(routerState.prefill).filter(([, v]) => v != null && v !== ''),
      )
      return {
        ...base,
        ...clean,
        photos: routerState.photos || [],
        aiFields: routerState.confidence || {},
      }
    }
    return base
  })

  const confidence = form.aiFields || {}
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }))

  const setType = (type) =>
    setForm((f) => ({
      ...f,
      type,
      components: DEFAULT_COMPONENTS[type].map((name) => ({ id: uid('comp'), name, present: true, condition: null })),
    }))

  const toggleComponent = (compId) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c) => (c.id === compId ? { ...c, present: !c.present } : c)),
    }))

  const setComponentCondition = (compId, condition) =>
    setForm((f) => ({
      ...f,
      components: f.components.map((c) => (c.id === compId ? { ...c, condition: condition || null } : c)),
    }))

  const addComponent = () => {
    const name = prompt('Component name (e.g. Map, Poster)')
    if (!name?.trim()) return
    setForm((f) => ({
      ...f,
      components: [...f.components, { id: uid('comp'), name: name.trim(), present: true, condition: null }],
    }))
  }

  const canSave = form.title.trim().length > 0

  const save = () => {
    const num = (v) => (v === '' || v == null ? null : Number(v))
    const payload = {
      ...form,
      title: form.title.trim(),
      releaseYear: num(form.releaseYear),
      issueNumber: num(form.issueNumber),
      purchasePrice: num(form.purchasePrice),
      estimatedValue: num(form.estimatedValue),
      platform: form.platform || null,
      region: form.region || null,
    }
    if (existing) {
      dispatch({ type: 'UPDATE_ITEM', payload: { id: existing.id, patch: payload } })
      navigate(`/items/${existing.id}`)
    } else {
      const newId = uid('item')
      dispatch({ type: 'ADD_ITEM', payload: { ...payload, id: newId } })
      navigate(`/items/${newId}`, { replace: true })
    }
  }

  const conf = (key) =>
    !existing && confidence[key] != null ? <ConfidenceBadge value={confidence[key]} /> : null

  const showGameish = ['game', 'console', 'accessory', 'box', 'manual'].includes(form.type)
  const showMag = form.type === 'magazine'
  const showGuide = form.type === 'guide'

  return (
    <div className="pb-8">
      <h1 className="text-xl font-bold">{existing ? 'Edit item' : 'Add item'}</h1>
      {routerState?.summary && (
        <p className="mt-1 rounded-lg bg-accent/15 px-3 py-2 text-xs text-accent-soft">
          AI: {routerState.summary} — fields below are AI-identified; low-confidence ones are flagged
          for your confirmation.
        </p>
      )}

      {form.photos?.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {form.photos.map((p, i) => (
            <img key={i} src={p.full || p.thumb} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
          ))}
        </div>
      )}

      <SectionTitle>Identity</SectionTitle>
      <div className="space-y-3">
        <Field label="Media type">
          <select className={inputCls} value={form.type} onChange={(e) => setType(e.target.value)}>
            {ITEM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Title" hint={conf('title')}>
          <input className={inputCls} value={form.title} onChange={set('title')} placeholder="Super Metroid" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform" hint={conf('platform')}>
            <select className={inputCls} value={form.platform || ''} onChange={set('platform')}>
              <option value="">—</option>
              {PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Release year" hint={conf('releaseYear')}>
            <input className={inputCls} type="number" value={form.releaseYear ?? ''} onChange={set('releaseYear')} />
          </Field>
          <Field label="Publisher" hint={conf('publisher')}>
            <input className={inputCls} value={form.publisher || ''} onChange={set('publisher')} />
          </Field>
          {showGameish && (
            <Field label="Developer" hint={conf('developer')}>
              <input className={inputCls} value={form.developer || ''} onChange={set('developer')} />
            </Field>
          )}
          <Field label="Region" hint={conf('region')}>
            <select className={inputCls} value={form.region || ''} onChange={set('region')}>
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Edition" hint={conf('edition')}>
            <input className={inputCls} value={form.edition || ''} onChange={set('edition')} placeholder="Player's Choice…" />
          </Field>
          <Field label="Franchise" hint={conf('franchise')}>
            <input className={inputCls} value={form.franchise || ''} onChange={set('franchise')} placeholder="Metroid…" />
          </Field>
          <Field label="Genre" hint={conf('genre')}>
            <input className={inputCls} value={form.genre || ''} onChange={set('genre')} />
          </Field>
          {showMag && (
            <>
              <Field label="Issue #" hint={conf('issueNumber')}>
                <input className={inputCls} type="number" value={form.issueNumber ?? ''} onChange={set('issueNumber')} />
              </Field>
              <Field label="Publication date" hint={conf('publicationDate')}>
                <input className={inputCls} type="date" value={form.publicationDate || ''} onChange={set('publicationDate')} />
              </Field>
            </>
          )}
          {showGuide && (
            <>
              <Field label="Author" hint={conf('author')}>
                <input className={inputCls} value={form.author || ''} onChange={set('author')} />
              </Field>
              <Field label="ISBN" hint={conf('isbn')}>
                <input className={inputCls} value={form.isbn || ''} onChange={set('isbn')} />
              </Field>
            </>
          )}
          {form.type === 'console' && (
            <>
              <Field label="Model" hint={conf('model')}>
                <input className={inputCls} value={form.model || ''} onChange={set('model')} placeholder="SNS-001" />
              </Field>
              <Field label="Serial number">
                <input className={inputCls} value={form.serialNumber || ''} onChange={set('serialNumber')} />
              </Field>
              <Field label="Working status">
                <select className={inputCls} value={form.workingStatus || ''} onChange={set('workingStatus')}>
                  <option value="">—</option>
                  <option>Working</option>
                  <option>Partially working</option>
                  <option>Not working</option>
                  <option>Untested</option>
                </select>
              </Field>
            </>
          )}
        </div>
      </div>

      <SectionTitle>Condition & completeness</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Overall condition">
          <select className={inputCls} value={form.condition} onChange={set('condition')}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Completeness">
          <select className={inputCls} value={form.completeness} onChange={set('completeness')}>
            {COMPLETENESS_STATES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-2">Components included</span>
          <button type="button" onClick={addComponent} className="text-xs font-semibold text-accent">
            + Add component
          </button>
        </div>
        <div className="space-y-2">
          {form.components.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleComponent(c.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                  c.present ? 'border-good bg-good/15 text-good' : 'border-line text-ink-3'
                }`}
                aria-label={`${c.name} ${c.present ? 'present' : 'missing'}`}
              >
                {c.present ? '✓' : '✗'}
              </button>
              <span className={`flex-1 text-sm ${c.present ? '' : 'text-ink-3 line-through'}`}>{c.name}</span>
              {c.present && (
                <select
                  className="rounded-md border border-line bg-card px-1.5 py-1 text-xs text-ink-2"
                  value={c.condition || ''}
                  onChange={(e) => setComponentCondition(c.id, e.target.value)}
                >
                  <option value="">condition…</option>
                  {CONDITIONS.map((cc) => (
                    <option key={cc}>{cc}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      <SectionTitle>Location</SectionTitle>
      <LocationPicker
        value={{ locationId: form.locationId, tempStatus: form.tempStatus }}
        onChange={({ locationId, tempStatus }) => setForm((f) => ({ ...f, locationId, tempStatus }))}
      />

      <SectionTitle>Acquisition & value</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Acquisition method">
          <select className={inputCls} value={form.acquisitionMethod || 'Unknown'} onChange={set('acquisitionMethod')}>
            {ACQUISITION_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Source / seller">
          <SourcePicker
            value={form.source || ''}
            onChange={(v) => setForm((f) => ({ ...f, source: v }))}
            known={knownSources(state.items)}
          />
        </Field>
        <Field label="Purchase date">
          <input className={inputCls} type="date" value={form.purchaseDate || ''} onChange={set('purchaseDate')} />
        </Field>
        <Field label="Purchase price ($)">
          <input className={inputCls} type="number" value={form.purchasePrice ?? ''} onChange={set('purchasePrice')} />
        </Field>
        <Field label="Estimated value ($)">
          <input className={inputCls} type="number" value={form.estimatedValue ?? ''} onChange={set('estimatedValue')} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea className={`${inputCls} min-h-20`} value={form.notes || ''} onChange={set('notes')} />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <Button onClick={save} disabled={!canSave} className="flex-1">
          {existing ? 'Save changes' : 'Add to collection'}
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </div>
  )
}
