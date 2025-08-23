import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Handle OAuth callback if present in URL
    const handleOAuthCallback = async () => {
      // Check if we have OAuth tokens in the URL
      const urlParams = new URLSearchParams(window.location.search)
      const hasOAuthParams = urlParams.has('access_token') || urlParams.has('code') || urlParams.has('error')
      
      if (hasOAuthParams) {
        try {
          // Let Supabase handle the OAuth callback
          const { data, error } = await supabase.auth.getSession()
          if (error) {
            console.error('OAuth callback error:', error)
          } else if (data.session) {
            // Clean up the URL after successful authentication
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        } catch (err) {
          console.error('Error processing OAuth callback:', err)
        }
      }
    }

    // Handle OAuth callback first
    handleOAuthCallback().then(() => {
      // Then get the current session
      return supabase.auth.getSession()
    }).then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((error) => {
      console.error('Error getting session:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  const signOut = async () => {
    return await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

