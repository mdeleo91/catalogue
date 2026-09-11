import { useCallback, useEffect, useState } from 'react'
import { Button, Card, SectionTitle } from '../components/ui'
import {
  APP_VERSION, APK_LATEST_URL, RELEASES_URL,
  fetchLatestRelease, isNativeApp, isNewer,
} from '../lib/updates'

// On the website this is a "get the Android app" card; inside the installed
// APK it becomes an update check against the latest published release.
export default function UpdateCard() {
  const [state, setState] = useState({ status: 'loading' })

  const check = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const release = await fetchLatestRelease()
      setState(release ? { status: 'ok', release } : { status: 'none' })
    } catch (err) {
      setState({ status: 'error', message: err.message })
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  const release = state.release
  const updateAvailable = isNativeApp && release && isNewer(release.version, APP_VERSION)

  return (
    <>
      <SectionTitle>{isNativeApp ? 'App version' : 'Android app'}</SectionTitle>
      <Card className={updateAvailable ? 'space-y-3 border-accent/50' : 'space-y-3'}>
        {isNativeApp ? (
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-2">Installed version</span>
            <span className="font-mono font-semibold">{APP_VERSION || 'dev build'}</span>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            Install Catalog as a real Android app — same collection, its own icon, opens
            straight to your shelves.
          </p>
        )}

        {state.status === 'loading' && (
          <div className="text-xs text-ink-3">Checking for the latest build…</div>
        )}

        {state.status === 'error' && (
          <div className="space-y-2">
            <div className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">{state.message}</div>
            <Button variant="secondary" className="w-full py-2" onClick={check}>
              Try again
            </Button>
          </div>
        )}

        {state.status === 'none' && (
          <div className="text-xs text-ink-3">
            No build has been published yet. Run the <strong>Build Android APK</strong> workflow
            in GitHub Actions, and it will appear here.
          </div>
        )}

        {state.status === 'ok' && (
          <>
            {isNativeApp ? (
              updateAvailable ? (
                <>
                  <div className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-soft">
                    Version <strong>{release.version}</strong> is available.
                  </div>
                  <a href={release.apkUrl} target="_blank" rel="noreferrer" className="block">
                    <Button className="w-full">
                      Download update{release.sizeMb ? ` (${release.sizeMb} MB)` : ''}
                    </Button>
                  </a>
                  <p className="text-xs text-ink-3">
                    This opens your browser to download the APK. Tap the downloaded file to
                    install it over this version — your collection is untouched.
                  </p>
                </>
              ) : (
                <div className="text-xs text-good">
                  You’re on the latest version
                  {release.publishedAt
                    ? ` (published ${new Date(release.publishedAt).toLocaleDateString()})`
                    : ''}
                  .
                </div>
              )
            ) : (
              <>
                <a href={release.apkUrl || APK_LATEST_URL} className="block">
                  <Button className="w-full">
                    Download APK — {release.version}
                    {release.sizeMb ? ` (${release.sizeMb} MB)` : ''}
                  </Button>
                </a>
                <p className="text-xs text-ink-3">
                  Open this page on your Android phone to download it there. Tap the file to
                  install; Android will ask you to allow installing apps from outside the Play
                  Store, which is expected for a personal app.
                </p>
              </>
            )}

            <div className="flex items-center justify-between text-xs">
              <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-accent">
                All releases →
              </a>
              <button onClick={check} className="text-ink-3">
                Check again
              </button>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
