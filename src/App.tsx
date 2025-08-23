import ChatPage from './pages/Chat'
import AuthGuard from './components/auth/AuthGuard'

export default function App() {
  return (
    <AuthGuard>
      <ChatPage />
    </AuthGuard>
  )
}
