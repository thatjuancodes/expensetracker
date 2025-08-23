import { useState } from 'react'
import { Box, Button, VStack, Text, Heading, Spinner } from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { error } = await signInWithGoogle()
      
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg={darkMode ? '#2e2e2e' : '#f4f4f4'}
      color={darkMode ? 'white' : 'gray.900'}
    >
      <Box
        maxW="400px"
        w="full"
        p={8}
        borderRadius="lg"
        bg={darkMode ? 'gray.800' : 'white'}
        boxShadow="lg"
      >
        <VStack gap={6} align="stretch">
          <VStack gap={3}>
            <Heading size="lg" textAlign="center">
              Welcome to Expense Tracker
            </Heading>
            
            <Text textAlign="center" color={darkMode ? 'gray.300' : 'gray.600'}>
              Sign in to your account to continue
            </Text>
          </VStack>

          <VStack gap={4}>
            {error && (
              <Box
                p={3}
                bg="red.100"
                color="red.800"
                borderRadius="md"
                fontSize="sm"
                textAlign="center"
                w="full"
              >
                {error}
              </Box>
            )}

            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              size="lg"
              w="full"
              backgroundColor={darkMode ? 'blue.600' : 'blue.500'}
              color="white"
              _hover={{
                backgroundColor: darkMode ? 'blue.700' : 'blue.600',
              }}
              _disabled={{
                opacity: 0.6,
                cursor: 'not-allowed',
              }}
            >
              {loading ? (
                <>
                  <Spinner size="sm" mr={2} />
                  Signing in...
                </>
              ) : (
                'Continue with Google'
              )}
            </Button>
          </VStack>
        </VStack>
      </Box>
    </Box>
  )
}

