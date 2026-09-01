import { useState } from 'react'
import { LOCATION_KINDS, TEMP_STATUSES } from '../lib/constants'
import { childrenOf, locationById, locationChain } from '../lib/locations'
import { useStore } from '../lib/store'
import { inputCls } from './ui'
import { uid } from '../lib/id'

// Drill-down picker over the location tree. value = { locationId, tempStatus }.
// New locations can be created inline at any level while picking.
export default function LocationPicker({ value, onChange }) {
  const { state, dispatch } = useStore()
  const [mode, setMode] = useState(value?.tempStatus ? 'temp' : 'stored')
  const [nodeId, setNodeId] = useState(() => {
    const sel = value?.locationId ? locationById(state.locations, value.locationId) : null
    return sel ? sel.parentId : null
  })
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('container')

  const chain = nodeId ? locationChain(state.locations, nodeId) : []
  const options = childrenOf(state.locations, nodeId)
  const kindOfChildren = nodeId ? LOCATION_KINDS : [LOCATION_KINDS[0]]

  const select = (id) => onChange({ locationId: id, tempStatus: null })

  const createHere = () => {
    if (!newName.trim()) return
    const id = uid('loc')
    dispatch({
      type: 'ADD_LOCATION',
      payload: {
        id,
        name: newName.trim(),
        kind: nodeId ? newKind : 'house',
        parentId: nodeId,
        qrCode: newKind === 'container' && nodeId ? `CAT-${id.slice(-6).toUpperCase()}` : null,
      },
    })
    setNewName('')
    setAdding(false)
    select(id)
  }

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-center text-xs font-semibold">
        {[
          ['stored', 'Stored location'],
          ['temp', 'Temporary status'],
        ].map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 ${mode === m ? 'bg-card shadow-sm' : 'text-ink-3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'temp' ? (
        <select
          className={inputCls}
          value={value?.tempStatus || ''}
          onChange={(e) => onChange({ locationId: null, tempStatus: e.target.value || null })}
        >
          <option value="">Select a status…</option>
          {TEMP_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-2">
            <button type="button" className="font-semibold text-accent" onClick={() => setNodeId(null)}>
              All locations
            </button>
            {chain.map((node) => (
              <span key={node.id} className="flex items-center gap-1">
                <span className="text-ink-3">→</span>
                <button type="button" className="font-semibold text-accent" onClick={() => setNodeId(node.id)}>
                  {node.name}
                </button>
              </span>
            ))}
          </div>

          {nodeId && (
            <button
              type="button"
              onClick={() => select(nodeId)}
              className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                value?.locationId === nodeId ? 'border-accent bg-accent/15 text-accent' : 'border-line'
              }`}
            >
              ✓ Put it here: {locationById(state.locations, nodeId)?.name}
            </button>
          )}

          <div className="space-y-1">
            {options.map((child) => (
              <div key={child.id} className="flex gap-1">
                <button
                  type="button"
                  onClick={() => select(child.id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                    value?.locationId === child.id
                      ? 'border-accent bg-accent/15 font-semibold text-accent'
                      : 'border-line'
                  }`}
                >
                  {child.name}
                  <span className="ml-1 text-[10px] uppercase text-ink-3">{child.kind}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNodeId(child.id)}
                  className="rounded-lg border border-line px-3 text-ink-3"
                  aria-label={`Open ${child.name}`}
                >
                  ›
                </button>
              </div>
            ))}
          </div>

          {adding ? (
            <div className="mt-2 space-y-2 rounded-lg bg-surface p-2">
              <input
                className={inputCls}
                placeholder={nodeId ? 'Name (e.g. SNES Box #4)' : "Name (e.g. Michael's House)"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              {nodeId && (
                <select className={inputCls} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
                  {kindOfChildren.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={createHere} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                  Create & select
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-2 text-xs font-semibold text-accent"
            >
              + New {nodeId ? 'location here' : 'house'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
