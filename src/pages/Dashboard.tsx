import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Flex,
  Heading,
  IconButton,
  Stack,
  Text,
  useBreakpointValue,
  Button,
  Grid,
  HStack,
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuPositioner,
  Portal,
} from '@chakra-ui/react'
import { ChevronsLeft, Edit2, Trash2, MoreVertical } from 'lucide-react'
// import { ArrowLeft, Settings } from 'lucide-react' // Temporarily removed
// import { useTheme } from 'next-themes' // Temporarily removed
import { BudgetOverview } from '../components/dashboard/BudgetOverview'
import { ExpenseStats } from '../components/dashboard/ExpenseStats'
import { QuickActions } from '../components/dashboard/QuickActions'
import { BillsList } from '../components/dashboard/BillsList'
import { IncomeList } from '../components/dashboard/IncomeList'

// Chat-related interfaces and utilities from Chat.tsx
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

interface ChatThread {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Chat Storage utilities (simplified version from Chat.tsx)
class ChatStorage {
  private static readonly STORAGE_KEY = 'chatThreadsV1'
  private static readonly CURRENT_THREAD_KEY = 'currentThreadIdV1'

  static loadThreads(): ChatThread[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ChatThread[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (error) {
      console.error('Failed to load chat threads:', error)
      localStorage.removeItem(this.STORAGE_KEY)
    }

    // Return default thread
    const initial: ChatThread = {
      id: generateMessageId(),
      title: 'New chat',
      messages: [
        {
          id: generateMessageId(),
          role: 'assistant',
          content: "Hi! I'm your AI assistant. Ask me anything to get started.",
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    return [initial]
  }

  static getCurrentThreadId(): string {
    return localStorage.getItem(this.CURRENT_THREAD_KEY) || ''
  }

  static setCurrentThreadId(id: string): void {
    localStorage.setItem(this.CURRENT_THREAD_KEY, id)
  }

  static async saveThreads(threads: ChatThread[]): Promise<boolean> {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(threads))
      return true
    } catch (error) {
      console.error('Failed to save chat threads:', error)
      return false
    }
  }
}

interface BudgetData {
  totalBudget: number
  spent: number
  remaining: number
  monthlyProgress: number
}

interface Bill {
  id: string
  name: string
  amount: number
  category: string
  datePaid: Date
  status: 'paid' | 'pending' | 'overdue'
}

interface IncomeItem {
  id: string
  source: string
  amount: number
  expectedDate: Date
  status: 'pending' | 'received'
}

export default function Dashboard() {
  // const { resolvedTheme } = useTheme() // Temporarily removed
  const darkMode = false
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Chat state management
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    return ChatStorage.loadThreads()
  })
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    return ChatStorage.getCurrentThreadId()
  })
  
  const isMobile = useBreakpointValue({ base: true, md: false })
  
  // Get current thread
  const currentThread = threads.find((t) => t.id === (currentThreadId || threads[0]?.id)) ?? threads[0]
  
  const budgetData: BudgetData = {
    totalBudget: 3500,
    spent: 2180,
    remaining: 1320,
    monthlyProgress: 62
  }

  const bills: Bill[] = [
    {
      id: '1',
      name: 'Netflix Subscription',
      amount: 15.99,
      category: 'Entertainment',
      datePaid: new Date('2024-01-15'),
      status: 'paid'
    },
    {
      id: '2',
      name: 'Electricity Bill',
      amount: 89.50,
      category: 'Utilities',
      datePaid: new Date('2024-01-12'),
      status: 'paid'
    },
    {
      id: '3',
      name: 'Grocery Shopping',
      amount: 156.78,
      category: 'Food',
      datePaid: new Date('2024-01-14'),
      status: 'paid'
    },
    {
      id: '4',
      name: 'Phone Bill',
      amount: 45.00,
      category: 'Utilities',
      datePaid: new Date('2024-01-10'),
      status: 'paid'
    },
    {
      id: '5',
      name: 'Gas Station',
      amount: 67.25,
      category: 'Transportation',
      datePaid: new Date('2024-01-13'),
      status: 'paid'
    }
  ]

  const incomeData: IncomeItem[] = [
    {
      id: '1',
      source: 'Salary - Tech Corp',
      amount: 4200,
      expectedDate: new Date('2024-01-25'),
      status: 'pending'
    },
    {
      id: '2',
      source: 'Freelance Project',
      amount: 800,
      expectedDate: new Date('2024-01-28'),
      status: 'pending'
    },
    {
      id: '3',
      source: 'Investment Dividend',
      amount: 150,
      expectedDate: new Date('2024-01-30'),
      status: 'pending'
    }
  ]

  const handleGoBack = () => {
    window.location.hash = '#/'
  }

  const handleOpenSidebar = () => {
    setSidebarOpen(true)
  }

  // Chat thread management functions
  function createNewThread() {
    const thread: ChatThread = {
      id: generateMessageId(),
      title: 'New chat',
      messages: [
        {
          id: generateMessageId(),
          role: 'assistant',
          content: "Hi! I'm your AI assistant. Ask me anything to get started.",
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setThreads((prev) => [thread, ...prev])
    setCurrentThreadId(thread.id)
    setSidebarOpen(false)
    window.location.hash = '#/'
  }

  function renameThread(threadId: string) {
    const thread = threads.find((t) => t.id === threadId)
    const nextTitle = window.prompt('Rename chat', thread?.title ?? 'New chat')
    if (nextTitle && nextTitle.trim().length > 0) {
      const title = nextTitle.trim()
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title, updatedAt: Date.now() } : t)),
      )
    }
  }

  function deleteThread(threadId: string) {
    const ok = window.confirm('Delete this chat? This cannot be undone.')
    if (!ok) return
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== threadId)
      // Adjust current selection
      if (threadId === currentThread?.id) {
        if (next.length > 0) {
          setCurrentThreadId(next[0].id)
        } else {
          // Create a fresh initial thread if none left
          const fresh: ChatThread = {
            id: generateMessageId(),
            title: 'New chat',
            messages: [
              {
                id: generateMessageId(),
                role: 'assistant',
                content: "Hi! I'm your AI assistant. Ask me anything to get started.",
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          setCurrentThreadId(fresh.id)
          return [fresh]
        }
      }
      return next
    })
  }

  // Thread menu component
  function ThreadMenu(props: { onRename: () => void; onDelete: () => void }) {
    const { onRename, onDelete } = props
    return (
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Chat actions"
            variant="ghost"
            size="xs"
            backgroundColor="gray.100"
            color="gray.600"
            _hover={{ backgroundColor: 'gray.200' }}
          >
            <MoreVertical size={14} />
          </IconButton>
        </MenuTrigger>
        <Portal>
          <MenuPositioner>
            <MenuContent>
              <MenuItem value="rename" onClick={onRename}>
                <HStack gap={2}>
                  <Edit2 size={12} />
                  <Text fontSize="sm">Rename</Text>
                </HStack>
              </MenuItem>
              <MenuItem value="delete" onClick={onDelete}>
                <HStack gap={2}>
                  <Trash2 size={12} />
                  <Text fontSize="sm">Delete</Text>
                </HStack>
              </MenuItem>
            </MenuContent>
          </MenuPositioner>
        </Portal>
      </MenuRoot>
    )
  }

  // Persist changes to localStorage
  useEffect(() => {
    const saveData = async () => {
      await ChatStorage.saveThreads(threads)
      if (currentThread?.id) {
        ChatStorage.setCurrentThreadId(currentThread.id)
      }
    }
    saveData()
  }, [threads, currentThread?.id])

  return (
    <Box
      w="full" 
      maxW="sm" 
      mx="auto" 
      minH="100vh" 
      bgGradient="linear(to-br, blue.50, indigo.100)"
    >
      {/* Header - Fixed at top */}
      <Box
        position="fixed"
        top={0}
        left="50%"
        transform="translateX(-50%)"
        w="full"
        maxW="sm"
        bg="white"
        shadow="xs"
        px={4}
        py={4}
        zIndex={10}
      >
        <Flex align="center" justify="space-between">
          <Box>
            <Heading size="md" fontWeight="bold" color="gray.900">
              Expense Tracker
            </Heading>
            <Text fontSize="xs" color="gray.500">
              January 2024
            </Text>
          </Box>
          <IconButton
            aria-label="Open chat history"
            variant="ghost"
            onClick={handleOpenSidebar}
            _hover={{ bg: 'gray.100' }}
            borderRadius="full"
            p={2}
          >
            <Text fontSize="lg" color="gray.600">⚙️</Text>
          </IconButton>
        </Flex>
      </Box>

      {/* Content with top padding to avoid header overlap */}
      <Box pt="20" pb={6}>
        {/* Budget Overview */}
        <Box px={4} py={4}>
          <BudgetOverview data={budgetData} />
        </Box>

        {/* Expense Stats */}
        <Box px={4} pb={4}>
          <ExpenseStats spent={budgetData.spent} budget={budgetData.totalBudget} />
        </Box>

        {/* Tab Navigation */}
        <Box px={4} pb={4}>
          <Box bg="white" borderRadius="xl" p={1} shadow="xs">
            <Grid templateColumns="repeat(3, 1fr)" gap={1}>
              <Button
                onClick={() => setActiveTab('bills')}
                py={2}
                px={2}
                borderRadius="lg"
                fontSize="xs"
                fontWeight="medium"
                backgroundColor={activeTab === 'bills' ? 'blue.500' : 'transparent'}
                color={activeTab === 'bills' ? 'white' : 'gray.600'}
                _hover={{
                  backgroundColor: activeTab === 'bills' ? 'blue.600' : 'gray.50'
                }}
                shadow={activeTab === 'bills' ? 'xs' : 'none'}
                transition="all 0.2s"
              >
                Bills Paid
              </Button>
              <Button
                onClick={() => setActiveTab('income')}
                py={2}
                px={2}
                borderRadius="lg"
                fontSize="xs"
                fontWeight="medium"
                backgroundColor={activeTab === 'income' ? 'blue.500' : 'transparent'}
                color={activeTab === 'income' ? 'white' : 'gray.600'}
                _hover={{
                  backgroundColor: activeTab === 'income' ? 'blue.600' : 'gray.50'
                }}
                shadow={activeTab === 'income' ? 'xs' : 'none'}
                transition="all 0.2s"
              >
                Income
              </Button>
              <Button
                onClick={() => setActiveTab('actions')}
                py={2}
                px={2}
                borderRadius="lg"
                fontSize="xs"
                fontWeight="medium"
                backgroundColor={activeTab === 'actions' ? 'blue.500' : 'transparent'}
                color={activeTab === 'actions' ? 'white' : 'gray.600'}
                _hover={{
                  backgroundColor: activeTab === 'actions' ? 'blue.600' : 'gray.50'
                }}
                shadow={activeTab === 'actions' ? 'xs' : 'none'}
                transition="all 0.2s"
              >
                Actions
              </Button>
            </Grid>
          </Box>
        </Box>

        {/* Tab Content */}
        <Box px={4}>
          {activeTab === 'bills' && <BillsList bills={bills} />}
          {activeTab === 'income' && <IncomeList income={incomeData} />}
          {activeTab === 'actions' && <QuickActions />}
        </Box>
      </Box>

      {/* Sidebar overlay - Mobile and Desktop */}
      {sidebarOpen && (
        <Box position="fixed" inset={0} zIndex={15}>
          <Box 
            position="absolute" 
            inset={0} 
            bg="blackAlpha.600" 
            onClick={() => setSidebarOpen(false)}
            backdropFilter="blur(2px)"
          />
          <Box 
            position="absolute" 
            top={0} 
            left={0} 
            h="100%" 
            w={{ base: "80%", md: "320px" }}
            maxW={{ base: "22rem", md: "320px" }}
            bg="white"
            borderRightWidth="1px"
            borderRightColor="gray.200"
            overflowY="hidden"
            display="flex"
            flexDirection="column"
            shadow="2xl"
            transform="translateX(0)"
            transition="transform 0.3s ease"
          >
            {/* Drawer Header */}
            <Box p={4} borderBottomWidth="1px" borderBottomColor="gray.200">
              <Flex justify="space-between" align="center" mb={3}>
                <Heading size="md" color="gray.900">Chat History</Heading>
                <IconButton
                  aria-label="Close sidebar"
                  variant="ghost"
                  backgroundColor="gray.100"
                  color="gray.600"
                  _hover={{ backgroundColor: 'gray.200' }}
                  borderRadius="full"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ChevronsLeft size={16} />
                </IconButton>
              </Flex>
              <Button
                onClick={() => {
                  window.location.hash = '#/'
                  setSidebarOpen(false)
                }}
                w="full"
                backgroundColor="blue.500"
                color="white"
                _hover={{ backgroundColor: 'blue.600' }}
                size="sm"
                borderRadius="lg"
                mb={2}
              >
                🏠 Back to Chat
              </Button>
              <Button
                onClick={createNewThread}
                w="full"
                variant="outline"
                size="sm"
                borderRadius="lg"
                borderColor="gray.300"
                color="gray.700"
                _hover={{ backgroundColor: 'gray.50' }}
              >
                ➕ New Chat
              </Button>
            </Box>

            {/* Chat History List */}
            <Box flex={1} overflowY="auto" p={2}>
              {threads.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text fontSize="2xl" mb={3} color="gray.300">💬</Text>
                  <Text color="gray.500" fontSize="sm">No chat history yet</Text>
                  <Text color="gray.400" fontSize="xs" mt={1}>
                    Start a conversation to see your chats here
                  </Text>
                </Box>
              ) : (
                <Stack gap={1}>
                  {threads.map((t) => {
                    const selected = t.id === currentThread?.id
                    const lastMessage = t.messages[t.messages.length - 1]
                    const isUserMessage = lastMessage?.role === 'user'
                    
                    return (
                      <Box
                        key={t.id}
                        onClick={() => {
                          setCurrentThreadId(t.id)
                          window.location.hash = '#/'
                          setSidebarOpen(false)
                        }}
                        p={3}
                        borderRadius="lg"
                        cursor="pointer"
                        transition="all 0.2s"
                        bg={selected ? 'blue.50' : 'transparent'}
                        border={selected ? '1px solid' : '1px solid transparent'}
                        borderColor={selected ? 'blue.200' : 'transparent'}
                        _hover={{ 
                          bg: selected ? 'blue.50' : 'gray.50'
                        }}
                        role="group"
                      >
                        <Flex align="start" gap={3}>
                          {/* AI Avatar */}
                          <Box
                            w={8}
                            h={8}
                            borderRadius="full"
                            bg="blue.500"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                          >
                            <Text color="white" fontSize="xs" fontWeight="bold">
                              AI
                            </Text>
                          </Box>
                          
                          <Box flex="1" minW={0}>
                            <Flex justify="space-between" align="center">
                              <Heading 
                                size="sm" 
                                color="gray.900"
                                lineClamp={1}
                                fontSize="sm"
                                fontWeight="medium"
                              >
                                {t.title || 'New chat'}
                              </Heading>
                              <ThreadMenu
                                onRename={() => renameThread(t.id)}
                                onDelete={() => deleteThread(t.id)}
                              />
                            </Flex>
                            
                            {lastMessage && (
                              <Text 
                                fontSize="xs" 
                                color="gray.500"
                                lineClamp={1}
                                mt={1}
                              >
                                {isUserMessage ? '' : 'AI: '}{lastMessage.content.slice(0, 50)}...
                              </Text>
                            )}
                            
                            <Flex justify="space-between" align="center" mt={2}>
                              <Text 
                                fontSize="xs" 
                                color="blue.500" 
                                bg="blue.100"
                                px={2} 
                                py={1} 
                                borderRadius="full"
                              >
                                Assistant
                              </Text>
                              <Text fontSize="xs" color="gray.400">
                                {new Date(t.updatedAt).toLocaleDateString()}
                              </Text>
                            </Flex>
                          </Box>
                        </Flex>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>

            {/* Sidebar Footer */}
            <Box p={4} borderTopWidth="1px" borderTopColor="gray.200">
              <Button
                onClick={() => setSidebarOpen(false)}
                w="full"
                variant="ghost"
                size="sm"
                color="gray.600"
                _hover={{ backgroundColor: 'gray.100' }}
              >
                🗑️ Clear History
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
