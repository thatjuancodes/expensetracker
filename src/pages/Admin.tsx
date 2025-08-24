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
import { useAuth } from '../contexts/AuthContext'
import { env } from '../config/env'

// Prevent duplicate fetches across StrictMode re-mounts
let usersInflight: Promise<SimpleUser[] | null> | null = null
let expensesInflight: Promise<SimpleExpense[] | null> | null = null
// In-memory caches (cleared on page reload)
const usersCache: { dev?: SimpleUser[]; prod?: SimpleUser[] } = {}
const expensesCache: Record<string, { dev?: SimpleExpense[]; prod?: SimpleExpense[] }> = {}

interface SimpleUser {
  id: string
  email: string | null
  createdAt?: string
}

interface SimpleExpense {
  id: string
  date?: string
  amount?: number | string
  category?: string | null
  merchant?: string | null
  note?: string | null
}

export default function AdminPage() {
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const darkMode = resolvedTheme === 'dark'
  const pageBg = darkMode ? '#2e2e2e' : '#f4f4f4'
  const pageFg = darkMode ? 'white' : 'gray.900'
  const borderCol = darkMode ? 'gray.600' : 'gray.400'

  const [activeTab, setActiveTab] = useState<string>('users')
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState<boolean>(false)
  const [expensesError, setExpensesError] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<SimpleExpense[]>([])
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
        const envKey = devMode ? 'dev' : 'prod'
        const cachedUsers = usersCache[envKey]
        if (cachedUsers) {
          if (!cancelled) setUsers(cachedUsers)
          return
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
            usersCache[envKey] = list
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

  useEffect(() => {
    if (activeTab !== 'expenses') return
    let cancelled = false
    const loadExpenses = async () => {
      setLoadingExpenses(true)
      setExpensesError(null)
      // Wait until we have an authenticated user before requesting
      if (!user?.id) {
        setLoadingExpenses(false)
        return
      }
      try {

        const envKey = devMode ? 'dev' : 'prod'
        const cached = expensesCache[user.id]?.[envKey]
        if (cached) {
          if (!cancelled) setExpenses(cached)
          return
        }

        if (expensesInflight) {
          const list = await expensesInflight
          if (!cancelled && list) setExpenses(list)
          return
        }

        const url = devMode
          ? 'https://homemakr.app.n8n.cloud/webhook-test/user/expenses'
          : 'https://homemakr.app.n8n.cloud/webhook/user/expenses'

        expensesInflight = (async (): Promise<SimpleExpense[] | null> => {
          const urlWithQuery = `${url}?userId=${encodeURIComponent(user.id)}`
          const response = await fetch(urlWithQuery, { method: 'GET' })
          if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`n8n error ${response.status}${text ? `: ${text}` : ''}`)
          }
          const payload = (await response.json().catch(() => null)) as unknown

          const normalizeExpenses = (data: unknown): SimpleExpense[] => {
            const mapOne = (obj: Record<string, unknown>): SimpleExpense | null => {
              const id = (obj.id as string) ?? ''
              if (!id) return null
              const date = (obj.date as string) ?? (obj.created_at as string) ?? (obj.createdAt as string)
              const amount = (obj.amount as number | string) ?? (obj.total as number | string) ?? (obj.value as number | string)
              const category = (obj.category as string) ?? null
              const merchant = (obj.merchant as string) ?? (obj.vendor as string) ?? (obj.payee as string) ?? null
              const note = (obj.note as string) ?? (obj.description as string) ?? (obj.memo as string) ?? null
              return { id: String(id), date, amount, category, merchant, note }
            }

            const mapMany = (arr: unknown[]): SimpleExpense[] =>
              arr
                .map((item) => (item && typeof item === 'object' ? mapOne(item as Record<string, unknown>) : null))
                .filter(Boolean) as SimpleExpense[]

            if (Array.isArray(data)) {
              const direct = mapMany(data)
              if (direct.length > 0) return direct
              const nestedDataArrays = data
                .filter((item) => item && typeof item === 'object' && Array.isArray((item as any).data))
                .map((item) => (item as any).data as unknown[])
              if (nestedDataArrays.length > 0) {
                const flattened = nestedDataArrays.flat()
                return mapMany(flattened)
              }
              return []
            }
            if (data && typeof data === 'object') {
              const obj = data as Record<string, unknown>
              if (Array.isArray(obj.expenses)) return mapMany(obj.expenses as unknown[])
              if (Array.isArray(obj.data)) return mapMany(obj.data as unknown[])
            }
            return []
          }

          const list = normalizeExpenses(payload)
          return list
        })()

        try {
          const list = await expensesInflight
          if (!cancelled && list) {
            setExpenses(list)
            if (!expensesCache[user.id]) expensesCache[user.id] = {}
            expensesCache[user.id][envKey] = list
          }
        } finally {
          expensesInflight = null
        }
      } catch (e) {
        if (!cancelled) setExpensesError('Failed to load expenses')
      } finally {
        if (!cancelled) setLoadingExpenses(false)
      }
    }

    void loadExpenses()
    return () => {
      cancelled = true
    }
  }, [activeTab, devMode, user?.id])

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
            onValueChange={(v: any) => setActiveTab(typeof v === 'string' ? v : v?.value)}
          >
            <TabsList backgroundColor="transparent">
              <TabsTrigger
                value="users"
                backgroundColor="transparent"
                color={pageFg}
                _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
                css={{ '&[data-selected=true]': { backgroundColor: darkMode ? '#3a3a3a' : '#eaeaea', color: pageFg } }}
                onClick={() => setActiveTab('users')}
              >
                Users
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                backgroundColor="transparent"
                color={pageFg}
                _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
                css={{ '&[data-selected=true]': { backgroundColor: darkMode ? '#3a3a3a' : '#eaeaea', color: pageFg } }}
                onClick={() => setActiveTab('expenses')}
              >
                Expenses
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

            <TabsContent value="expenses">
              <Stack gap={3}>
                {expensesError && (
                  <Box
                    borderWidth="1px"
                    borderColor={borderCol}
                    borderRadius="md"
                    p={3}
                    backgroundColor={darkMode ? '#3a2a2a' : '#fff5f5'}
                  >
                    <Text color={darkMode ? 'red.200' : 'red.700'}>{expensesError}</Text>
                  </Box>
                )}

                <Box borderWidth="1px" borderColor={borderCol} borderRadius="md" overflowX="auto">
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>ID</Table.ColumnHeader>
                        <Table.ColumnHeader>Date</Table.ColumnHeader>
                        <Table.ColumnHeader>Merchant</Table.ColumnHeader>
                        <Table.ColumnHeader>Category</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="right">Amount</Table.ColumnHeader>
                        <Table.ColumnHeader>Note</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {loadingExpenses ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>Loading...</Table.Cell>
                        </Table.Row>
                      ) : expenses.length === 0 ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>No expenses found</Table.Cell>
                        </Table.Row>
                      ) : (
                        expenses.map((ex) => (
                          <Table.Row key={ex.id}>
                            <Table.Cell>{ex.id}</Table.Cell>
                            <Table.Cell>{ex.date ?? '—'}</Table.Cell>
                            <Table.Cell>{ex.merchant ?? '—'}</Table.Cell>
                            <Table.Cell>{ex.category ?? '—'}</Table.Cell>
                            <Table.Cell textAlign="right">{ex.amount ?? '—'}</Table.Cell>
                            <Table.Cell>{ex.note ?? '—'}</Table.Cell>
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
