import {
  Box,
  HStack,
  Text,
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuPositioner,
  Portal,
} from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { useAuth } from '../../contexts/AuthContext'
import DevModeSwitch from '../ui/DevModeSwitch'
import { Moon, Sun, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'

interface AccountMenuProps {
  darkMode: boolean
  pageFg: string
  borderCol: string
  devMode: boolean
  onToggleDevMode: () => void
  onAdminNavigate?: () => void
  showTalkMode?: boolean
  talkMode?: boolean
  onToggleTalkMode?: () => void
  showVoicePicker?: boolean
  voiceOptions?: Array<{ uri: string; label: string }>
  selectedVoiceUri?: string
  onSelectVoiceUri?: (uri: string) => void
}

export default function AccountMenu(props: AccountMenuProps) {
  const { darkMode, pageFg, borderCol, devMode, onToggleDevMode, onAdminNavigate, showTalkMode, talkMode, onToggleTalkMode, showVoicePicker, voiceOptions, selectedVoiceUri, onSelectVoiceUri } = props
  const { resolvedTheme, setTheme } = useTheme()
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleThemeToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setOpen(false)
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const showPrivileged = session?.user?.email === 'thejuan.codes@gmail.com'

  return (
    <MenuRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
      <MenuTrigger asChild>
        <Box
          cursor="pointer"
          _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
          borderRadius="md"
          p={2}
          mx={-2}
          transition="background-color 0.2s"
        >
          <HStack gap={3} align="center">
            <Box flex={1} minW={0}>
              <Text
                fontSize="sm"
                fontWeight="medium"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                color={pageFg}
              >
                {session?.user?.email || 'No email'}
              </Text>
            </Box>
            <Box
              w={8}
              h={8}
              borderRadius="full"
              backgroundColor={darkMode ? 'gray.300' : 'gray.300'}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Settings size={16} color={'black'} />
            </Box>
          </HStack>
        </Box>
      </MenuTrigger>
      <Portal>
        <MenuPositioner>
          <MenuContent
            bg={darkMode ? '#2a2a2a' : '#ffffff'}
            borderColor={borderCol}
            borderWidth="1px"
            borderRadius="md"
            minW="200px"
            shadow="lg"
          >
            {showVoicePicker && (voiceOptions?.length ?? 0) > 0 && (
              <MenuItem
                value="voice"
                color={darkMode ? 'white' : 'black'}
                _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
                onPointerDown={(e) => {
                  // Prevent menu from closing when interacting with the select
                  e.stopPropagation()
                }}
              >
                <HStack gap={2} justify="space-between" align="center" w="full">
                  <Text>Voice</Text>
                  <Box
                    as="select"
                    value={selectedVoiceUri ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSelectVoiceUri?.(e.target.value)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                    bg={darkMode ? 'gray.700' : 'gray.200'}
                    color={darkMode ? 'white' : 'black'}
                    borderRadius="md"
                    px={2}
                    py={1}
                  >
                    {(voiceOptions ?? []).map((opt) => (
                      <Box as="option" key={opt.uri} value={opt.uri} color={darkMode ? 'white' : 'black'}>
                        {opt.label}
                      </Box>
                    ))}
                  </Box>
                </HStack>
              </MenuItem>
            )}
            {showTalkMode && (
              <MenuItem
                value="talkmode"
                color={darkMode ? 'white' : 'black'}
                _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
                onPointerDown={(e) => {
                  // Prevent closing when toggling the switch
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  // allow toggle via click on row as well
                  e.preventDefault()
                  onToggleTalkMode?.()
                }}
              >
                <HStack gap={2} justify="space-between" align="center" w="full">
                  <Text>Talk Mode</Text>
                  <DevModeSwitch checked={!!talkMode} onToggle={() => onToggleTalkMode?.()} darkMode={darkMode} />
                </HStack>
              </MenuItem>
            )}
            <MenuItem
              value="theme"
              onPointerDown={handleThemeToggle}
              color={darkMode ? 'white' : 'black'}
              _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
            >
              <HStack gap={2}>
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                <Text>{darkMode ? 'Light mode' : 'Dark mode'}</Text>
              </HStack>
            </MenuItem>

            <MenuItem
              value="signout"
              onClick={handleSignOut}
              disabled={isSigningOut}
              color={darkMode ? 'white' : 'black'}
              _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
            >
              <HStack gap={2}>
                <LogOut size={16} />
                <Text>{isSigningOut ? 'Signing out...' : 'Sign out'}</Text>
              </HStack>
            </MenuItem>

            {showPrivileged && (
              <MenuItem
                value="admin"
                onClick={() => {
                  window.location.hash = '#/admin'
                  setOpen(false)
                  onAdminNavigate?.()
                }}
                color={darkMode ? 'white' : 'black'}
                _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
              >
                <HStack gap={2}>
                  <Settings size={16} />
                  <Text>Admin</Text>
                </HStack>
              </MenuItem>
            )}

            {showPrivileged && (
              <MenuItem
                value="devmode"
                color={darkMode ? 'white' : 'black'}
                _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.100' }}
              >
                <HStack gap={2} justify="space-between" align="center" w="full">
                  <Text>{'DEV MODE'}</Text>
                  <DevModeSwitch checked={devMode} onToggle={onToggleDevMode} darkMode={darkMode} />
                </HStack>
              </MenuItem>
            )}
          </MenuContent>
        </MenuPositioner>
      </Portal>
    </MenuRoot>
  )
}


