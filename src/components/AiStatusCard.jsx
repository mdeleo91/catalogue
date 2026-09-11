import { useCallback, useEffect, useState } from 'react'
import { Card, SectionTitle } from './ui'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../lib/ai'

// Scanning runs on this deployment's own Anthropic key, so there is nothing
// for a member to configure — this card just reports whether it is switched
// on and how much of today's allowance they have used.
export default function AiStatusCard() {
  const [status, setStatus] = useState(undefined)

  const load = useCallback(async () => {
    if (!supabase) return setStatus(null)
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

  const used = status?.usedToday
  const limit = status?.dailyLimit
  const showMeter = used != null && limit != null
  const nearLimit = showMeter && used >= limit * 0.8

  return (
    <>
      <SectionTitle>AI identification</SectionTitle>
      <Card className="space-y-3">
        {status === undefined && <div className="text-xs text-ink-3">Checking…</div>}

        {status === null && (
          <div className="text-sm">
            <span className="font-semibold text-ink-2">Status unavailable</span>
            <div className="mt-0.5 text-xs text-ink-3">
              Could not reach the identification service.{' '}
              <button onClick={load} className="font-semibold text-accent">Try again</button>
            </div>
          </div>
        )}

        {status && !status.enabled && (
          <div className="text-sm">
            <span className="font-semibold text-ink-2">Scanning is off</span>
            <div className="mt-0.5 text-xs text-ink-3">
              No Anthropic key is configured for this deployment. Scan still works as guided manual
              entry with your photos attached.
            </div>
          </div>
        )}

        {status?.enabled && (
          <>
            <div className="text-sm">
              <span className="font-semibold text-good">Scanning is on</span>
              <div className="mt-0.5 text-xs text-ink-3">
                Nothing to set up — photograph an item and tap Identify.
                {status.model ? ` Using ${status.model}.` : ''}
              </div>
            </div>

            {showMeter && (
              <div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-ink-2">Your scans today</span>
                  <span
                    className={`font-semibold tabular-nums ${nearLimit ? 'text-warn' : 'text-ink-2'}`}
                  >
                    {used} / {limit}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${nearLimit ? 'bg-warn' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-ink-3">Resets at midnight UTC.</div>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-ink-3">
          Photos are sent to Anthropic only at the moment you tap Identify. Each member has their
          own daily allowance so one person cannot run up the whole bill.
        </p>
      </Card>
    </>
  )
}
