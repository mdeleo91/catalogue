import { useEffect, useRef } from 'react'
import { applyMarket, isStale } from './market'
import { readMarket } from './marketApi'

// Keeps the collection's prices current without a server job: when a
// signed-in member opens the app, items whose guide figure is more than a
// day old are re-read in the background, a few at a time, and the results
// sync to the shared collection like any other change. If nobody opens the
// app, nothing refreshes — and nobody is looking.
const RUN_GAP_MS = 6 * 60 * 60 * 1000 // at most one sweep per device per six hours
const PER_RUN = 150
const SPACING_MS = 250
const KEY = 'catalog:market:lastSweep'

export function useMarketRefresh(state, dispatch) {
  const running = useRef(false)

  useEffect(() => {
    if (!state.cloud || running.current) return
    let last = 0
    try {
      last = Number(localStorage.getItem(KEY) || 0)
    } catch {
      /* storage unavailable: sweep anyway */
    }
    if (Date.now() - last < RUN_GAP_MS) return

    const stale = state.items.filter((i) => i.market?.productId && isStale(i.market)).slice(0, PER_RUN)
    if (!stale.length) return

    running.current = true
    let stopped = false
    ;(async () => {
      const patches = {}
      for (const item of stale) {
        if (stopped) break
        try {
          const { product } = await readMarket(item.market.productId)
          if (product) patches[item.id] = applyMarket(item, product)
        } catch (err) {
          if (err.code === 'not_configured' || err.code === 'signed_out') break
        }
        await new Promise((r) => setTimeout(r, SPACING_MS))
      }
      if (!stopped && Object.keys(patches).length) dispatch({ type: 'REFRESH_MARKET', payload: patches })
      try {
        localStorage.setItem(KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      running.current = false
    })()
    return () => {
      stopped = true
    }
    // Deliberately only on mount / cloud flip: the sweep is a session event,
    // not something to re-run on every item edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cloud])
}
