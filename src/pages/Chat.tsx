import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
  Textarea,
  useBreakpointValue,
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuPositioner,
  Portal,
} from '@chakra-ui/react'
import { env } from '../config/env'
import { Moon, Sun, Menu as MenuIcon, ChevronsLeft, ChevronsRight, Edit2, Trash2, MoreVertical } from 'lucide-react'
import { useTheme } from 'next-themes'
import { openaiClient } from '../service/api/openai'
import type { OpenAIChatMessage } from '../service/api/openai'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
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

function MessageBubble(props: { message: ChatMessage }) {
  const { message } = props

  const isUser = message.role === 'user'

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'}>
      <Box
        maxW={useBreakpointValue({ base: '90%', md: '70%', lg: '60%' })}
        borderRadius="lg"
        p={3}
        {...(isUser
          ? { colorPalette: 'blue', bg: 'colorPalette.solid', color: 'colorPalette.contrast' }
          : { bg: 'bg.subtle', color: 'fg' })}
      >
        <Text whiteSpace="pre-wrap">{message.content}</Text>
      </Box>
    </Flex>
  )
}

export default function ChatPage() {
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'
  const pageBg = darkMode ? '#2e2e2e' : '#f4f4f4'
  const pageFg = darkMode ? 'white' : 'gray.900'
  const borderCol = darkMode ? 'gray.600' : 'gray.400'
  const placeholderCol = darkMode ? 'gray.300' : 'gray.600'
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const saved = localStorage.getItem('chatThreadsV1')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatThread[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {}
    }
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
  })

  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    const saved = localStorage.getItem('currentThreadIdV1')
    if (saved) return saved
    return ''
  })

  const [input, setInput] = useState<string>('')

  const [isSending, setIsSending] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isMobile = useBreakpointValue({ base: true, md: false })
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)

  const currentThread = useMemo(
    () => threads.find((t) => t.id === (currentThreadId || threads[0]?.id)) ?? threads[0],
    [threads, currentThreadId],
  )
  const messages = currentThread?.messages ?? []

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending])

  useEffect(() => {
    // Persist threads & selection
    localStorage.setItem('chatThreadsV1', JSON.stringify(threads))
    if (currentThread?.id) localStorage.setItem('currentThreadIdV1', currentThread.id)
  }, [threads, currentThread?.id])

  useEffect(() => {
    // Auto-scroll to the latest message
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function createNewThread() {
    abortRef.current?.abort()
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
    setInput('')
    setIsSending(false)
    setSidebarOpen(false)
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

  async function handleSend() {
    if (!canSend) return

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
    }

    setInput('')

    setThreads((prev) =>
      prev.map((t) =>
        t.id === currentThread.id
          ? {
              ...t,
              title:
                t.title === 'New chat' && userMessage.content
                  ? userMessage.content.slice(0, 40)
                  : t.title,
              messages: [...t.messages, userMessage],
              updatedAt: Date.now(),
            }
          : t,
      ),
    )

    setIsSending(true)

    try {
      if (!env.useOpenAI) {
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content:
            "Thanks! I'm a placeholder for now. Set VITE_USE_OPENAI=true and add VITE_OPENAI_API_KEY to use OpenAI.",
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThread.id
              ? { ...t, messages: [...t.messages, assistantMessage], updatedAt: Date.now() }
              : t,
          ),
        )
      } else {
        // Stream response from OpenAI
        const history: OpenAIChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))
        const pendingAssistantId = generateMessageId()
        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThread.id
              ? {
                  ...t,
                  messages: [...t.messages, { id: pendingAssistantId, role: 'assistant', content: '' }],
                  updatedAt: Date.now(),
                }
              : t,
          ),
        )

        let accumulated = ''
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        for await (const delta of openaiClient.streamChat(
          [...history, { role: 'user', content: userMessage.content }],
          { model: env.openaiModel, signal: abortRef.current.signal },
        )) {
          accumulated += delta
          setThreads((prev) =>
            prev.map((t) =>
              t.id === currentThread.id
                ? {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === pendingAssistantId ? { ...m, content: accumulated } : m,
                    ),
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThread.id
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  { id: generateMessageId(), role: 'assistant', content: `Error: ${message}` },
                ],
                updatedAt: Date.now(),
              }
            : t,
        ),
      )
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function ColorModeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const dark = resolvedTheme === 'dark'
    return (
      <IconButton
        aria-label="Toggle color mode"
        variant="ghost"
        backgroundColor={dark ? 'black' : 'gray.300'}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
    )
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  function ThreadMenu(props: { darkMode: boolean; onRename: () => void; onDelete: () => void }) {
    const { darkMode, onRename, onDelete } = props
    return (
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Chat actions"
            variant="ghost"
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
          >
            <MoreVertical size={16} />
          </IconButton>
        </MenuTrigger>
        <Portal>
          <MenuPositioner>
            <MenuContent>
              <MenuItem value="rename" onClick={onRename}>
                <HStack gap={2}>
                  <Edit2 size={14} />
                  <Text>Rename</Text>
                </HStack>
              </MenuItem>
              <MenuItem value="delete" onClick={onDelete}>
                <HStack gap={2}>
                  <Trash2 size={14} />
                  <Text>Delete</Text>
                </HStack>
              </MenuItem>
            </MenuContent>
          </MenuPositioner>
        </Portal>
      </MenuRoot>
    )
  }

  return (
    <Flex minH="100dvh" bg={pageBg} color={pageFg}>
      {!isMobile && sidebarCollapsed && (
        <Box position="fixed" top={3} left={3} zIndex={20}>
          <IconButton
            aria-label="Open sidebar"
            variant="ghost"
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            onClick={() => setSidebarCollapsed(false)}
          >
            <MenuIcon size={18} />
          </IconButton>
        </Box>
      )}
      {/* Sidebar - desktop */}
      <Box
        as="aside"
        display={{ base: 'none', md: sidebarCollapsed ? 'none' : 'block' }}
        borderRightWidth="1px"
        bg={darkMode ? '#1f1f1f' : '#ffffff'}
        w={72}
        transition="width 0.2s ease"
        overflowX="hidden"
      >
        <HStack justify="space-between" p={3} borderBottomWidth="1px">
          <Heading size="sm">Chat History</Heading>
          <IconButton
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            variant="ghost"
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </IconButton>
        </HStack>

        <Box p={3}>
          <Button
            onClick={createNewThread}
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            w="full"
            mb={3}
          >
            New chat
          </Button>

          <Stack gap={1} overflowY="auto" maxH="calc(100dvh - 120px)">
            {threads.map((t) => {
              const selected = t.id === currentThread?.id
              return (
                <HStack key={t.id} gap={1} align="center" minW={0}>
                  <Button
                    onClick={() => setCurrentThreadId(t.id)}
                    justifyContent="flex-start"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    flex="1"
                    minW={0}
                    backgroundColor={selected ? (darkMode ? '#3a3a3a' : '#eaeaea') : 'transparent'}
                    color={selected ? (darkMode ? 'white' : 'black') : pageFg}
                  >
                    <Text as="span" overflow="hidden" textOverflow="ellipsis" display="block" maxW="100%">
                      {t.title || 'New chat'}
                    </Text>
                  </Button>
                  <ThreadMenu
                    darkMode={darkMode}
                    onRename={() => renameThread(t.id)}
                    onDelete={() => deleteThread(t.id)}
                  />
                </HStack>
              )
            })}
          </Stack>
        </Box>
      </Box>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <Box position="fixed" inset={0} zIndex={10}>
          <Box position="absolute" inset={0} bg="blackAlpha.600" onClick={() => setSidebarOpen(false)} />
          <Box position="absolute" top={0} left={0} h="100%" w="80%" maxW="18rem" bg={darkMode ? '#1f1f1f' : '#ffffff'} borderRightWidth="1px">
            <HStack justify="space-between" p={3} borderBottomWidth="1px">
              <Heading size="sm">Chat History</Heading>
              <IconButton
                aria-label="Close sidebar"
                variant="ghost"
                backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                color={darkMode ? 'white' : 'black'}
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronsLeft size={18} />
              </IconButton>
            </HStack>
            <Box p={3}>
              <Button
                onClick={createNewThread}
                backgroundColor={darkMode ? 'black' : 'gray.300'}
                color={darkMode ? 'white' : 'black'}
                w="full"
                mb={3}
              >
                New chat
              </Button>
              <Stack gap={1}>
                {threads.map((t) => {
                  const selected = t.id === currentThread?.id
                  return (
                    <HStack key={t.id} gap={1} align="center" minW={0}>
                  <Button
                        onClick={() => {
                          setCurrentThreadId(t.id)
                          setSidebarOpen(false)
                        }}
                        justifyContent="flex-start"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        flex="1"
                    minW={0}
                        backgroundColor={selected ? (darkMode ? '#3a3a3a' : '#eaeaea') : 'transparent'}
                        color={selected ? (darkMode ? 'white' : 'black') : pageFg}
                      >
                        <Text as="span" overflow="hidden" textOverflow="ellipsis" display="block" maxW="100%">
                          {t.title || 'New chat'}
                        </Text>
                      </Button>
                      <ThreadMenu
                        darkMode={darkMode}
                        onRename={() => renameThread(t.id)}
                        onDelete={() => deleteThread(t.id)}
                      />
                    </HStack>
                  )
                })}
              </Stack>
            </Box>
          </Box>
        </Box>
      )}

      {/* Main content */}
      <Flex direction="column" flex="1">
        <Box borderBottomWidth="1px" bg={pageBg}>
          <Container maxW="4xl" py={4}>
            <HStack justify="space-between" align="center">
              <HStack gap={2}>
                {isMobile && (
                  <IconButton
                    aria-label="Open sidebar"
                    variant="ghost"
                    backgroundColor={darkMode ? 'black' : 'gray.300'}
                    color={darkMode ? 'white' : 'black'}
                    onClick={() => setSidebarOpen(true)}
                  >
                    <MenuIcon size={18} />
                  </IconButton>
                )}
                <Stack gap={1}>
                  <Heading size="md">{env.appName}</Heading>
                  <Text fontSize="sm">Chat-style interface to help manage and track your expenses.</Text>
                </Stack>
              </HStack>
              <ColorModeToggle />
            </HStack>
          </Container>
        </Box>

        <Box flex="1" overflowY="auto" ref={scrollRef}>
          <Container maxW="4xl" py={6}>
            <Stack gap={4}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </Stack>
          </Container>
        </Box>

        <Box borderTopWidth="1px" bg={pageBg} position="sticky" bottom={0}>
          <Container maxW="4xl" py={4}>
            <Stack gap={3}>
              <Textarea
                placeholder="How can I help you today?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                resize="none"
                rows={3}
                disabled={isSending}
                bg={pageBg}
                color={pageFg}
                borderColor={borderCol}
                _placeholder={{ color: placeholderCol }}
                shadow="sm"
              />
              <HStack justify="flex-end">
                <Button
                  onClick={() => void handleSend()}
                  backgroundColor={darkMode ? 'black' : 'gray.300'}
                  color={darkMode ? 'white' : 'black'}
                  disabled={!canSend}
                >
                  Send
                </Button>
              </HStack>
            </Stack>
          </Container>
        </Box>
      </Flex>
    </Flex>
  )
}

