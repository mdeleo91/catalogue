import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Collection from './pages/Collection'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Scan from './pages/Scan'
import Locations from './pages/Locations'
import LocationDetail from './pages/LocationDetail'
import Analytics from './pages/Analytics'
import Wishlist from './pages/Wishlist'
import Settings from './pages/Settings'
import { useCurrentUser, useStore } from './lib/store'
import { useMarketRefresh } from './lib/useMarketRefresh'

const tabs = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/collection', label: 'Collection', icon: '▤' },
  { to: '/scan', label: 'Scan', icon: '◉', primary: true },
  { to: '/locations', label: 'Locations', icon: '⌖' },
  { to: '/analytics', label: 'Analytics', icon: '◫' },
]

export default function App() {
  const user = useCurrentUser()
  const { state, dispatch, syncError } = useStore()
  // Live prices: re-read stale guide figures in the background on open.
  useMarketRefresh(state, dispatch)
  const { pathname } = useLocation()

  return (
    <div className="pad-safe-x mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="pad-safe-top sticky top-0 z-20 flex items-center justify-between border-b border-line bg-card/95 px-4 pb-3 backdrop-blur">
        <NavLink to="/" className="font-display text-base font-bold uppercase tracking-widest">
          Catalog<span className="text-accent">.</span>
        </NavLink>
        <NavLink
          to="/settings"
          className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm text-ink-2"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
            {user.name[0]}
          </span>
          {user.name}
        </NavLink>
      </header>

      {syncError && (
        <div className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-xs text-warn">
          {syncError}
        </div>
      )}

      <main className="pad-safe-main-bottom flex-1 px-4 pt-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/items/new" element={<ItemForm />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/items/:id/edit" element={<ItemForm />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/locations/:id" element={<LocationDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <nav className="pad-safe-bottom pad-safe-x fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((tab) => {
            const active = tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  tab.primary
                    ? 'text-accent'
                    : active
                      ? 'font-semibold text-ink'
                      : 'text-ink-3'
                }`}
              >
                <span
                  className={
                    tab.primary
                      ? '-mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-xl text-white shadow-lg'
                      : 'text-lg leading-5'
                  }
                >
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
