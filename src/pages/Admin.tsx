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
let incomeInflight: Promise<SimpleIncome[] | null> | null = null
const incomeCache: Record<string, { dev?: SimpleIncome[]; prod?: SimpleIncome[] }> = {}
let billsInflight: Promise<SimpleBill[] | null> | null = null
const billsCache: Record<string, { dev?: SimpleBill[]; prod?: SimpleBill[] }> = {}

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

interface SimpleIncome {
  id: string
  date?: string
  amount?: number | string
  category?: string | null
  merchant?: string | null
  note?: string | null
}

interface SimpleBill {
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
  const [loadingIncome, setLoadingIncome] = useState<boolean>(false)
  const [incomeError, setIncomeError] = useState<string | null>(null)
  const [income, setIncome] = useState<SimpleIncome[]>([])
  const [loadingBills, setLoadingBills] = useState<boolean>(false)
  const [billsError, setBillsError] = useState<string | null>(null)
  const [bills, setBills] = useState<SimpleBill[]>([])
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
              const date =
                (obj.date as string) ||
                (obj.timestamp as string) ||
                (obj.created_at as string) ||
                (obj.createdAt as string)
              const rawAmount =
                (obj.amount as number | string) ??
                (obj.total as number | string) ??
                (obj.total_amount as number | string) ??
                (obj.value as number | string)
              const currency = (obj.currency as string) || undefined
              const amount = currency != null && rawAmount != null ? `${rawAmount} ${currency}` : rawAmount
              const category = (obj.category as string) ?? null
              const merchant =
                (obj.merchant as string) ??
                (obj.vendor as string) ??
                (obj.payee as string) ??
                (obj.provider as string) ??
                null
              const note =
                (obj.note as string) ??
                (obj.notes as string) ??
                (obj.description as string) ??
                (obj.name as string) ??
                (obj.memo as string) ??
                null
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
              const single = mapOne(obj)
              if (single) return [single]
            }
            return []
          }

          let list = normalizeExpenses(payload)
          if ((!list || list.length === 0) && Array.isArray(payload) && payload.length > 0) {
            list = (payload as unknown[]).map((item, idx) => {
              const o = (item ?? {}) as Record<string, unknown>
              const id = String((o.id as unknown) ?? idx)
              const date = (o.timestamp as string) || (o.created_at as string) || (o.date as string)
              const amt =
                (o.total_amount as number | string) ??
                (o.amount as number | string) ??
                (o.total as number | string) ??
                (o.value as number | string)
              const currency = (o.currency as string) || undefined
              const amount = currency != null && amt != null ? `${amt} ${currency}` : amt
              const category = (o.category as string) ?? null
              const merchant =
                (o.provider as string) ??
                (o.merchant as string) ??
                (o.vendor as string) ??
                (o.payee as string) ??
                null
              const note =
                (o.notes as string) ??
                (o.description as string) ??
                (o.name as string) ??
                (o.note as string) ??
                (o.memo as string) ??
                null
              return { id, date, amount, category, merchant, note }
            })
          }
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

  useEffect(() => {
    if (activeTab !== 'bills') return
    let cancelled = false
    const loadBills = async () => {
      setLoadingBills(true)
      setBillsError(null)
      if (!user?.id) {
        setLoadingBills(false)
        return
      }
      try {
        const envKey = devMode ? 'dev' : 'prod'
        const cached = billsCache[user.id]?.[envKey]
        if (cached) {
          if (!cancelled) setBills(cached)
          return
        }

        if (billsInflight) {
          const list = await billsInflight
          if (!cancelled && list) setBills(list)
          return
        }

        const url = devMode
          ? 'https://homemakr.app.n8n.cloud/webhook-test/user/bills'
          : 'https://homemakr.app.n8n.cloud/webhook/user/bills'

        billsInflight = (async (): Promise<SimpleBill[] | null> => {
          const urlWithQuery = `${url}?userId=${encodeURIComponent(user.id)}`
          const response = await fetch(urlWithQuery, { method: 'GET' })
          if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`n8n error ${response.status}${text ? `: ${text}` : ''}`)
          }
          const payload = (await response.json().catch(() => null)) as unknown

          const normalize = (data: unknown): SimpleBill[] => {
            const mapOne = (obj: Record<string, unknown>): SimpleBill | null => {
              const id = (obj.id as string) ?? ''
              if (!id) return null
              const date =
                (obj.date as string) ||
                (obj.timestamp as string) ||
                (obj.created_at as string) ||
                (obj.createdAt as string)
              const rawAmount =
                (obj.amount as number | string) ??
                (obj.total as number | string) ??
                (obj.total_amount as number | string) ??
                (obj.value as number | string)
              const currency = (obj.currency as string) || undefined
              const amount = currency != null && rawAmount != null ? `${rawAmount} ${currency}` : rawAmount
              const category = (obj.category as string) ?? null
              const merchant =
                (obj.provider as string) ??
                (obj.merchant as string) ??
                (obj.vendor as string) ??
                (obj.payee as string) ??
                null
              const note =
                (obj.notes as string) ??
                (obj.description as string) ??
                (obj.name as string) ??
                (obj.note as string) ??
                (obj.memo as string) ??
                null
              return { id: String(id), date, amount, category, merchant, note }
            }

            const mapMany = (arr: unknown[]): SimpleBill[] =>
              arr
                .map((item) => (item && typeof item === 'object' ? mapOne(item as Record<string, unknown>) : null))
                .filter(Boolean) as SimpleBill[]

            if (Array.isArray(data)) {
              const direct = mapMany(data)
              if (direct.length > 0) return direct
              const nested = data
                .filter((item) => item && typeof item === 'object' && Array.isArray((item as any).data))
                .map((item) => (item as any).data as unknown[])
              if (nested.length > 0) return mapMany(nested.flat())
              return []
            }
            if (data && typeof data === 'object') {
              const obj = data as Record<string, unknown>
              if (Array.isArray(obj.data)) return mapMany(obj.data as unknown[])
              const single = mapOne(obj)
              if (single) return [single]
            }
            return []
          }

          let list = normalize(payload)
          if ((!list || list.length === 0) && Array.isArray(payload) && payload.length > 0) {
            list = (payload as unknown[]).map((o, idx) => {
              const r = (o ?? {}) as Record<string, unknown>
              const id = String((r.id as unknown) ?? idx)
              const date = (r.timestamp as string) || (r.created_at as string) || (r.date as string)
              const amt =
                (r.total_amount as number | string) ??
                (r.amount as number | string) ??
                (r.total as number | string) ??
                (r.value as number | string)
              const currency = (r.currency as string) || undefined
              const amount = currency != null && amt != null ? `${amt} ${currency}` : amt
              const category = (r.category as string) ?? null
              const merchant =
                (r.provider as string) ??
                (r.merchant as string) ??
                (r.vendor as string) ??
                (r.payee as string) ??
                null
              const note =
                (r.notes as string) ??
                (r.description as string) ??
                (r.name as string) ??
                (r.note as string) ??
                (r.memo as string) ??
                null
              return { id, date, amount, category, merchant, note }
            })
          }
          return list
        })()

        try {
          const list = await billsInflight
          if (!cancelled && list) {
            setBills(list)
            if (!billsCache[user.id]) billsCache[user.id] = {}
            billsCache[user.id][envKey] = list
          }
        } finally {
          billsInflight = null
        }
      } catch (e) {
        if (!cancelled) setBillsError('Failed to load bills')
      } finally {
        if (!cancelled) setLoadingBills(false)
      }
    }

    void loadBills()
    return () => {
      cancelled = true
    }
  }, [activeTab, devMode, user?.id])

  useEffect(() => {
    if (activeTab !== 'income') return
    let cancelled = false
    const loadIncome = async () => {
      setLoadingIncome(true)
      setIncomeError(null)
      if (!user?.id) {
        setLoadingIncome(false)
        return
      }
      try {
        const envKey = devMode ? 'dev' : 'prod'
        const cached = incomeCache[user.id]?.[envKey]
        if (cached) {
          if (!cancelled) setIncome(cached)
          return
        }

        if (incomeInflight) {
          const list = await incomeInflight
          if (!cancelled && list) setIncome(list)
          return
        }

        const url = devMode
          ? 'https://homemakr.app.n8n.cloud/webhook-test/user/income'
          : 'https://homemakr.app.n8n.cloud/webhook/user/income'

        incomeInflight = (async (): Promise<SimpleIncome[] | null> => {
          const urlWithQuery = `${url}?userId=${encodeURIComponent(user.id)}`
          const response = await fetch(urlWithQuery, { method: 'GET' })
          if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`n8n error ${response.status}${text ? `: ${text}` : ''}`)
          }
          const payload = (await response.json().catch(() => null)) as unknown

          const normalize = (data: unknown): SimpleIncome[] => {
            const mapOne = (obj: Record<string, unknown>): SimpleIncome | null => {
              const id = (obj.id as string) ?? ''
              if (!id) return null
              const date =
                (obj.date as string) ||
                (obj.timestamp as string) ||
                (obj.created_at as string) ||
                (obj.createdAt as string)
              const rawAmount =
                (obj.amount as number | string) ??
                (obj.total as number | string) ??
                (obj.total_amount as number | string) ??
                (obj.value as number | string)
              const currency = (obj.currency as string) || undefined
              const amount = currency != null && rawAmount != null ? `${rawAmount} ${currency}` : rawAmount
              const category = (obj.category as string) ?? null
              const merchant =
                (obj.provider as string) ??
                (obj.merchant as string) ??
                (obj.vendor as string) ??
                (obj.payee as string) ??
                null
              const note =
                (obj.notes as string) ??
                (obj.description as string) ??
                (obj.name as string) ??
                (obj.note as string) ??
                (obj.memo as string) ??
                null
              return { id: String(id), date, amount, category, merchant, note }
            }

            const mapMany = (arr: unknown[]): SimpleIncome[] =>
              arr
                .map((item) => (item && typeof item === 'object' ? mapOne(item as Record<string, unknown>) : null))
                .filter(Boolean) as SimpleIncome[]

            if (Array.isArray(data)) {
              const direct = mapMany(data)
              if (direct.length > 0) return direct
              const nested = data
                .filter((item) => item && typeof item === 'object' && Array.isArray((item as any).data))
                .map((item) => (item as any).data as unknown[])
              if (nested.length > 0) return mapMany(nested.flat())
              return []
            }
            if (data && typeof data === 'object') {
              const obj = data as Record<string, unknown>
              if (Array.isArray(obj.data)) return mapMany(obj.data as unknown[])
              const single = mapOne(obj)
              if (single) return [single]
            }
            return []
          }

          let list = normalize(payload)
          if ((!list || list.length === 0) && Array.isArray(payload) && payload.length > 0) {
            list = (payload as unknown[]).map((o, idx) => {
              const r = (o ?? {}) as Record<string, unknown>
              const id = String((r.id as unknown) ?? idx)
              const date = (r.timestamp as string) || (r.created_at as string) || (r.date as string)
              const amt =
                (r.total_amount as number | string) ??
                (r.amount as number | string) ??
                (r.total as number | string) ??
                (r.value as number | string)
              const currency = (r.currency as string) || undefined
              const amount = currency != null && amt != null ? `${amt} ${currency}` : amt
              const category = (r.category as string) ?? null
              const merchant =
                (r.provider as string) ??
                (r.merchant as string) ??
                (r.vendor as string) ??
                (r.payee as string) ??
                null
              const note =
                (r.notes as string) ??
                (r.description as string) ??
                (r.name as string) ??
                (r.note as string) ??
                (r.memo as string) ??
                null
              return { id, date, amount, category, merchant, note }
            })
          }
          return list
        })()

        try {
          const list = await incomeInflight
          if (!cancelled && list) {
            setIncome(list)
            if (!incomeCache[user.id]) incomeCache[user.id] = {}
            incomeCache[user.id][envKey] = list
          }
        } finally {
          incomeInflight = null
        }
      } catch (e) {
        if (!cancelled) setIncomeError('Failed to load income')
      } finally {
        if (!cancelled) setLoadingIncome(false)
      }
    }

    void loadIncome()
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
              <TabsTrigger
                value="bills"
                backgroundColor="transparent"
                color={pageFg}
                _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
                css={{ '&[data-selected=true]': { backgroundColor: darkMode ? '#3a3a3a' : '#eaeaea', color: pageFg } }}
                onClick={() => setActiveTab('bills')}
              >
                Bills
              </TabsTrigger>
              <TabsTrigger
                value="income"
                backgroundColor="transparent"
                color={pageFg}
                _hover={{ backgroundColor: darkMode ? 'gray.700' : 'gray.100' }}
                css={{ '&[data-selected=true]': { backgroundColor: darkMode ? '#3a3a3a' : '#eaeaea', color: pageFg } }}
                onClick={() => setActiveTab('income')}
              >
                Income
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

            <TabsContent value="income">
              <Stack gap={3}>
                {incomeError && (
                  <Box
                    borderWidth="1px"
                    borderColor={borderCol}
                    borderRadius="md"
                    p={3}
                    backgroundColor={darkMode ? '#3a2a2a' : '#fff5f5'}
                  >
                    <Text color={darkMode ? 'red.200' : 'red.700'}>{incomeError}</Text>
                  </Box>
                )}

                <Box borderWidth="1px" borderColor={borderCol} borderRadius="md" overflowX="auto">
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>ID</Table.ColumnHeader>
                        <Table.ColumnHeader>Date</Table.ColumnHeader>
                        <Table.ColumnHeader>Source</Table.ColumnHeader>
                        <Table.ColumnHeader>Category</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="right">Amount</Table.ColumnHeader>
                        <Table.ColumnHeader>Note</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {loadingIncome ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>Loading...</Table.Cell>
                        </Table.Row>
                      ) : income.length === 0 ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>No income found</Table.Cell>
                        </Table.Row>
                      ) : (
                        income.map((it) => (
                          <Table.Row key={it.id}>
                            <Table.Cell>{it.id}</Table.Cell>
                            <Table.Cell>{it.date ?? '—'}</Table.Cell>
                            <Table.Cell>{it.merchant ?? '—'}</Table.Cell>
                            <Table.Cell>{it.category ?? '—'}</Table.Cell>
                            <Table.Cell textAlign="right">{it.amount ?? '—'}</Table.Cell>
                            <Table.Cell>{it.note ?? '—'}</Table.Cell>
                          </Table.Row>
                        ))
                      )}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Stack>
            </TabsContent>

            <TabsContent value="bills">
              <Stack gap={3}>
                {billsError && (
                  <Box
                    borderWidth="1px"
                    borderColor={borderCol}
                    borderRadius="md"
                    p={3}
                    backgroundColor={darkMode ? '#3a2a2a' : '#fff5f5'}
                  >
                    <Text color={darkMode ? 'red.200' : 'red.700'}>{billsError}</Text>
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
                      {loadingBills ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>Loading...</Table.Cell>
                        </Table.Row>
                      ) : bills.length === 0 ? (
                        <Table.Row>
                          <Table.Cell colSpan={6}>No bills found</Table.Cell>
                        </Table.Row>
                      ) : (
                        bills.map((it) => (
                          <Table.Row key={it.id}>
                            <Table.Cell>{it.id}</Table.Cell>
                            <Table.Cell>{it.date ?? '—'}</Table.Cell>
                            <Table.Cell>{it.merchant ?? '—'}</Table.Cell>
                            <Table.Cell>{it.category ?? '—'}</Table.Cell>
                            <Table.Cell textAlign="right">{it.amount ?? '—'}</Table.Cell>
                            <Table.Cell>{it.note ?? '—'}</Table.Cell>
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
