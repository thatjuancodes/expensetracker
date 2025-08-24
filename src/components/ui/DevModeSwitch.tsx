import { Box } from '@chakra-ui/react'

interface DevModeSwitchProps {
  checked: boolean
  onToggle: () => void
  darkMode: boolean
}

export default function DevModeSwitch(props: DevModeSwitchProps) {
  const { checked, onToggle, darkMode } = props
  return (
    <Box
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onToggle()
        }
      }}
      w={10}
      h={5}
      borderRadius="full"
      backgroundColor={checked ? 'green.400' : darkMode ? 'gray.600' : 'gray.300'}
      position="relative"
      transition="background-color 0.2s ease"
      cursor="pointer"
    >
      <Box
        position="absolute"
        top={1}
        left={checked ? 5 : 1}
        w={3}
        h={3}
        borderRadius="full"
        backgroundColor={checked ? 'white' : 'white'}
        transition="left 0.2s ease"
        boxShadow="sm"
      />
    </Box>
  )
}


