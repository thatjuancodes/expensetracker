import { Box, Spinner } from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'
import LoginPage from './LoginPage'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'

  if (loading) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg={darkMode ? '#2e2e2e' : '#f4f4f4'}
      >
        <Spinner size="xl" color={darkMode ? 'white' : 'gray.900'} />
      </Box>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <>{children}</>
}

