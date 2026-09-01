import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import ItemCard from '../components/ItemCard'
import LocationPicker from '../components/LocationPicker'
import { Button, Card, SectionTitle, inputCls } from '../components/ui'
import { LOCATION_KINDS, timeAgo } from '../lib/constants'
import { childrenOf, itemsAt, itemsUnder, locationById, locationChain } from '../lib/locations'
import { uid } from '../lib/id'
import { useStore } from '../lib/store'

export default function LocationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const [moving, setMoving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState('container')
  const [qr, setQr] = useState(null)

  const node = locationById(state.locations, id)
  const isContainer = node?.kind === 'container'

  useEffect(() => {
    setMoving(false)
    setQr(null)
    if (node?.qrCode) {
      QRCode.toDataURL(`catalog:location:${node.id}`, { width: 240, margin: 1 })
        .then(setQr)
        .catch(() => setQr(null))
    }
  }, [id, node?.qrCode])

  if (!node) {
    return (
      <div className="py-16 text-center text-sm text-ink-3">
        Location not found. <Link className="text-accent" to="/locations">All locations</Link>
      </div>
    )
  }

  const chain = locationChain(state.locations, node.id)
  const children = childrenOf(state.locations, node.id)
  const directItems = itemsAt(state.items, node.id)
  const allItems = itemsUnder(state.items, state.locations, node.id)
  const history = state.locationHistory.filter(
    (h) => h.subjectType === 'location' && h.subjectId === node.id,
  )

  const moveContainer = ({ locationId }) => {
    if (!locationId) return
    dispatch({ type: 'MOVE_LOCATION', payload: { id: node.id, newParentId: locationId } })
    setMoving(false)
  }

  const addChild = () => {
    if (!newName.trim()) return
    const childId = uid('loc')
    dispatch({
      type: 'ADD_LOCATION',
      payload: {
        id: childId,
        name: newName.trim(),
        kind: newKind,
        parentId: node.id,
        qrCode: newKind === 'container' ? `CAT-${childId.slice(-6).toUpperCase()}` : null,
      },
    })
    setNewName('')
    setAdding(false)
  }

  const removeLocation = () => {
    if (children.length || directItems.length) return
    if (!confirm(`Delete empty location "${node.name}"?`)) return
    dispatch({ type: 'DELETE_LOCATION', payload: node.id })
    navigate(node.parentId ? `/locations/${node.parentId}` : '/locations')
  }

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center gap-1 text-xs text-ink-2">
        <Link to="/locations" className="font-semibold text-accent">Locations</Link>
        {chain.slice(0, -1).map((n) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="text-ink-3">→</span>
            <Link to={`/locations/${n.id}`} className="font-semibold text-accent">{n.name}</Link>
          </span>
        ))}
      </div>

      <div className="mt-1 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{node.name}</h1>
          <div className="text-xs uppercase tracking-wide text-ink-3">
            {node.kind}{node.containerType ? ` · ${node.containerType}` : ''}
            {node.qrCode ? ` · ${node.qrCode}` : ''}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums">{allItems.length}</div>
          <div className="text-[10px] uppercase text-ink-3">items inside</div>
        </div>
      </div>

      {isContainer && (
        <Card className="mt-3">
          <div className="text-xs text-ink-2">
            Moving this container moves all {allItems.length} items inside it.
          </div>
          <button onClick={() => setMoving(!moving)} className="mt-1 text-sm font-semibold text-accent">
            {moving ? 'Cancel move' : 'Move container →'}
          </button>
          {moving && (
            <div className="mt-2">
              <LocationPicker value={{ locationId: node.parentId, tempStatus: null }} onChange={moveContainer} />
            </div>
          )}
        </Card>
      )}

      {qr && (
        <Card className="mt-3 flex items-center gap-4">
          <img src={qr} alt={`QR code for ${node.name}`} className="h-24 w-24" />
          <div className="text-xs text-ink-2">
            <div className="font-bold text-ink">{node.qrCode}</div>
            Print this label onto the container. Scanning it with a phone camera opens this
            container's contents.
          </div>
        </Card>
      )}

      {(children.length > 0 || !isContainer) && (
        <>
          <SectionTitle
            action={
              <button onClick={() => setAdding(!adding)} className="text-xs font-semibold text-accent">
                + Add inside
              </button>
            }
          >
            Inside {node.name}
          </SectionTitle>
          {adding && (
            <div className="mb-2 space-y-2 rounded-xl border border-line bg-card p-3">
              <input className={inputCls} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <select className={inputCls} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
                {LOCATION_KINDS.filter((k) => k.id !== 'house').map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
              <Button onClick={addChild} className="w-full py-2">Create</Button>
            </div>
          )}
          <div className="space-y-2">
            {children.map((child) => (
              <Link key={child.id} to={`/locations/${child.id}`}>
                <Card className="mb-2 flex items-center justify-between py-3">
                  <div>
                    <span className="text-sm font-semibold">{child.name}</span>
                    <span className="ml-2 text-[10px] uppercase text-ink-3">{child.kind}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums">
                    {itemsUnder(state.items, state.locations, child.id).length}
                  </span>
                </Card>
              </Link>
            ))}
            {children.length === 0 && !adding && (
              <div className="text-sm text-ink-3">No sub-locations.</div>
            )}
          </div>
        </>
      )}

      <SectionTitle>Items stored here ({directItems.length})</SectionTitle>
      <div className="space-y-2">
        {directItems.length === 0 ? (
          <div className="text-sm text-ink-3">No items directly at this location.</div>
        ) : (
          directItems.map((item) => <ItemCard key={item.id} item={item} />)
        )}
      </div>

      {history.length > 0 && (
        <>
          <SectionTitle>Move history</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {history.map((h) => (
              <div key={h.id} className="px-4 py-2.5 text-sm">
                <div className="font-medium">{h.path || '—'}</div>
                <div className="text-xs text-ink-3">
                  {timeAgo(h.at)} · {state.users.find((u) => u.id === h.by)?.name || 'Unknown'}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {children.length === 0 && directItems.length === 0 && (
        <div className="mt-6">
          <Button variant="danger" onClick={removeLocation} className="w-full">
            Delete empty location
          </Button>
        </div>
      )}
    </div>
  )
}
