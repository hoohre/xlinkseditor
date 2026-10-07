import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { updatePassword } from '../auth/session'
import { Brand } from '../components/Brand'

export function PasswordPage() {
  const { session, getToken, finishAuthentication } = useAuth()
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!session) return <Navigate to="/auth" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmation) { setMessage('两次新密码输入不一致。'); return }
    setBusy(true); setMessage('')
    try {
      const token = await getToken()
      if (!token || !session.email) throw new Error('请重新登录后修改密码。')
      const result = await updatePassword(token, session.email, password, newPassword)
      await finishAuthentication({ ...result, provider: 'password', tokenType: 'allonelink' })
      setPassword(''); setNewPassword(''); setConfirmation(''); setMessage('密码已更新，旧的邮箱登录凭据已失效。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '无法更新密码。') }
    finally { setBusy(false) }
  }
  return <div className="min-h-screen bg-slate-50 p-6">
    <header className="mx-auto flex max-w-5xl items-center justify-between"><Brand /><Link to="/pages">Back to pages</Link></header>
    <main className="mx-auto mt-12 max-w-md rounded-3xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Password</h1>
      <p className="mt-2 text-sm text-slate-500">{session.email}</p>
      <p className="mt-4 text-sm text-slate-500">Enter your current password. If you only use Google or Facebook, leave it empty and sign in again before setting your first password.</p>
      {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm">{message}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Current password<input className="mt-2 w-full rounded-xl border border-slate-200 p-3" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block text-sm">New password<input required minLength={8} maxLength={128} className="mt-2 w-full rounded-xl border border-slate-200 p-3" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label className="block text-sm">Confirm password<input required minLength={8} className="mt-2 w-full rounded-xl border border-slate-200 p-3" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
        <button disabled={busy} className="brand-button w-full rounded-xl p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </main>
  </div>
}
