import { useEffect, useState } from 'react'
import ChatPage from './pages/Chat'
import AuthGuard from './components/auth/AuthGuard'
import AdminPage from './pages/Admin'
import Dashboard from './pages/Dashboard'

function useHashRoute() {
  const [hash, setHash] = useState<string>(() => window.location.hash || '#/')

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash
}

export default function App() {
  const hash = useHashRoute()
  const route = hash.replace(/^#/, '') || '/'

  return (
    <AuthGuard>
      {route.startsWith('/admin') 
        ? <AdminPage /> 
        : route.startsWith('/dashboard') 
        ? <Dashboard /> 
        : <ChatPage />
      }
    </AuthGuard>
  )
}
