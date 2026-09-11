import { useState } from 'react'
import { Button, Field, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function CollectionSetup() {
  const { createCollection, joinCollection, signOut, session } = useAuth()
  const [mode, setMode] = useState('create')
  const [displayName, setDisplayName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'create') await createCollection(collectionName, displayName)
      else await joinCollection(code, displayName)
    } catch (err) {
      setError(
        /invalid invite code/i.test(err.message)
          ? 'That invite code doesn’t match a collection. Double-check it with the person who created it.'
          : err.message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pad-safe-x pad-safe-top pad-safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <div className="text-center">
        <div className="font-display text-2xl font-bold uppercase tracking-widest">
          Catalog<span className="text-accent">.</span>
        </div>
        <div className="mt-1 text-sm text-ink-2">Signed in as {session?.user?.email}</div>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-3 rounded-xl border border-line bg-card p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-center text-xs font-semibold">
          {[
            ['create', 'Start a collection'],
            ['join', 'Join with a code'],
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

        <Field label="Your name (shown in activity history)">
          <input
            className={inputCls}
            required
            placeholder="Michael"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>

        {mode === 'create' ? (
          <Field label="Collection name">
            <input
              className={inputCls}
              placeholder="Our Collection"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Invite code">
            <input
              className={inputCls}
              required
              placeholder="e.g. 4f9a2c1b"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
        )}

        {error && <div className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'One moment…' : mode === 'create' ? 'Create collection' : 'Join collection'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-3">
        {mode === 'create'
          ? 'You’ll get an invite code to share so a family member can join the same collection.'
          : 'Ask the person who created the collection for the invite code shown in their Settings.'}
      </p>

      <button onClick={signOut} className="mt-6 text-center text-xs font-semibold text-ink-3 underline">
        Sign out
      </button>
    </div>
  )
}
