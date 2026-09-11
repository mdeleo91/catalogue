import { Button } from '../ui'

// Screen 10.
export default function SuccessStep({ title, onView, onAgain, onDone }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-4xl text-accent">
        ✓
      </div>
      <h1 className="mt-5 text-xl font-bold">Item added</h1>
      <p className="mt-1 text-sm text-ink-2">
        <span className="font-semibold text-ink">{title}</span> is in your collection.
      </p>

      <div className="mt-7 w-full space-y-2">
        <Button className="w-full" onClick={onView}>View item</Button>
        <Button variant="secondary" className="w-full" onClick={onAgain}>
          Scan another item
        </Button>
        <button onClick={onDone} className="w-full py-1.5 text-sm font-semibold text-ink-3">
          Back to collection
        </button>
      </div>
    </div>
  )
}
