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
import { knownSources } from '../components/SourcePicker'
import { Card } from '../components/ui'
import { aiSignedIn, identifyItem, lookupValue } from '../lib/ai'
import { matchMarket } from '../lib/marketApi'
import {
  addComponent, buildComponents, finalizeComponents, inferCompleteness, mergeListingContents,
  toggleOmitted, validGrade,
} from '../lib/components'
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
  manifestKnown: false,
  components: [],
  condition: 'Very Good',
  conditionSuggested: null,
  conditionNotes: [],
  completeness: 'Incomplete',
  purchasePrice: '',
  purchaseDate: '',
  acquisitionMethod: 'Unknown',
  source: '',
  estimatedValue: '',
  market: null,
  marketCandidates: [],
  locationId: null,
  tempStatus: null,
})

const pickHistory = (p) => ({ loose: p?.loose ?? null, cib: p?.cib ?? null, new: p?.new ?? null })

export default function Scan() {
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
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
    // Reset on mount, not just set on unmount: React invokes effects twice in
    // development, and a flag that is only ever set to true stays true after
    // the first cleanup — silently discarding every result that arrives after.
    cancelled.current = false
    aiSignedIn().then((ok) => {
      if (!cancelled.current) setAiReady(ok)
    })
    return () => {
      cancelled.current = true
    }
  }, [])

  const update = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), [])
  // Completeness is never asked; it follows the parts. Every change to the
  // checklist goes through here so the two cannot drift apart.
  const setComponents = useCallback(
    (fn) =>
      setDraft((d) => {
        const components = fn(d.components)
        if (components === d.components) return d
        return { ...d, components, completeness: inferCompleteness(components, d.fields.type) }
      }),
    [],
  )

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
      const graded = fields.condition || {}
      const components = buildComponents(type, fields.components || [], fields.manifest, graded.parts)
      // The photos grade the copy as well as identify it; the details step
      // starts from that grade and says why, and the user can disagree.
      const suggested = validGrade(graded.overall)
      setDraft((d) => ({
        ...d,
        fields: { ...fields, type },
        confidence,
        summary,
        detected: fields.components || [],
        manifestKnown: components.some((c) => c.source === 'release'),
        components,
        completeness: inferCompleteness(components, type),
        condition: suggested || d.condition,
        conditionSuggested: suggested,
        conditionNotes: Array.isArray(graded.notes) ? graded.notes.filter((n) => typeof n === 'string').slice(0, 4) : [],
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
        upc: draft.fields.upc || null,
        author: draft.fields.author || null,
        model: draft.fields.model || null,
        condition: draft.condition,
        completeness: draft.completeness,
        components: finalizeComponents(draft.components),
        photos: draft.photos,
        locationId: draft.locationId,
        tempStatus: draft.tempStatus,
        purchasePrice: num(draft.purchasePrice),
        purchaseDate: draft.purchaseDate || null,
        acquisitionMethod: draft.acquisitionMethod,
        source: draft.source || null,
        estimatedValue: num(draft.estimatedValue),
        valueSource: draft.market ? 'market' : value?.status === 'ok' ? 'search' : draft.estimatedValue ? 'manual' : null,
        market: draft.market
          ? { ...draft.market, history: [{ at: draft.market.fetchedAt, ...pickHistory(draft.market.prices) }] }
          : null,
        valuation: !draft.market && value?.status === 'ok' ? value.data : null,
        notes: null,
        aiFields: draft.confidence,
      },
    })
    setSavedId(id)
    setSaving(false)
    setStep('success')
  }

  // Fired when the match is accepted so the answer is ready by the time the
  // user reaches the details step — the search takes a few seconds. It returns
  // ranges per completeness rather than one figure, so the condition and
  // completeness chosen later reprice it without searching again.
  const runValueLookup = useCallback(
    async (fields, components) => {
      setValue({ status: 'loading' })
      try {
        const data = await lookupValue({
          title: fields.title,
          platform: fields.platform,
          region: fields.region,
          edition: fields.edition,
          type: fields.type,
          present: components.filter((c) => c.present).map((c) => c.name),
        })
        if (cancelled.current) return
        setValue({ status: 'ok', data })
        // Listings describe what a complete copy includes; anything the
        // checklist is missing is added, never removed.
        if (data.contents?.length) setComponents((c) => mergeListingContents(c, data.contents))
      } catch (err) {
        if (!cancelled.current) setValue({ status: 'error', message: err.message, code: err.code })
      }
    },
    [],
  )

  // The price guide first: a stable product id that refreshes cheaply for
  // the life of the item. The AI search only runs for releases the guide
  // does not have, so most scans never pay for a web search.
  const acceptMatch = async () => {
    setStep('components')
    if (!aiReady) return
    setValue({ status: 'loading' })
    try {
      const f = draft.fields
      const found = await matchMarket({ upc: f.upc, title: f.title, platform: f.platform, region: f.region })
      if (cancelled.current) return
      if (found?.product) {
        setDraft((d) => ({
          ...d,
          market: { ...found.product, fetchedAt: found.fetchedAt, matchedBy: found.matchedBy },
          marketCandidates: found.candidates || [],
        }))
        setValue({ status: 'ok', data: null })
        return
      }
    } catch (err) {
      // Not configured, or the guide is down: fall through to the search.
      if (cancelled.current) return
      if (err.code !== 'not_configured') console.warn('market match failed', err.message)
    }
    runValueLookup(draft.fields, draft.components)
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
        return (
          <ResultStep draft={draft} onChange={update} onBack={back} onAccept={acceptMatch} onReject={toManualForm} />
        )
      case 'components':
        return (
          <ComponentsStep
            title={draft.fields.title}
            components={draft.components}
            detected={draft.detected}
            manifestKnown={draft.manifestKnown}
            listingsPending={value?.status === 'loading'}
            completeness={draft.completeness}
            onToggle={(id) =>
              setComponents((list) => list.map((c) => (c.id === id ? { ...c, present: !c.present } : c)))
            }
            onOmit={(id) => setComponents((list) => toggleOmitted(list, id))}
            onAdd={(name) => setComponents((list) => addComponent(list, name))}
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
            knownSources={knownSources(state.items)}
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
        return (
          <ConfirmStep
            draft={draft}
            onChange={update}
            value={value}
            onPickCandidate={(c) =>
              update({ market: { ...c, fetchedAt: draft.market?.fetchedAt, matchedBy: 'user' } })
            }
            onRetryValue={() => runValueLookup(draft.fields, draft.components)}
            saving={saving}
            onBack={back}
            onSave={save}
            onEdit={toManualForm}
          />
        )
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
  }, [step, draft, error, busy, saving, savedId, aiReady, value, state.items])

  return <div className="pb-4">{content}</div>
}
