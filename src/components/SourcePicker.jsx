import { useState } from 'react'
import { SOURCES } from '../lib/constants'
import { canonicalSource, knownSources } from '../lib/sources'
import { inputCls } from './ui'

export { canonicalSource, knownSources }

export default function SourcePicker({ value, onChange, known = SOURCES }) {
  const [adding, setAdding] = useState(false)
  const [typed, setTyped] = useState('')
  const options = value && !known.includes(value) ? [...known, value] : known

  const commit = () => {
    const chosen = canonicalSource(typed, options)
    if (chosen) onChange(chosen)
    setTyped('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          className={inputCls}
          placeholder="New source"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setAdding(false)
          }}
        />
        <button onClick={commit} className="shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
          Add
        </button>
      </div>
    )
  }

  return (
    <select
      className={inputCls}
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === '__add') setAdding(true)
        else onChange(e.target.value)
      }}
    >
      <option value="">—</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value="__add">+ Add a new source…</option>
    </select>
  )
}
