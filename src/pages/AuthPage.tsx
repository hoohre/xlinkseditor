import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FacebookAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type AuthProvider,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { Brand } from '../components/Brand'
import { firebaseAuth, firebaseConfigured } from '../lib/firebase'
import { ApiClientError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import {
  clearPendingSocial,
  emailAuthenticate,
  linkPendingSocial,
  readPendingSocial,
  savePendingSocial,
} from '../auth/session'

type Mode = 'login' | 'register'

const providerLabel = (methods: string[]): string => {
  if (methods.includes('google.com')) return 'Google'
  if (methods.includes('facebook.com')) return 'Facebook'
  if (methods.includes('password')) return 'Email'
  return '原来的登录方式'
}

export function AuthPage() {
  const navigate = useNavigate()
  const { finishAuthentication } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const title = useMemo(() => (mode === 'login' ? 'Welcome back' : 'Create your account'), [mode])

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setMessage(null)
    setPassword('')
    setConfirmPassword('')
  }

  const findMethods = async (address: string): Promise<string[]> => {
    if (!firebaseAuth || !address) return []
    try {
      return await fetchSignInMethodsForEmail(firebaseAuth, address)
    } catch {
      return []
    }
  }

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    if (!email.trim() || !password) {
      setMessage({ tone: 'error', text: '请输入邮箱和密码。' })
      return
    }
    if (mode === 'register' && password.length < 8) {
      setMessage({ tone: 'error', text: '密码至少需要 8 个字符。' })
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setMessage({ tone: 'error', text: '两次输入的密码不一致。' })
      return
    }
    setBusy('email')
    try {
      let result = await emailAuthenticate(mode, email, password)
      const pending = mode === 'login' ? readPendingSocial() : null
      if (pending && pending.email.toLowerCase() === email.trim().toLowerCase()) {
        try { result = await linkPendingSocial(result.idToken, pending) }
        finally { clearPendingSocial() }
      }
      await finishAuthentication({
        idToken: result.idToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        email: result.email ?? email,
        provider: 'password',
        tokenType: 'allonelink',
      })
      navigate('/pages', { replace: true })
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === 'google_login_required' || error.code === 'facebook_login_required') {
          const provider = error.code === 'google_login_required' ? 'Google' : 'Facebook'
          setMessage({ tone: 'info', text: `这个邮箱使用 ${provider} 登录，请选择对应按钮。` })
        } else if (mode === 'register' && error.code === 'email_exists') {
          setMode('login')
          setMessage({ tone: 'info', text: '这个邮箱已经注册，请使用原来的方式登录。' })
        } else {
          setMessage({ tone: 'error', text: error.message })
        }
      } else {
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : '认证失败，请稍后再试。' })
      }
    } finally {
      setBusy(null)
    }
  }

  const socialLogin = async (name: 'google.com' | 'facebook.com') => {
    setMessage(null)
    if (!firebaseAuth) {
      setMessage({ tone: 'error', text: 'Firebase 尚未配置，请先填写编辑器环境变量。' })
      return
    }
    setBusy(name)
    const provider: AuthProvider = name === 'google.com'
      ? new GoogleAuthProvider()
      : new FacebookAuthProvider()
    if (provider instanceof GoogleAuthProvider) provider.setCustomParameters({ prompt: 'select_account' })
    if (provider instanceof FacebookAuthProvider) provider.addScope('email')
    let socialToken = ''
    let socialEmail = ''
    try {
      const result = await signInWithPopup(firebaseAuth, provider)
      const idToken = await result.user.getIdToken()
      socialToken = idToken
      socialEmail = result.user.email ?? ''
      await finishAuthentication({
        idToken,
        email: result.user.email,
        provider: name,
      })
      navigate('/pages', { replace: true })
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'account_link_required' && socialToken && socialEmail) {
        savePendingSocial({ providerId: name, socialToken, email: socialEmail })
        setMode('login')
        setEmail(socialEmail)
        setMessage({ tone: 'info', text: '请先使用原来的 Email 密码登录，完成后关联社交账号。' })
      } else if (error instanceof FirebaseError && error.code === 'auth/account-exists-with-different-credential') {
        const conflictEmail = String(error.customData?.email ?? '')
        const methods = await findMethods(conflictEmail)
        const existing = methods.length ? providerLabel(methods) : name === 'facebook.com' ? 'Google' : 'Facebook'
        if (methods.includes('password')) {
          setMode('login')
          setEmail(conflictEmail)
          setMessage({ tone: 'info', text: `请先使用 Email 登录；随后重新选择 ${name === 'google.com' ? 'Google' : 'Facebook'}。` })
        } else {
          clearPendingSocial()
          setMessage({ tone: 'info', text: `这个邮箱已使用 ${existing} 注册，请使用 ${existing} 登录。` })
        }
      } else if (error instanceof ApiClientError) {
        setMessage({ tone: 'error', text: error.message })
      } else if (error instanceof FirebaseError && error.code !== 'auth/popup-closed-by-user') {
        setMessage({ tone: 'error', text: error.message })
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_14%_5%,rgba(59,130,246,.13),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(236,72,153,.1),transparent_24%),#f7f8fc]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <Brand />
        <div className="text-sm text-slate-500">
          <span className="hidden sm:inline">{mode === 'login' ? 'New to Allonelink?' : 'Already have an account?'}</span>{' '}
          <button onClick={switchMode} className="font-semibold text-slate-950 transition hover:text-violet-600">
            {mode === 'login' ? 'Create account' : 'Log in'}
          </button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-92px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-6 lg:grid-cols-[1fr_480px] lg:px-8">
        <section className="hidden max-w-2xl lg:block">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-violet-600">One link. More possibilities.</p>
          <h1 className="mt-5 text-6xl font-semibold leading-[.96] tracking-[-.055em] text-slate-950">
            Everything you share,<br /><span className="brand-text font-extrabold">all in one place.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-500">
            Build your page, connect with your audience, and grow your creator business from one memorable link.
          </p>
          <div className="mt-10 flex gap-4">
            {['Build', 'Share', 'Grow'].map((item, index) => (
              <div key={item} className="rounded-3xl bg-white/75 px-6 py-5 shadow-[0_18px_50px_rgba(15,23,42,.06)] backdrop-blur">
                <div className="brand-dot">0{index + 1}</div>
                <div className="mt-2 font-semibold text-slate-900">{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px] rounded-[36px] border border-white/80 bg-white/92 p-6 shadow-[0_28px_80px_rgba(15,23,42,.1)] backdrop-blur-xl sm:p-10">
          <div className="flex rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
            {(['login', 'register'] as const).map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={mode === item}
                onClick={() => { setMode(item); setMessage(null) }}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {item === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <h2 className="mt-8 text-3xl font-bold tracking-[-.035em] text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === 'login' ? 'Continue to manage your Allonelink pages.' : 'Start free and publish your first page in minutes.'}
          </p>

          {message && (
            <div className={`mt-5 rounded-2xl px-4 py-3 text-sm leading-6 ${message.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`} role="alert">
              {message.text}
            </div>
          )}

          <form onSubmit={submitEmail} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 pr-3 transition focus-within:border-violet-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-slate-950 outline-none placeholder:text-slate-400"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="px-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            {mode === 'register' && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter it again"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
              </label>
            )}
            <button disabled={Boolean(busy)} className="brand-button mt-2 flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
              {busy === 'email' ? 'Please wait…' : mode === 'login' ? 'Continue with Email' : 'Create account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-[.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button disabled={Boolean(busy) || !firebaseConfigured} onClick={() => socialLogin('google.com')} className="social-button">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-bold text-[#4285F4] shadow-sm">G</span>
              {busy === 'google.com' ? 'Opening…' : 'Google'}
            </button>
            <button disabled={Boolean(busy) || !firebaseConfigured} onClick={() => socialLogin('facebook.com')} className="social-button">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1877F2] text-sm font-bold text-white">f</span>
              {busy === 'facebook.com' ? 'Opening…' : 'Facebook'}
            </button>
          </div>
          {!firebaseConfigured && <p className="mt-4 text-center text-xs text-amber-700">Social login activates after Firebase environment variables are configured.</p>}

          <p className="mt-7 text-center text-xs leading-5 text-slate-400">
            By continuing, you agree to the <a href="https://allonel.ink/terms/" className="font-semibold text-slate-600 hover:text-slate-950">Terms</a> and <a href="https://allonel.ink/privacy/" className="font-semibold text-slate-600 hover:text-slate-950">Privacy Policy</a>.
          </p>
        </section>
      </main>
    </div>
  )
}
