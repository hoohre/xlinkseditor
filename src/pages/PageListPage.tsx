import { useEffect, useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../lib/api'

interface PageSummary {
  id: string
  host: string
  slug: string
  status: 'draft' | 'publishing' | 'published' | 'archived'
  updatedAt: string
}

export function PageListPage() {
  const navigate = useNavigate()
  const { session, getToken, logout } = useAuth()
  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    let active = true
    const load = async () => {
      try {
        const token = await getToken()
        if (!token) return
        const result = await apiRequest<PageSummary[]>('/api/v1/pages', {}, token)
        if (active) setPages(result)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load pages')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [getToken, session])

  if (!session) return <Navigate to="/auth" replace />

  const signOutNow = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:block">{session.email}</span>
            <Link to="/settings/password" className="text-sm font-semibold text-slate-700">Password</Link>
            <button onClick={signOutNow} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.18em] text-violet-600">Workspace</p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-.04em]">Your pages</h1>
            <p className="mt-2 text-slate-500">Manage every Allonelink page from one place.</p>
          </div>
          <button disabled className="brand-button rounded-full px-6 py-3 text-sm font-bold text-white opacity-55" title="Page creation is part of the next editor phase">Create page</button>
        </div>

        {error && <div className="mt-8 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}

        {loading ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-[28px] bg-white shadow-sm" />)}
          </div>
        ) : pages.length ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pages.map((page) => (
              <article key={page.id} className="group rounded-[28px] border border-slate-200/70 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,.05)] transition hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(15,23,42,.09)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-violet-500 to-pink-500 text-lg font-bold text-white">a</div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${page.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{page.status}</span>
                </div>
                <h2 className="mt-8 text-xl font-bold">/{page.slug}</h2>
                <a href={`https://${page.host}/${page.slug}`} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm text-slate-500 hover:text-violet-600">{page.host}/{page.slug}</a>
                <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
                  <span>Updated {new Date(page.updatedAt).toLocaleDateString()}</span>
                  <span className="font-semibold text-slate-700">Editor coming next</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[32px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-50 text-2xl font-bold text-violet-600">+</div>
            <h2 className="mt-6 text-2xl font-bold">No pages yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Your account is ready. Page creation and the full editor will be added in the next phase.</p>
          </div>
        )}
      </main>
    </div>
  )
}
