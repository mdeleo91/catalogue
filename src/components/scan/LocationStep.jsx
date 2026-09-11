import { useState } from 'react'
import { StepFooter, StepHeader } from './ScanChrome'
import { inputCls } from '../ui'
import { LOCATION_KINDS, TEMP_STATUSES } from '../../lib/constants'
import { childrenOf, locationById, locationChain } from '../../lib/locations'
import { uid } from '../../lib/id'
import { useStore } from '../../lib/store'

// Screen 6. Drill down house → room → shelf → container, creating levels
// inline as you go, since a first scan usually happens before any of the
// storage hierarchy exists.
export default function LocationStep({ draft, onChange, onNext, onBack, onSkip }) {
  const { state, dispatch } = useStore()
  const [nodeId, setNodeId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('container')
  const [temp, setTemp] = useState(Boolean(draft.tempStatus))

  const chain = nodeId ? locationChain(state.locations, nodeId) : []
  const options = childrenOf(state.locations, nodeId)
  const selected = draft.locationId ? locationById(state.locations, draft.locationId) : null

  const create = () => {
    if (!newName.trim()) return
    const id = uid('loc')
    dispatch({
      type: 'ADD_LOCATION',
      payload: {
        id,
        name: newName.trim(),
        kind: nodeId ? newKind : 'house',
        parentId: nodeId,
        qrCode: nodeId && newKind === 'container' ? `CAT-${id.slice(-6).toUpperCase()}` : null,
      },
    })
    setNewName('')
    setAdding(false)
    onChange({ locationId: id, tempStatus: null })
    setNodeId(id)
  }

  return (
    <div>
      <StepHeader
        onBack={onBack}
        title="Set location"
        subtitle="Where is this item currently stored?"
      />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-center text-xs font-semibold">
        {[
          [false, 'Stored'],
          [true, 'Temporary'],
        ].map(([v, label]) => (
          <button
            key={label}
            onClick={() => {
              setTemp(v)
              onChange(v ? { locationId: null } : { tempStatus: null })
            }}
            className={`rounded-md py-1.5 ${temp === v ? 'bg-card shadow-sm' : 'text-ink-3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {temp ? (
        <select
          className={inputCls}
          value={draft.tempStatus || ''}
          onChange={(e) => onChange({ tempStatus: e.target.value || null, locationId: null })}
        >
          <option value="">Select a status…</option>
          {TEMP_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
            <button onClick={() => setNodeId(null)} className="font-semibold text-accent">
              All
            </button>
            {chain.map((n) => (
              <span key={n.id} className="flex items-center gap-1">
                <span className="text-ink-3">›</span>
                <button onClick={() => setNodeId(n.id)} className="font-semibold text-accent">
                  {n.name}
                </button>
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {options.map((child) => {
              const isSelected = draft.locationId === child.id
              return (
                <div key={child.id} className="flex gap-1">
                  <button
                    onClick={() => onChange({ locationId: child.id, tempStatus: null })}
                    className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm ${
                      isSelected ? 'border-accent bg-accent/15 font-semibold text-accent' : 'border-line bg-card'
                    }`}
                  >
                    <span className="text-base">{ICONS[child.kind] || '▢'}</span>
                    <span className="flex-1">{child.name}</span>
                    {isSelected && <span className="text-xs">✓</span>}
                  </button>
                  <button
                    onClick={() => setNodeId(child.id)}
                    className="rounded-xl border border-line px-3 text-ink-3"
                    aria-label={`Open ${child.name}`}
                  >
                    ›
                  </button>
                </div>
              )
            })}
            {options.length === 0 && (
              <p className="py-2 text-sm text-ink-3">
                Nothing here yet — create the {nodeId ? 'first sub-location' : 'first house'} below.
              </p>
            )}
          </div>

          {adding ? (
            <div className="mt-3 space-y-2 rounded-xl border border-line bg-card p-3">
              <input
                className={inputCls}
                autoFocus
                placeholder={nodeId ? 'e.g. SNES Box #3' : "e.g. Michael's House"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              {nodeId && (
                <select className={inputCls} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
                  {LOCATION_KINDS.filter((k) => k.id !== 'house').map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button onClick={create} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                  Create &amp; select
                </button>
                <button onClick={() => setAdding(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-3 w-full rounded-xl border border-dashed border-accent/50 py-3 text-sm font-semibold text-accent"
            >
              + Create new location
            </button>
          )}

          {selected && (
            <div className="mt-4 rounded-xl border border-line bg-surface p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-3">Selected location</div>
              <div className="mt-1 text-sm font-semibold">
                {locationChain(state.locations, selected.id).map((n) => n.name).join(' → ')}
              </div>
            </div>
          )}
        </>
      )}

      <StepFooter
        primary="Continue"
        onPrimary={onNext}
        primaryDisabled={temp ? !draft.tempStatus : !draft.locationId}
        secondary="Skip for now"
        onSecondary={onSkip}
      />
    </div>
  )
}

const ICONS = { house: '⌂', room: '▢', area: '▤', shelf: '▦', container: '📦' }
