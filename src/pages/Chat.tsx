import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
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
import LogoutButton from '../components/auth/LogoutButton'
import ResponsiveImage from '../components/ui/ResponsiveImage'
import { useTheme } from 'next-themes'
import { openaiClient } from '../service/api/openai'
import { n8nClient } from '../service/api/n8n'
import type { OpenAIChatMessage, OpenAIContentPart } from '../service/api/openai'
import { useAuth } from '../contexts/AuthContext'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
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

function MessageBubble(props: { message: ChatMessage }) {
  const { message } = props

  const isUser = message.role === 'user'

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'}>
      <Box
        maxW={useBreakpointValue({ base: '95%', sm: '85%', md: '70%', lg: '60%' })}
        borderRadius="lg"
        p={useBreakpointValue({ base: 4, md: 3 })}
        fontSize={useBreakpointValue({ base: 'md', md: 'sm' })}
        {...(isUser
          ? { colorPalette: 'blue', bg: 'colorPalette.solid', color: 'colorPalette.contrast' }
          : { bg: 'bg.subtle', color: 'fg' })}
      >
        {isUser ? (
          <Text whiteSpace="pre-wrap">{message.content}</Text>
        ) : (
          <Box>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              skipHtml
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                img: ({ node, ...props }) => (
                  // Prevent referrer leakage and lazy-load images
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img {...props} referrerPolicy="no-referrer" loading="lazy" />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </Box>
        )}
        {message.images && message.images.length > 0 && (
          <HStack gap={useBreakpointValue({ base: 1, md: 2 })} mt={2} wrap="wrap">
            {message.images.map((src, idx) => (
              <ResponsiveImage 
                key={idx} 
                src={src} 
                alt="attachment"
                maxW={{ base: 120, md: 160 }}
                maxH={{ base: 120, md: 160 }}
              />
            ))}
          </HStack>
        )}
      </Box>
    </Flex>
  )
}

export default function ChatPage() {
  const { resolvedTheme } = useTheme()
  const { session } = useAuth()
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
  const [images, setImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [cameraOpen, setCameraOpen] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isSending, setIsSending] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isMobile = useBreakpointValue({ base: true, md: false })
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)

  function extractN8nText(payload: unknown): string {
    // Handle array of items: [{ output: string }] or [{ json: { output: string } }]
    if (Array.isArray(payload)) {
      const first = payload[0] as unknown
      if (first && typeof first === 'object') {
        const obj = first as Record<string, unknown>
        const nested = (obj.output ?? (obj.json as Record<string, unknown> | undefined)?.output)
        if (typeof nested === 'string') return nested
      }
    }
    // Handle object forms
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      if (typeof obj.output === 'string') return obj.output
      if (typeof obj.message === 'string') return obj.message
      const agent = obj.agent_output as unknown
      if (agent && typeof agent === 'object') {
        const ao = agent as Record<string, unknown>
        if (typeof ao.output === 'string') return ao.output
      } else if (typeof agent === 'string') {
        return agent
      }
    }
    // Fallback
    return typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  }

  const currentThread = useMemo(
    () => threads.find((t) => t.id === (currentThreadId || threads[0]?.id)) ?? threads[0],
    [threads, currentThreadId],
  )
  const messages = currentThread?.messages ?? []

  const canSend = useMemo(
    () => (input.trim().length > 0 || images.length > 0) && !isSending,
    [input, images.length, isSending],
  )

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

  function onSelectImages(files: FileList | null) {
    if (!files || files.length === 0) return
    const tasks: Array<Promise<string>> = []
    Array.from(files).forEach((file) => {
      tasks.push(
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        }),
      )
    })
    Promise.all(tasks).then((dataUris) => setImages((prev) => [...prev, ...dataUris]))
  }

  function clearImages() {
    setImages([])
  }

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        window.alert('Camera not supported in this browser')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Some browsers require play() to be called after setting srcObject
        await videoRef.current.play().catch(() => {})
      }
      setCameraOpen(true)
    } catch (err) {
      window.alert('Unable to access camera. Please check permissions.')
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video) return
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setImages((prev) => [...prev, dataUrl])
    closeCamera()
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
      images: images.length > 0 ? images : undefined,
    }

    setInput('')
    setImages([])

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
      const isImageOnly = userMessage.content.trim().length === 0 && (userMessage.images?.length ?? 0) > 0
      if (isImageOnly) {
        // Upload the first image to n8n as multipart/form-data
        const firstImage = userMessage.images![0]
        const blob = await (await fetch(firstImage)).blob()
        const response = await n8nClient.uploadReceipt<unknown>(blob, { 
          filename: 'receipt.jpg',
          additionalFields: {
            userId: session?.user?.id || 'anonymous'
          }
        })

        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: extractN8nText(response),
        }

        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThread.id
              ? { ...t, messages: [...t.messages, assistantMessage], updatedAt: Date.now() }
              : t,
          ),
        )
        return
      }

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
        const history: OpenAIChatMessage[] = messages.map((m) => {
          if (m.images && m.images.length > 0) {
            const content: OpenAIContentPart[] = [
              { type: 'text', text: m.content },
              ...m.images.map((url) => ({ type: 'image_url', image_url: { url } } as const)),
            ]
            return { role: m.role, content }
          }
          return { role: m.role, content: m.content }
        })
        const userContentParts: OpenAIContentPart[] = [
          { type: 'text', text: userMessage.content },
          ...((userMessage.images ?? []).map((url) => ({ type: 'image_url', image_url: { url } } as const))),
        ]
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
          [...history, { role: 'user', content: userContentParts }],
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
      // Ensure camera stream is closed on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
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
          <Box 
            position="absolute" 
            top={0} 
            left={0} 
            h="100%" 
            w={useBreakpointValue({ base: '85%', sm: '75%' })} 
            maxW="20rem" 
            bg={darkMode ? '#1f1f1f' : '#ffffff'} 
            borderRightWidth="1px"
          >
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
        {cameraOpen && (
          <Box position="fixed" inset={0} zIndex={20}>
            <Box position="absolute" inset={0} bg="blackAlpha.700" onClick={closeCamera} />
            <Flex position="absolute" inset={0} align="center" justify="center">
              <Box 
                bg={darkMode ? '#1f1f1f' : '#ffffff'} 
                p={useBreakpointValue({ base: 3, md: 4 })} 
                borderRadius="md" 
                borderWidth="1px" 
                maxW={useBreakpointValue({ base: '95%', sm: '80%', md: 'sm' })} 
                w="full"
                mx={2}
              >
                <Box overflow="hidden" borderRadius="md">
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto' }} />
                </Box>
                <HStack justify="flex-end" mt={3}>
                  <Button onClick={closeCamera} backgroundColor={darkMode ? 'gray.700' : 'gray.300'} color={darkMode ? 'white' : 'black'}>
                    Cancel
                  </Button>
                  <Button onClick={() => void capturePhoto()} backgroundColor={darkMode ? 'black' : 'gray.300'} color={darkMode ? 'white' : 'black'}>
                    Capture
                  </Button>
                </HStack>
              </Box>
            </Flex>
          </Box>
        )}
        <Box borderBottomWidth="1px" bg={pageBg}>
          <Container maxW="4xl" py={useBreakpointValue({ base: 2, md: 4 })} px={useBreakpointValue({ base: 3, md: 6 })}>
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
                  <Heading size={useBreakpointValue({ base: 'sm', md: 'md' })}>{env.appName}</Heading>
                  <Text 
                    fontSize={useBreakpointValue({ base: 'xs', md: 'sm' })}
                    display={useBreakpointValue({ base: 'none', sm: 'block' })}
                  >
                    Chat-style interface to help manage and track your expenses.
                  </Text>
                </Stack>
              </HStack>
              
              <HStack gap={useBreakpointValue({ base: 1, md: 2 })}>
                <LogoutButton />
                <ColorModeToggle />
              </HStack>
            </HStack>
          </Container>
        </Box>

        <Box flex="1" overflowY="auto" ref={scrollRef}>
          <Container maxW="4xl" py={useBreakpointValue({ base: 3, md: 6 })} px={useBreakpointValue({ base: 3, md: 6 })}>
            <Stack gap={4}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </Stack>
          </Container>
        </Box>

        <Box borderTopWidth="1px" bg={pageBg} position="sticky" bottom={0}>
          <Container maxW="4xl" py={useBreakpointValue({ base: 3, md: 4 })} px={useBreakpointValue({ base: 3, md: 6 })}>
            <Stack gap={3}>
            {images.length > 0 && (
              <HStack gap={useBreakpointValue({ base: 1, md: 2 })} wrap="wrap">
                {images.map((src, idx) => (
                  <Box key={idx} position="relative">
                    <ResponsiveImage 
                      src={src} 
                      alt="selected"
                      maxW={{ base: 80, md: 96 }}
                      maxH={{ base: 80, md: 96 }}
                    />
                  </Box>
                ))}
                <Button 
                  onClick={clearImages} 
                  size={useBreakpointValue({ base: 'sm', md: 'xs' })}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'} 
                  color={darkMode ? 'white' : 'black'}
                >
                  Clear attachments
                </Button>
              </HStack>
            )}
              <Textarea
                placeholder="How can I help you today?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                resize="none"
                rows={useBreakpointValue({ base: 2, md: 3 })}
                disabled={isSending}
                bg={pageBg}
                color={pageFg}
                borderColor={borderCol}
                fontSize={useBreakpointValue({ base: 'md', md: 'sm' })}
                minH={useBreakpointValue({ base: '44px', md: 'auto' })}
                _placeholder={{ color: placeholderCol }}
                shadow="sm"
              />
            <HStack justify="space-between" flexWrap={useBreakpointValue({ base: 'wrap', md: 'nowrap' })} gap={useBreakpointValue({ base: 2, md: 0 })}>
              <HStack gap={useBreakpointValue({ base: 1, md: 2 })}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => onSelectImages(e.currentTarget.files)}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => onSelectImages(e.currentTarget.files)}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size={useBreakpointValue({ base: 'md', md: 'sm' })}
                  minH={useBreakpointValue({ base: '44px', md: 'auto' })}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                  color={darkMode ? 'white' : 'black'}
                >
                  Choose Image
                </Button>
                <Button
                  onClick={() => void openCamera()}
                  size={useBreakpointValue({ base: 'md', md: 'sm' })}
                  minH={useBreakpointValue({ base: '44px', md: 'auto' })}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                  color={darkMode ? 'white' : 'black'}
                >
                  Take Photo
                </Button>
              </HStack>
              <Button
                onClick={() => void handleSend()}
                size={useBreakpointValue({ base: 'md', md: 'sm' })}
                minH={useBreakpointValue({ base: '44px', md: 'auto' })}
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

