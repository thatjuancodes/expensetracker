export type AppEnv = 'development' | 'test' | 'staging' | 'production'

interface PublicEnv {
  appName: string
  appEnv: AppEnv
  // Note: Do not expose real secrets in client-side code. Kept optional for local demos only.
  openaiApiKey?: string
  useOpenAI: boolean
  openaiModel: string
}

function readString(name: string, fallback?: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv] as unknown as string | undefined
  if (value == null || value === '') {
    if (fallback !== undefined) return fallback
  }
  return value ?? ''
}

function readAppEnv(): AppEnv {
  const value = readString('VITE_APP_ENV', 'development').toLowerCase()
  if (value === 'production' || value === 'staging' || value === 'test' || value === 'development') {
    return value
  }
  return 'development'
}

export const env: PublicEnv = {
  appName: readString('VITE_APP_NAME', 'Expense Tracker'),
  appEnv: readAppEnv(),
  openaiApiKey: readString('VITE_OPENAI_API_KEY'),
  useOpenAI: readString('VITE_USE_OPENAI', 'false').toLowerCase() === 'true',
  openaiModel: readString('VITE_OPENAI_MODEL', 'gpt-5'),
}

