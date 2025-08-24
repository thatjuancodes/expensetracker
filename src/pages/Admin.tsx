import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Container,
  Heading,
  HStack,
  Stack,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  Text,
  IconButton,
} from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { ChevronsLeft } from 'lucide-react'
import AccountMenu from '../components/layout/AccountMenu'
import { env } from '../config/env'

// Prevent duplicate fetches across StrictMode re-mounts
let usersInflight: Promise<SimpleUser[] | null> | null = null
const USERS_CACHE_KEY = 'adminUsersCacheV1'

interface SimpleUser {
  id: string
  email: string | null
  createdAt?: string
}

export default function AdminPage() {
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'
  const pageBg = darkMode ? '#2e2e2e' : '#f4f4f4'
  const pageFg = darkMode ? 'white' : 'gray.900'
  const borderCol = darkMode ? 'gray.600' : 'gray.400'

  const [activeTab, setActiveTab] = useState<string>('users')
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [devMode, setDevMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('devMode')
    return saved ? JSON.parse(saved) : false
  })

  const handleDevModeToggle = () => {
    setDevMode((prev) => {
      const next = !prev
      localStorage.setItem('devMode', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (activeTab !== 'users') return
    let cancelled = false
    const loadUsers = async () => {
      setLoadingUsers(true)
      setUsersError(null)
      try {
        const cacheKey = `${USERS_CACHE_KEY}:${devMode ? 'dev' : 'prod'}`

        // Serve from cache if available (survives StrictMode re-mounts)
        const cachedRaw = sessionStorage.getItem(cacheKey)
        if (cachedRaw) {
          try {
            const cachedUsers = JSON.parse(cachedRaw) as SimpleUser[]
            if (!cancelled) setUsers(cachedUsers)
            return
          } catch {
            // ignore broken cache
          }
        }

        // Reuse in-flight request if any
        if (usersInflight) {
          const list = await usersInflight
          if (!cancelled && list) {
            setUsers(list)
          }
          return
        }

        const url = devMode
          ? 'https://homemakr.app.n8n.cloud/webhook-test/admin/users'
          : 'https://homemakr.app.n8n.cloud/webhook/admin/users'
        usersInflight = (async (): Promise<SimpleUser[] | null> => {
          const response = await fetch(url, { method: 'GET' })
          if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`n8n error ${response.status}${text ? `: ${text}` : ''}`)
          }

          const payload = (await response.json().catch(() => null)) as unknown

          const normalizeUsers = (data: unknown): SimpleUser[] => {
            const mapUsers = (arr: unknown[]): SimpleUser[] =>
              arr
                .map((item) => {
                  if (!item || typeof item !== 'object') return null
                  const obj = item as Record<string, unknown>
                  const id = (obj.id as string) ?? ''
                  const email = (obj.email as string) ?? null
                  const createdAt = (obj.created_at as string) ?? (obj.createdAt as string) ?? undefined
                  if (!id && !email) return null
                  return { id: String(id), email, createdAt }
                })
                .filter(Boolean) as SimpleUser[]

            if (Array.isArray(data)) {
              const direct = mapUsers(data)
              if (direct.length > 0) return direct
              const nestedDataArrays = data
                .filter((item) => item && typeof item === 'object' && Array.isArray((item as any).data))
                .map((item) => (item as any).data as unknown[])
              if (nestedDataArrays.length > 0) {
                const flattened = nestedDataArrays.flat()
                return mapUsers(flattened)
              }
              return []
            }

            if (data && typeof data === 'object') {
              const obj = data as Record<string, unknown>
              if (Array.isArray(obj.users)) return mapUsers(obj.users as unknown[])
              if (Array.isArray(obj.data)) return mapUsers(obj.data as unknown[])
            }
            return []
          }

          const list = normalizeUsers(payload)
          return list
        })()

        try {
          const list = await usersInflight
          if (!cancelled && list) {
            setUsers(list)
            // Cache for this session to avoid re-calling test webhooks
            sessionStorage.setItem(cacheKey, JSON.stringify(list))
          }
        } finally {
          usersInflight = null
        }
      } catch (e) {
        if (!cancelled) setUsersError('Failed to load users')
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [activeTab, devMode])

  const header = useMemo(
    () => (
      <HStack justify="space-between" align="center">
        <HStack gap={2}>
          <IconButton
            aria-label="Back to Chat"
            variant="ghost"
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            p={0}
            minW="auto"
            height="auto"
            onClick={() => {
              window.location.hash = '#/'
            }}
          >
            <ChevronsLeft size={18} />
          </IconButton>
          <Heading size="md">Admin</Heading>
        </HStack>
      </HStack>
    ),
    [darkMode],
  )

  return (
    <Box minH="100dvh" bg={pageBg} color={pageFg}>
      <Box as="aside"
        display={{ base: 'none', md: 'block' }}
        borderRightWidth="1px"
        bg={darkMode ? '#1f1f1f' : '#ffffff'}
        w={72}
        h="100vh"
        overflowX="hidden"
        position="fixed"
        top={0}
        left={0}
        zIndex={5}
      >
        <Box p={3} borderBottomWidth="1px" borderColor={borderCol}>
          <Stack gap={1}>
            <Heading size="sm" color={pageFg}>{env.appName}</Heading>
            <Text fontSize="xs" color={darkMode ? 'gray.300' : 'gray.600'}>
              Admin tools and settings.
            </Text>
          </Stack>
        </Box>

        {/* Account Information Section */}
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          borderTopWidth="1px"
          borderColor={borderCol}
          p={3}
          bg={darkMode ? '#1f1f1f' : '#ffffff'}
        >
          <AccountMenu
            darkMode={darkMode}
            pageFg={pageFg}
            borderCol={borderCol}
            devMode={devMode}
            onToggleDevMode={handleDevModeToggle}
          />
        </Box>
      </Box>

      <Box borderBottomWidth="1px" bg={pageBg} ml={{ base: 0, md: 72 }}>
        <Container maxW="6xl" py={{ base: 3, md: 6 }} px={{ base: 3, md: 6 }} ml={{ base: 0, md: 72 }}>
          {header}

          <TabsRoot
            mt={8}
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value)}
          >
            <TabsList backgroundColor="transparent">
              <TabsTrigger
                value="users"
                backgroundColor="transparent"
                color={pageFg}
                _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
                css={{ '&[data-selected=true]': { backgroundColor: darkMode ? '#3a3a3a' : '#eaeaea', color: pageFg } }}
              >
                Users
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Stack gap={3}>
                {usersError && (
                  <Box
                    borderWidth="1px"
                    borderColor={borderCol}
                    borderRadius="md"
                    p={3}
                    backgroundColor={darkMode ? '#3a2a2a' : '#fff5f5'}
                  >
                    <Text color={darkMode ? 'red.200' : 'red.700'}>{usersError}</Text>
                  </Box>
                )}

                <Box borderWidth="1px" borderColor={borderCol} borderRadius="md" overflowX="auto">
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>ID</Table.ColumnHeader>
                        <Table.ColumnHeader>Email</Table.ColumnHeader>
                        <Table.ColumnHeader>Created</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {loadingUsers ? (
                        <Table.Row>
                          <Table.Cell colSpan={3}>Loading...</Table.Cell>
                        </Table.Row>
                      ) : users.length === 0 ? (
                        <Table.Row>
                          <Table.Cell colSpan={3}>No users found</Table.Cell>
                        </Table.Row>
                      ) : (
                        users.map((u) => (
                          <Table.Row key={u.id}>
                            <Table.Cell>{u.id}</Table.Cell>
                            <Table.Cell>{u.email ?? '—'}</Table.Cell>
                            <Table.Cell>{u.createdAt ?? '—'}</Table.Cell>
                          </Table.Row>
                        ))
                      )}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Stack>
            </TabsContent>
          </TabsRoot>
        </Container>
      </Box>
    </Box>
  )
}
