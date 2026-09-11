import { useRef } from 'react'
import { StepFooter, StepHeader } from './ScanChrome'

// Screens 2 and 7 of the flow. Tapping the shutter opens the device camera —
// the system viewfinder rather than an in-app one, which is what the WebView
// gives us reliably on both Android and iOS.
export default function CaptureStep({
  photos, mode, onModeChange, onAddPhotos, onRemovePhoto, onNext, onBack, busy,
}) {
  const cameraInput = useRef(null)
  const libraryInput = useRef(null)
  const hasPhotos = photos.length > 0
  const multi = mode === 'multi'

  return (
    <div className="flex min-h-[70vh] flex-col">
      <StepHeader
        onBack={onBack}
        title={hasPhotos && multi ? 'Add more photos' : 'Scan an item'}
        subtitle={
          multi
            ? 'Capture the box, cartridge, manual and inserts — they will be linked to one copy.'
            : 'One clear photo of the front is usually enough.'
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-center text-xs font-semibold">
        {[
          ['single', 'Single'],
          ['multi', 'Multi'],
        ].map(([m, label]) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded-md py-1.5 ${mode === m ? 'bg-card shadow-sm' : 'text-ink-3'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple={multi} hidden onChange={onAddPhotos} />
      <input ref={libraryInput} type="file" accept="image/*" multiple hidden onChange={onAddPhotos} />

      {hasPhotos ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img
                src={p.full}
                alt={p.label || `Photo ${i + 1}`}
                className={`aspect-square w-full rounded-lg border object-cover ${
                  i === 0 ? 'border-accent' : 'border-line'
                }`}
              />
              <button
                onClick={() => onRemovePhoto(i)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-[10px]"
                aria-label={`Remove photo ${i + 1}`}
              >
                ✕
              </button>
              <div className="mt-1 truncate text-center text-[10px] text-ink-3">
                {p.label || (i === 0 ? 'Main photo' : `Photo ${i + 1}`)}
              </div>
            </div>
          ))}
          {multi && (
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-accent/50 text-accent"
            >
              <span className="text-2xl">+</span>
              <span className="text-[10px] font-semibold">Add photo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 px-4 py-10 text-center">
          <div className="mx-auto mb-3 h-28 w-20 rounded-lg border-2 border-accent/40" aria-hidden />
          <p className="text-xs text-ink-3">Position the item in the frame</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-8">
        <button
          onClick={() => libraryInput.current?.click()}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-lg text-ink-2"
          aria-label="Choose from library"
        >
          ▤
        </button>
        <button
          onClick={() => cameraInput.current?.click()}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-accent bg-accent/20 active:bg-accent/40"
          aria-label="Take a photo"
        >
          <span className="h-12 w-12 rounded-full bg-accent" />
        </button>
        <span className="h-11 w-11" />
      </div>

      {hasPhotos && (
        <StepFooter
          primary={busy ? 'Identifying…' : `Identify ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
          onPrimary={onNext}
          primaryDisabled={busy}
        />
      )}
    </div>
  )
}
