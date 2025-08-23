import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'

export default function LogoutButton() {
  const { signOut, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Button
      onClick={handleSignOut}
      disabled={loading}
      size="sm"
      backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
      color={darkMode ? 'white' : 'black'}
      _hover={{
        backgroundColor: darkMode ? 'gray.600' : 'gray.400',
      }}
      _disabled={{
        opacity: 0.6,
        cursor: 'not-allowed',
      }}
    >
      <LogOut size={16} />
      {loading ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}

