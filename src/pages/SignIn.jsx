import { useState } from 'react'
import { Button, Field, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function SignIn() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email.trim(), password)
        if (error) throw error
        if (!data.session) {
          setMessage({
            tone: 'info',
            text:
              'Account created, but this project still requires email confirmation — ' +
              'check your inbox (and spam) for the link. If nothing arrives, turn off ' +
              '“Confirm email” in Supabase → Authentication → Sign In / Providers → Email.',
          })
          setMode('signin')
        }
      }
    } catch (err) {
      console.error('Supabase auth error', err)
      setMessage({
        tone: 'error',
        text: friendlyAuthError(err),
        detail: [err?.code, err?.status].filter(Boolean).join(' · ') || err?.message,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 pb-16">
      <div className="text-center">
        <div className="font-display text-2xl font-bold uppercase tracking-widest">
          Catalog<span className="text-accent">.</span>
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide text-ink-3">
          Know what you have. Know where it is.
        </div>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-3 rounded-xl border border-line bg-card p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-center text-xs font-semibold">
          {[
            ['signin', 'Sign in'],
            ['signup', 'Create account'],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md py-1.5 ${mode === m ? 'bg-card shadow-sm' : 'text-ink-3'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label="Email">
          <input
            className={inputCls}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className={inputCls}
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              message.tone === 'error' ? 'bg-bad/10 text-bad' : 'bg-accent/15 text-accent-soft'
            }`}
          >
            {message.text}
            {message.detail && (
              <div className="mt-1 font-mono text-[10px] opacity-70">{message.detail}</div>
            )}
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-3">
        One shared collection, multiple collectors. Create an account, then start a collection or
        join with your family member's invite code.
      </p>
    </div>
  )
}

// Supabase's raw auth errors are terse, and two of them are actively
// misleading during first-time setup: the email-send limit and the request
// limit both read as "rate limit" but have completely different causes.
function friendlyAuthError(err) {
  const code = err?.code || ''
  const msg = err?.message || ''
  const is = (c, re) => code === c || re.test(msg)

  // Only reachable when Supabase is still trying to SEND a confirmation email,
  // so it is really a "confirmation is still switched on" error.
  if (is('over_email_send_rate_limit', /email rate limit|email send rate/i)) {
    return (
      'Supabase hit its confirmation-email sending limit, which means “Confirm email” is ' +
      'still switched on. Turn it off in Supabase → Authentication → Sign In / Providers → ' +
      'Email and press Save, then sign up again — with it off no email is sent and the ' +
      'limit stops applying. (That cap resets hourly, not per minute.)'
    )
  }
  if (is('over_request_rate_limit', /request rate limit/i)) {
    return 'Too many attempts in a short window — wait a minute, then try again.'
  }
  if (/only request this after (\d+) seconds?/i.test(msg)) {
    const secs = msg.match(/only request this after (\d+) seconds?/i)[1]
    return `Supabase is throttling repeat attempts — try again in ${secs} seconds.`
  }
  if (is('email_not_confirmed', /email not confirmed/i)) {
    return (
      'This account was created while email confirmation was still required, and it was ' +
      'never confirmed. Turn off “Confirm email” in Supabase → Authentication → Sign In / ' +
      'Providers → Email, then delete this user under Authentication → Users and sign up again.'
    )
  }
  if (is('user_already_exists', /already registered|already exists/i)) {
    return 'An account with this email already exists — switch to Sign in.'
  }
  if (is('invalid_credentials', /invalid login credentials/i)) {
    return 'That email and password don’t match an account. Check them, or create an account.'
  }
  if (is('weak_password', /password.*(short|weak|least)/i)) {
    return 'Pick a longer password — at least 6 characters.'
  }
  if (is('signup_disabled', /signups? not allowed|signup is disabled/i)) {
    return 'Sign-ups are disabled for this Supabase project — enable them under Authentication → Sign In / Providers.'
  }
  return msg || 'Something went wrong. Try again.'
}
