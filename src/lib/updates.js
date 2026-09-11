import { Capacitor } from '@capacitor/core'

// Where builds are published. Every CI build cuts a GitHub Release tagged
// v<version> with the APK attached under a stable asset name, so both the
// "latest" download link and the update check are plain public URLs.
export const REPO = import.meta.env.VITE_UPDATE_REPO || 'mdeleo91/catalogue'

// Stamped in at build time by the workflow; absent for local dev builds.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || null

export const isNativeApp = Capacitor.isNativePlatform()

export const APK_LATEST_URL = `https://github.com/${REPO}/releases/latest/download/catalog.apk`
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`

// Versions are 1.0.<build>, so the trailing number orders them.
function buildNumber(version) {
  if (!version) return null
  const parts = String(version).replace(/^v/, '').split('.')
  const n = Number(parts[parts.length - 1])
  return Number.isFinite(n) ? n : null
}

export function isNewer(latest, current) {
  const a = buildNumber(latest)
  const b = buildNumber(current)
  if (a == null || b == null) return false
  return a > b
}

// Returns null when no release has been published yet; throws on network or
// API failure so the caller can show a retry.
export async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (res.status === 404) return null
  if (res.status === 403) throw new Error('GitHub rate-limited the update check — try again in a few minutes.')
  if (!res.ok) throw new Error(`Update check failed (HTTP ${res.status}).`)

  const data = await res.json()
  const apk = (data.assets || []).find((a) => a.name?.toLowerCase().endsWith('.apk'))
  return {
    version: (data.tag_name || '').replace(/^v/, ''),
    apkUrl: apk?.browser_download_url || APK_LATEST_URL,
    sizeMb: apk?.size ? Math.round((apk.size / 1024 / 1024) * 10) / 10 : null,
    publishedAt: data.published_at || null,
    notes: data.body || '',
  }
}
