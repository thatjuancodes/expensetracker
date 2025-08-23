import { Box, useBreakpointValue } from '@chakra-ui/react'

interface ResponsiveImageProps {
  src: string
  alt: string
  maxW?: { base: number; md: number }
  maxH?: { base: number; md: number }
  borderRadius?: string
  borderWidth?: string
}

export default function ResponsiveImage({ 
  src, 
  alt, 
  maxW = { base: 120, md: 160 },
  maxH = { base: 120, md: 160 },
  borderRadius = 'md',
  borderWidth = '1px'
}: ResponsiveImageProps) {
  const responsiveMaxW = useBreakpointValue(maxW)
  const responsiveMaxH = useBreakpointValue(maxH)

  return (
    <Box overflow="hidden" borderRadius={borderRadius} borderWidth={borderWidth}>
      <img 
        src={src} 
        alt={alt} 
        style={{ 
          display: 'block', 
          maxWidth: responsiveMaxW, 
          maxHeight: responsiveMaxH, 
          objectFit: 'cover',
          width: '100%',
          height: 'auto'
        }} 
      />
    </Box>
  )
}
