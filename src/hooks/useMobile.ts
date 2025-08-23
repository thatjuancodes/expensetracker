import { useBreakpointValue } from '@chakra-ui/react'

/**
 * Custom hook to detect if the current screen is mobile size
 * Returns true for screens smaller than md breakpoint (768px)
 */
export function useMobile() {
  return useBreakpointValue({ base: true, md: false }) ?? false
}

/**
 * Custom hook for mobile-friendly touch target sizes
 * Returns larger sizes on mobile for better accessibility
 */
export function useTouchTargetSize() {
  return {
    button: useBreakpointValue({ base: 'md', md: 'sm' }),
    iconButton: useBreakpointValue({ base: 'md', md: 'sm' }),
    minHeight: useBreakpointValue({ base: '44px', md: 'auto' }),
    iconSize: useBreakpointValue({ base: 20, md: 18 })
  }
}

/**
 * Custom hook for responsive spacing values
 */
export function useResponsiveSpacing() {
  return {
    container: {
      py: useBreakpointValue({ base: 2, md: 4 }),
      px: useBreakpointValue({ base: 3, md: 6 })
    },
    content: {
      py: useBreakpointValue({ base: 3, md: 6 }),
      px: useBreakpointValue({ base: 3, md: 6 })
    },
    gap: useBreakpointValue({ base: 2, md: 3 })
  }
}
