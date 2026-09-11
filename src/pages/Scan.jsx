import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CaptureStep from '../components/scan/CaptureStep'
import ComponentsStep from '../components/scan/ComponentsStep'
import ConfirmStep from '../components/scan/ConfirmStep'
import DetailsStep from '../components/scan/DetailsStep'
import IdentifyingStep from '../components/scan/IdentifyingStep'
import LocationStep from '../components/scan/LocationStep'
import ResultStep from '../components/scan/ResultStep'
import SuccessStep from '../components/scan/SuccessStep'
import { Card } from '../components/ui'
import { aiSignedIn, identifyItem, lookupValue } from '../lib/ai'
import { DEFAULT_COMPONENTS } from '../lib/constants'
import { uid } from '../lib/id'
import { fileToDataUrls } from '../lib/image'
import { useStore } from '../lib/store'

// Capture → Identify → Result → Components → Details → Location → Confirm →
// Success. Each step owns one decision, so nothing is a wall of fields, and
// the draft is the single thing carried between them.
const ORDER = ['capture', 'identifying', 'result', 'components', 'details', 'location', 'confirm', 'success']

const emptyDraft = () => ({
  mode: 'single',
  photos: [],
  fields: {},
  confidence: {},
  summary: '',
  detected: [],
  components: [],
  condition: 'Very Good',
  completeness: 'Incomplete',
  purchasePrice: '',
  purchaseDate: '',
  acquisitionMethod: 'Unknown',
  source: '',
  estimatedValue: '',
  locationId: null,
  tempStatus: null,
})

// Merge what the model saw with the standard checklist for the item type, so
// the user confirms against a full list rather than only what was visible.
function buildComponents(type, detected = []) {
  const base = DEFAULT_COMPONENTS[type] || DEFAULT_COMPONENTS.game
  const extra = detected.filter((d) => !base.includes(d))
  return [...base, ...extra].map((name) => ({
    id: uid('comp'),
    name,
    present: detected.includes(name),
    condition: null,
  }))
}

export default function Scan() {
  const navigate = useNavigate()
  const { dispatch } = useStore()
  const [step, setStep] = useState('capture')
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [aiReady, setAiReady] = useState(true)
  const [value, setValue] = useState(null)
  const cancelled = useRef(false)

  useEffect(() => {
    aiSignedIn().then(setAiReady)
    return () => {
      cancelled.current = true
    }
  }, [])

  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), [])

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    try {
      const converted = await Promise.all(files.map((f) => fileToDataUrls(f)))
      setDraft((d) => ({
        ...d,
        photos: [...d.photos, ...converted].slice(0, 6),
      }))
    } catch {
      setError('Could not read that image — try another photo.')
    }
  }

  const identify = async () => {
    setBusy(true)
    setError(null)
    setStep('identifying')
    try {
      const { fields, confidence, summary } = await identifyItem(draft.photos.map((p) => p.full))
      if (cancelled.current) return
      const type = fields.type || 'game'
      setDraft((d) => ({
        ...d,
        fields: { ...fields, type },
        confidence,
        summary,
        detected: fields.components || [],
        components: buildComponents(type, fields.components || []),
        // A complete-looking copy starts at Complete; the components step
        // corrects it either way.
        completeness: (fields.components || []).length >= 3 ? 'Near Complete' : 'Incomplete',
      }))
      setStep('result')
    } catch (err) {
      if (!cancelled.current) setError(err.message)
    } finally {
      if (!cancelled.current) setBusy(false)
    }
  }

  // Hand everything gathered so far to the manual form rather than losing it.
  const toManualForm = () => {
    navigate('/items/new', {
      state: {
        prefill: { ...draft.fields, condition: draft.condition, completeness: draft.completeness },
        confidence: draft.confidence,
        photos: draft.photos,
      },
    })
  }

  const save = () => {
    setSaving(true)
    const num = (v) => (v === '' || v == null ? null : Number(v))
    const id = uid('item')
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id,
        type: draft.fields.type || 'game',
        title: (draft.fields.title || 'Untitled item').trim(),
        platform: draft.fields.platform || null,
        publisher: draft.fields.publisher || null,
        developer: draft.fields.developer || null,
        releaseYear: num(draft.fields.releaseYear),
        region: draft.fields.region || null,
        edition: draft.fields.edition || null,
        genre: draft.fields.genre || null,
        franchise: draft.fields.franchise || null,
        issueNumber: num(draft.fields.issueNumber),
        publicationDate: draft.fields.publicationDate || null,
        isbn: draft.fields.isbn || null,
        author: draft.fields.author || null,
        model: draft.fields.model || null,
        condition: draft.condition,
        completeness: draft.completeness,
        components: draft.components,
        photos: draft.photos,
        locationId: draft.locationId,
        tempStatus: draft.tempStatus,
        purchasePrice: num(draft.purchasePrice),
        purchaseDate: draft.purchaseDate || null,
        acquisitionMethod: draft.acquisitionMethod,
        source: draft.source || null,
        estimatedValue: num(draft.estimatedValue),
        valuation: value?.status === 'ok' ? value.data : null,
        notes: null,
        aiFields: draft.confidence,
      },
    })
    setSavedId(id)
    setSaving(false)
    setStep('success')
  }

  // Fired when the match is accepted so the answer is ready by the time the
  // user reaches the details step — the search takes a few seconds.
  const runValueLookup = useCallback(
    async (fields, components) => {
      setValue({ status: 'loading' })
      try {
        const present = components.filter((c) => c.present).map((c) => c.name)
        const data = await lookupValue({
          title: fields.title,
          platform: fields.platform,
          region: fields.region,
          edition: fields.edition,
          type: fields.type,
          completeness: present.length
            ? `includes ${present.join(', ')}`
            : 'unknown',
        })
        if (!cancelled.current) setValue({ status: 'ok', data })
      } catch (err) {
        if (!cancelled.current) setValue({ status: 'error', message: err.message, code: err.code })
      }
    },
    [],
  )

  const acceptMatch = () => {
    setStep('components')
    if (aiReady) runValueLookup(draft.fields, draft.components)
  }

  const restart = () => {
    setValue(null)
    setDraft(emptyDraft())
    setSavedId(null)
    setError(null)
    setStep('capture')
  }

  const back = () => {
    const i = ORDER.indexOf(step)
    if (i <= 0) return navigate(-1)
    // Identifying is transient; stepping back from the result returns to capture.
    setStep(ORDER[step === 'result' ? 0 : i - 1])
  }

  const content = useMemo(() => {
    switch (step) {
      case 'identifying':
        return (
          <IdentifyingStep
            photo={draft.photos[0]?.full}
            error={error}
            onRetry={identify}
            onManual={toManualForm}
          />
        )
      case 'result':
        return <ResultStep draft={draft} onBack={back} onAccept={acceptMatch} onReject={toManualForm} />
      case 'components':
        return (
          <ComponentsStep
            components={draft.components}
            detected={draft.detected}
            onToggle={(id) =>
              update({
                components: draft.components.map((c) => (c.id === id ? { ...c, present: !c.present } : c)),
              })
            }
            onBack={back}
            onNext={() => setStep('details')}
          />
        )
      case 'details':
        return (
          <DetailsStep
            draft={draft}
            onChange={update}
            onBack={back}
            onNext={() => setStep('location')}
            onSaveForLater={toManualForm}
            value={value}
            onUseValue={(amount) => update({ estimatedValue: String(amount) })}
            onRetryValue={() => runValueLookup(draft.fields, draft.components)}
          />
        )
      case 'location':
        return (
          <LocationStep
            draft={draft}
            onChange={update}
            onBack={back}
            onNext={() => setStep('confirm')}
            onSkip={() => setStep('confirm')}
          />
        )
      case 'confirm':
        return <ConfirmStep draft={draft} saving={saving} onBack={back} onSave={save} onEdit={toManualForm} />
      case 'success':
        return (
          <SuccessStep
            title={draft.fields.title || 'Your item'}
            onView={() => navigate(`/items/${savedId}`)}
            onAgain={restart}
            onDone={() => navigate('/collection')}
          />
        )
      default:
        return (
          <>
            {!aiReady && (
              <Card className="mb-3 border-warn/40 bg-warn/10 text-sm text-warn">
                Sign in to use AI identification. You can still catalog manually with your photos
                attached.
              </Card>
            )}
            {error && (
              <div className="mb-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </div>
            )}
            <CaptureStep
              photos={draft.photos}
              mode={draft.mode}
              busy={busy}
              onModeChange={(mode) => update({ mode })}
              onAddPhotos={addPhotos}
              onRemovePhoto={(i) => update({ photos: draft.photos.filter((_, j) => j !== i) })}
              onBack={() => navigate(-1)}
              onNext={aiReady ? identify : toManualForm}
            />
            {draft.photos.length > 0 && (
              <button onClick={toManualForm} className="mt-2 w-full py-1.5 text-sm font-semibold text-ink-3">
                Skip AI and enter details manually
              </button>
            )}
          </>
        )
    }
  }, [step, draft, error, busy, saving, savedId, aiReady, value])

  return <div className="pb-4">{content}</div>
}
