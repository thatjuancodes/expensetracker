import { ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

const system = createSystem(defaultConfig, {})

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ThemeProvider>
  )
}

