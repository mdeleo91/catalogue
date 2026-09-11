import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Field, SectionTitle, inputCls } from './ui'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../lib/ai'

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude (Anthropic)', keyHint: 'sk-ant-…', console: 'console.anthropic.com' },
  { id: 'openai', label: 'GPT (OpenAI)', keyHint: 'sk-proj-…', console: 'platform.openai.com/api-keys' },
]

// Each member supplies their own provider key, so scanning is billed to
// whoever does it rather than to whoever deployed the app.
export default function AiKeyCard() {
  const [saved, setSaved] = useState(undefined) // undefined = loading, null = none
  const [status, setStatus] = useState(null) // which credential a scan would use
  const [provider, setProvider] = useState('anthropic')
  const [keyDraft, setKeyDraft] = useState('')
  const [modelDraft, setModelDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) return
    // Deliberately never selects api_key — the secret stays server-side.
    const { data } = await supabase
      .from('user_ai_keys')
      .select('provider, model, key_hint, updated_at')
      .limit(1)
      .maybeSingle()
    setSaved(data || null)
    if (data?.provider) setProvider(data.provider)

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${API_BASE}/api/ai-status`, {
        headers: { authorization: `Bearer ${token}` },
      })
      setStatus(res.ok ? await res.json() : null)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    const key = keyDraft.trim()
    if (!key) return
    setBusy(true)
    setMessage(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('user_ai_keys').upsert({
        user_id: userData.user.id,
        provider,
        api_key: key,
        model: modelDraft.trim() || null,
        key_hint: key.slice(-4),
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      setKeyDraft('')
      setModelDraft('')
      setMessage({ tone: 'ok', text: 'Key saved. Your scans are now billed to your own account.' })
      await load()
    } catch (err) {
      setMessage({
        tone: 'error',
        text: /relation .*user_ai_keys.* does not exist/i.test(err.message || '')
          ? 'The user_ai_keys table is missing — run supabase/add-user-ai-keys.sql in the Supabase SQL editor.'
          : err.message || 'Could not save the key.',
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Remove your saved API key? Scanning will stop working unless a shared key is configured.')) return
    setBusy(true)
    setMessage(null)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('user_ai_keys').delete().eq('user_id', userData.user.id)
      if (error) throw error
      setMessage({ tone: 'ok', text: 'Key removed.' })
      await load()
    } catch (err) {
      setMessage({ tone: 'error', text: err.message || 'Could not remove the key.' })
    } finally {
      setBusy(false)
    }
  }

  const chosen = PROVIDERS.find((p) => p.id === provider)

  return (
    <>
      <SectionTitle>AI identification</SectionTitle>
      <Card className="space-y-3">
        {saved === undefined ? (
          <div className="text-xs text-ink-3">Checking…</div>
        ) : (
          <StatusLine saved={saved} status={status} />
        )}

        <div className="space-y-3 rounded-lg bg-surface p-3">
          <div className="text-xs font-semibold text-ink-2">
            {saved ? 'Replace your key' : 'Use your own key'}
          </div>
          <Field label="Provider">
            <select className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="API key">
            <input
              className={inputCls}
              type="password"
              autoComplete="off"
              placeholder={chosen.keyHint}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
            />
          </Field>
          <Field label="Model (optional)">
            <input
              className={inputCls}
              placeholder="leave blank for the default"
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
            />
          </Field>
          <Button className="w-full py-2" onClick={save} disabled={busy || !keyDraft.trim()}>
            {busy ? 'Saving…' : 'Save key'}
          </Button>
          <p className="text-xs text-ink-3">
            Get one at {chosen.console}. Your key is stored against your account and used only for
            your own scans — other members cannot see or spend it.
          </p>
        </div>

        {saved && (
          <Button variant="danger" className="w-full py-2" onClick={remove} disabled={busy}>
            Remove my key
          </Button>
        )}

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              message.tone === 'error' ? 'bg-bad/10 text-bad' : 'bg-good/15 text-good'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="text-xs text-ink-3">
          Photos are sent to your chosen provider only at the moment you tap Identify. Keys live in
          this app&rsquo;s database, so whoever administers the Supabase project could technically
          read them — use a key scoped to this app, and revoke it there if you ever stop using
          Catalog.
        </p>
      </Card>
    </>
  )
}

function StatusLine({ saved, status }) {
  if (saved) {
    const label = PROVIDERS.find((p) => p.id === saved.provider)?.label || saved.provider
    return (
      <div className="text-sm">
        <span className="font-semibold text-good">Using your own key</span>
        <div className="mt-0.5 text-xs text-ink-3">
          {label}
          {saved.key_hint ? ` · ending ${saved.key_hint}` : ''}
          {saved.model ? ` · ${saved.model}` : ''}
        </div>
      </div>
    )
  }
  if (status?.source === 'app') {
    return (
      <div className="text-sm">
        <span className="font-semibold text-warn">Using the shared key</span>
        <div className="mt-0.5 text-xs text-ink-3">
          Your scans are billed to whoever deployed this app. Add your own key below to pay for
          your own.
        </div>
      </div>
    )
  }
  return (
    <div className="text-sm">
      <span className="font-semibold text-ink-2">Scanning is off</span>
      <div className="mt-0.5 text-xs text-ink-3">
        Add a provider key below to turn on AI identification. Without one, Scan still works as
        guided manual entry.
      </div>
    </div>
  )
}
