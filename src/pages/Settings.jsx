import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Field, SectionTitle, inputCls } from '../components/ui'
import AiStatusCard from '../components/AiStatusCard'
import MarketStatusCard from '../components/MarketStatusCard'
import UpdateCard from '../components/UpdateCard'
import { useMaybeAuth } from '../lib/auth'
import { useStore } from '../lib/store'

export default function Settings() {
  const { state, dispatch } = useStore()
  const auth = useMaybeAuth()
  const fileInput = useRef(null)
  const [message, setMessage] = useState(null)
  const cloud = Boolean(state.cloud)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catalog-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed.items) || !Array.isArray(parsed.locations)) {
        throw new Error('not a Catalog export')
      }
      const warning = cloud
        ? `Replace the shared cloud collection with "${file.name}" (${parsed.items.length} items)? This overwrites what everyone sees.`
        : `Replace the current collection with "${file.name}" (${parsed.items.length} items)?`
      if (!confirm(warning)) return
      dispatch({ type: 'IMPORT_STATE', payload: parsed })
      setMessage('Collection imported.')
    } catch {
      setMessage('That file is not a valid Catalog export.')
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(auth.collection.invite_code)
      setMessage('Invite code copied — share it with your co-collector.')
    } catch {
      setMessage(`Invite code: ${auth.collection.invite_code}`)
    }
  }

  return (
    <div className="pb-8">
      <h1 className="text-xl font-bold">Settings</h1>

      {cloud && auth ? (
        <>
          <SectionTitle>Account</SectionTitle>
          <Card className="space-y-3">
            <div className="text-sm">
              <div className="font-semibold">{auth.membership?.display_name}</div>
              <div className="text-xs text-ink-3">{auth.session?.user?.email}</div>
            </div>
            <div className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-2">{auth.collection?.name || 'Collection'}</span>
                <span className="text-xs text-ink-3">
                  {state.users.length} member{state.users.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-accent-soft">
                  {auth.collection?.invite_code}
                </span>
                <button onClick={copyInvite} className="text-xs font-semibold text-accent">
                  Copy invite code
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                Anyone with this code can join and edit the shared collection — only share it with
                family.
              </p>
            </div>
            <div className="text-xs text-ink-3">
              Members: {state.users.map((u) => u.name).join(', ')}
            </div>
            <Button variant="secondary" className="w-full" onClick={() => auth.signOut()}>
              Sign out
            </Button>
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>Active user</SectionTitle>
          <Card className="flex gap-2 p-2">
            {state.users.map((u) => (
              <button
                key={u.id}
                onClick={() => dispatch({ type: 'SET_USER', payload: u.id })}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${
                  state.currentUserId === u.id ? 'bg-accent text-white' : 'text-ink-2'
                }`}
              >
                {u.name}
              </button>
            ))}
          </Card>
          <p className="mt-1 text-xs text-ink-3">
            Demo mode — the collection lives only in this browser. Deploy with Supabase configured
            to get real accounts and a shared, synced collection.
          </p>
        </>
      )}

      <UpdateCard />

      {cloud && <MarketStatusCard />}

      {cloud ? (
        <AiStatusCard />
      ) : (
        <>
          <SectionTitle>AI identification</SectionTitle>
          <Card>
            <p className="text-sm text-ink-2">
              AI identification needs a signed-in Catalog account. In demo mode, Scan falls back to
              manual entry with your photos attached.
            </p>
          </Card>
        </>
      )}

      <SectionTitle>Wishlist</SectionTitle>
      <Card>
        <Link to="/wishlist" className="text-sm font-semibold text-accent">
          Open wishlist ({state.wishlist.length}) →
        </Link>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card className="space-y-2">
        <Button variant="secondary" onClick={exportJson} className="w-full">
          Export collection (JSON)
        </Button>
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={importJson} />
        <Button variant="secondary" onClick={() => fileInput.current?.click()} className="w-full">
          Import collection (JSON)
        </Button>
        {!cloud && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm('Replace everything with the demo collection? Your current data will be lost.')) {
                dispatch({ type: 'RESET_DEMO' })
                setMessage('Demo data restored.')
              }
            }}
          >
            Reset to demo data
          </Button>
        )}
        <p className="text-xs text-ink-3">
          {cloud
            ? 'The collection is stored in Supabase and shared with all members. Export makes an on-device JSON backup; import replaces the shared collection with a backup.'
            : 'This demo stores the collection in this browser. supabase/schema.sql plus two env vars turns on the shared cloud backend.'}
        </p>
      </Card>

      {message && (
        <div className="mt-3 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-soft">{message}</div>
      )}
    </div>
  )
}
