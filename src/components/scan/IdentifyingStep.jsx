import { useEffect, useState } from 'react'

const STAGES = [
  'Detecting object…',
  'Matching against known releases…',
  'Extracting details…',
  'Finalizing results…',
]

// Screen 3. The request is a single call, so these stages are a progress
// indication rather than discrete server steps — the last one stays pending
// until the real response lands.
export default function IdentifyingStep({ photo, error, onRetry, onManual }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (error) return undefined
    const timers = [
      setTimeout(() => setStage(1), 700),
      setTimeout(() => setStage(2), 1600),
      setTimeout(() => setStage(3), 2800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center pt-6 text-center">
      <h1 className="text-xl font-bold">{error ? 'Could not identify it' : 'Identifying item…'}</h1>
      <p className="mt-1 text-sm text-ink-2">
        {error ? 'You can try again or enter the details yourself.' : 'Analyzing your photo'}
      </p>

      {photo && (
        <img
          src={photo}
          alt=""
          className="mt-5 h-44 w-36 rounded-xl border border-line object-cover"
        />
      )}

      {error ? (
        <div className="mt-6 w-full space-y-2">
          <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </div>
          <button onClick={onRetry} className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white">
            Try again
          </button>
          <button onClick={onManual} className="w-full rounded-lg border border-line py-2.5 text-sm font-semibold">
            Enter details manually
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${((stage + 1) / (STAGES.length + 1)) * 100}%` }}
            />
          </div>
          <div className="mt-5 w-full space-y-2 text-left">
            {STAGES.map((label, i) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                    i < stage
                      ? 'border-good bg-good/15 text-good'
                      : i === stage
                        ? 'border-accent text-accent'
                        : 'border-line text-transparent'
                  }`}
                >
                  {i < stage ? '✓' : '•'}
                </span>
                <span className={i <= stage ? 'text-ink' : 'text-ink-3'}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-surface p-3 text-left text-xs text-ink-2">
            <span className="font-semibold text-ink">Tip</span> — extra angles (back of the box,
            cartridge, manual) make the match more reliable.
          </div>
        </>
      )}
    </div>
  )
}
