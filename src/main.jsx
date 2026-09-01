import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import CollectionSetup from './pages/CollectionSetup'
import SignIn from './pages/SignIn'
import { AuthProvider, useAuth } from './lib/auth'
import { StoreProvider } from './lib/store'
import { isCloud } from './lib/supabase'
import './index.css'

function CloudGate() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-ink-3">Loading…</div>
    )
  }
  if (!auth.session) return <SignIn />
  if (!auth.membership) return <CollectionSetup />

  return (
    <StoreProvider
      cloud={{
        collectionId: auth.membership.collection_id,
        userId: auth.session.user.id,
        members: auth.members,
      }}
    >
      <HashRouter>
        <App />
      </HashRouter>
    </StoreProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isCloud ? (
      <AuthProvider>
        <CloudGate />
      </AuthProvider>
    ) : (
      <StoreProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </StoreProvider>
    )}
  </React.StrictMode>,
)
