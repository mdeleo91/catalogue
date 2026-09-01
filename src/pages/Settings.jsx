import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Field, SectionTitle, inputCls } from '../components/ui'
import { useStore } from '../lib/store'

export default function Settings() {
  const { state, dispatch } = useStore()
  const fileInput = useRef(null)
  const [keyDraft, setKeyDraft] = useState(state.settings.anthropicApiKey || '')
  const [message, setMessage] = useState(null)

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
      if (!confirm(`Replace the current collection with "${file.name}" (${parsed.items.length} items)?`)) return
      dispatch({ type: 'IMPORT_STATE', payload: parsed })
      setMessage('Collection imported.')
    } catch {
      setMessage('That file is not a valid Catalog export.')
    }
  }

  return (
    <div className="pb-8">
      <h1 className="text-xl font-bold">Settings</h1>

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
        Adds, edits, and moves are recorded under the active user in the shared activity history.
      </p>

      <SectionTitle>AI identification</SectionTitle>
      <Card className="space-y-2">
        <Field label="Anthropic API key">
          <input
            className={inputCls}
            type="password"
            placeholder="sk-ant-…"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
        </Field>
        <Button
          className="w-full py-2"
          onClick={() => {
            dispatch({ type: 'SET_SETTINGS', payload: { anthropicApiKey: keyDraft.trim() } })
            setMessage(keyDraft.trim() ? 'API key saved on this device.' : 'API key cleared.')
          }}
        >
          Save key
        </Button>
        <p className="text-xs text-ink-3">
          Used only for the Scan feature, sent directly from this device to the Anthropic API, and
          stored only in this browser. Without a key, scanning falls back to manual entry.
        </p>
      </Card>

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
        <p className="text-xs text-ink-3">
          This MVP stores the collection in this browser. The included Supabase schema
          (supabase/schema.sql) is the path to a shared, synced backend.
        </p>
      </Card>

      {message && (
        <div className="mt-3 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-soft">{message}</div>
      )}
    </div>
  )
}
