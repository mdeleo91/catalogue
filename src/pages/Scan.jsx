import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card } from '../components/ui'
import { identifyItem, hasApiKey } from '../lib/ai'
import { fileToDataUrls } from '../lib/image'
import { useStore } from '../lib/store'

export default function Scan() {
  const { state } = useStore()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const [photos, setPhotos] = useState([]) // [{thumb, full}]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const aiReady = hasApiKey(state.settings)

  const addPhotos = async (e) => {
    setError(null)
    const files = [...(e.target.files || [])]
    e.target.value = ''
    try {
      const converted = await Promise.all(files.map((f) => fileToDataUrls(f)))
      setPhotos((p) => [...p, ...converted])
    } catch {
      setError('Could not read that image — try another photo.')
    }
  }

  const identify = async () => {
    setBusy(true)
    setError(null)
    try {
      const { fields, confidence, summary } = await identifyItem(
        photos.map((p) => p.full),
        state.settings.anthropicApiKey,
      )
      navigate('/items/new', { state: { prefill: fields, confidence, summary, photos } })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const manual = () => navigate('/items/new', { state: { photos } })

  return (
    <div>
      <h1 className="text-xl font-bold">Scan</h1>
      <p className="mt-1 text-sm text-ink-2">
        Photograph an item — the front of a box, a cartridge, a magazine cover. Add more angles of
        the <em>same physical item</em> for a better identification.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={addPhotos}
      />

      <button
        onClick={() => fileInput.current?.click()}
        className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/10 py-10 text-accent-soft active:bg-accent/15"
      >
        <span className="text-4xl">◉</span>
        <span className="text-sm font-bold">{photos.length ? 'Add another photo' : 'Take a photo'}</span>
        <span className="text-xs text-ink-3">or choose from your library</span>
      </button>

      {photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <div key={i} className="relative shrink-0">
              <img src={p.full} alt={`Photo ${i + 1}`} className="h-24 w-24 rounded-lg border border-line object-cover" />
              <button
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-[10px] text-ink"
                aria-label={`Remove photo ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-4 space-y-2">
          {aiReady ? (
            <Button onClick={identify} disabled={busy} className="w-full">
              {busy ? 'Identifying…' : `✦ Identify with AI (${photos.length} photo${photos.length > 1 ? 's' : ''})`}
            </Button>
          ) : (
            <Card className="border-warn/40 bg-warn/10 text-sm text-warn">
              AI identification needs an Anthropic API key —{' '}
              <Link to="/settings" className="font-semibold underline">add one in Settings</Link>. You
              can still catalog manually with your photos attached.
            </Card>
          )}
          <Button variant="secondary" onClick={manual} className="w-full">
            Enter details manually
          </Button>
        </div>
      )}

      <div className="mt-8 rounded-xl bg-surface p-4 text-xs leading-relaxed text-ink-2">
        <div className="font-semibold text-ink">How scanning works</div>
        1. Photograph → 2. AI identifies the release and pre-fills metadata with per-field
        confidence → 3. You confirm anything uncertain → 4. Add condition, completeness, and
        physical location → 5. Saved to the shared collection.
      </div>
    </div>
  )
}
