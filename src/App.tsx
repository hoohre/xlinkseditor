import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { PasswordPage } from './pages/PasswordPage'
import { PageListPage } from './pages/PageListPage'

function HomeRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? '/pages' : '/auth'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/signup" element={<Navigate to="/auth" replace />} />
      <Route path="/settings/password" element={<PasswordPage />} />
      <Route path="/pages" element={<PageListPage />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
