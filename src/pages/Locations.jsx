import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, inputCls } from '../components/ui'
import { childrenOf, itemsUnder } from '../lib/locations'
import { useStore } from '../lib/store'
import { uid } from '../lib/id'

export default function Locations() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const houses = childrenOf(state.locations, null)
  const floating = state.items.filter((i) => !i.locationId)

  const addHouse = () => {
    if (!name.trim()) return
    dispatch({ type: 'ADD_LOCATION', payload: { id: uid('loc'), name: name.trim(), kind: 'house', parentId: null } })
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Locations</h1>
        <button onClick={() => setAdding(!adding)} className="text-sm font-semibold text-accent">
          + New house
        </button>
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="e.g. Brother's House"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button onClick={addHouse} className="shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-white">
            Add
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {houses.length === 0 && (
          <EmptyState icon="⌖" title="No locations yet">
            Add a house to start building your storage hierarchy: house → room → shelf → container.
          </EmptyState>
        )}
        {houses.map((house) => {
          const count = itemsUnder(state.items, state.locations, house.id).length
          const rooms = childrenOf(state.locations, house.id)
          return (
            <Link key={house.id} to={`/locations/${house.id}`}>
              <Card className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">⌂ {house.name}</div>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {rooms.length} room{rooms.length === 1 ? '' : 's'} inside
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">{count}</div>
                  <div className="text-[10px] uppercase text-ink-3">items</div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      {floating.length > 0 && (
        <Card className="mt-4 border-warn/40 bg-warn/10">
          <div className="text-sm font-semibold text-warn">
            {floating.length} item{floating.length === 1 ? '' : 's'} without a stored location
          </div>
          <div className="mt-1 space-y-1">
            {floating.slice(0, 5).map((i) => (
              <Link key={i.id} to={`/items/${i.id}`} className="block text-sm text-ink-2">
                {i.title} {i.tempStatus ? <span className="text-xs text-ink-3">({i.tempStatus})</span> : null}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
