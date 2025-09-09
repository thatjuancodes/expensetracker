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
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from '@chakra-ui/react'
import { env } from '../config/env'
import { Menu as MenuIcon, ChevronsLeft, ChevronsRight, Edit2, Trash2, MoreVertical, Volume2 } from 'lucide-react'

import ResponsiveImage from '../components/ui/ResponsiveImage'
import AccountMenu from '../components/layout/AccountMenu'
import { useTheme } from 'next-themes'
import { n8nClient } from '../service/api/n8n'
import { useAuth } from '../contexts/AuthContext'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

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

function MessageBubble(props: { message: ChatMessage; messageBubbleMaxW: any; messageBubbleP: any; messageBubbleFontSize: any; imageGap: any }) {
  const { message, messageBubbleMaxW, messageBubbleP, messageBubbleFontSize, imageGap } = props
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'

  const isUser = message.role === 'user'
  const { supported, speaking, speak, stop } = useSpeechSynthesis()

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'}>
      <Box
        maxW={messageBubbleMaxW}
        borderRadius="lg"
        p={messageBubbleP}
        fontSize={messageBubbleFontSize}
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
                  <img 
                    {...props} 
                    referrerPolicy="no-referrer" 
                    loading="lazy"
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                  />
                ),
                p: ({ node, ...props }) => (
                  <p {...props} style={{ margin: '0.5em 0', lineHeight: '1.6' }} />
                ),
                code: ({ node, ...props }) => (
                  <code 
                    {...props} 
                    style={{ 
                      backgroundColor: darkMode ? '#2d3748' : '#f7fafc',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }} 
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            <Flex mt={3} justify="flex-end">
              <TooltipRoot openDelay={200} closeDelay={100} disabled={supported}>
                <TooltipTrigger asChild>
                  <IconButton
                    aria-label={speaking ? 'Stop reading' : 'Read aloud'}
                    size={useBreakpointValue({ base: 'sm', md: 'xs' })}
                    variant="ghost"
                    backgroundColor={speaking ? 'blue.500' : (darkMode ? 'gray.700' : 'gray.300')}
                    color={speaking ? 'white' : (darkMode ? 'white' : 'black')}
                    onClick={() => {
                      if (!supported) return
                      if (speaking) stop()
                      else speak(message.content)
                    }}
                    disabled={!supported}
                    minH={useBreakpointValue({ base: '36px', md: '28px' })}
                    minW={useBreakpointValue({ base: '36px', md: '28px' })}
                  >
                    <Volume2 size={useBreakpointValue({ base: 16, md: 14 })} />
                  </IconButton>
                </TooltipTrigger>
                <TooltipContent>Text-to-speech not supported</TooltipContent>
              </TooltipRoot>
            </Flex>
          </Box>
        )}
        {message.images && message.images.length > 0 && (
          <HStack gap={imageGap} mt={2} wrap="wrap">
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

// DevModeSwitch is provided by AccountMenu

export default function ChatPage() {
  const { resolvedTheme } = useTheme()
  const { session } = useAuth()
  const { supported, speak, voices } = useSpeechSynthesis()
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
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [cameraOpen, setCameraOpen] = useState<boolean>(false)
  const [, setCameraSupported] = useState<boolean>(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isSending, setIsSending] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isMobile = useBreakpointValue({ base: true, md: false })
  
  // Pre-compute all breakpoint values to avoid conditional hook calls
  const messageBubbleMaxW = useBreakpointValue({ base: '90%', sm: '85%', md: '70%', lg: '60%' })
  const messageBubbleP = useBreakpointValue({ base: 5, md: 3 })
  const messageBubbleFontSize = useBreakpointValue({ base: 'md', md: 'sm' })
  const imageGap = useBreakpointValue({ base: 2, md: 2 })
  const mobileWidth = useBreakpointValue({ base: '85%', sm: '75%' })
  const cameraP = useBreakpointValue({ base: 3, md: 4 })
  const cameraMaxW = useBreakpointValue({ base: '95%', sm: '80%', md: 'sm' })
  const headerPy = useBreakpointValue({ base: 2, md: 4 })
  const headerPx = useBreakpointValue({ base: 3, md: 6 })
  const contentPy = useBreakpointValue({ base: 4, md: 6 })
  const contentPx = useBreakpointValue({ base: 4, md: 6 })
  const inputContainerPy = useBreakpointValue({ base: 3, md: 4 })
  const inputContainerPx = useBreakpointValue({ base: 3, md: 6 })
  const inputGap = useBreakpointValue({ base: 1, md: 2 })
  const clearButtonSize = useBreakpointValue({ base: 'sm', md: 'xs' }) as 'xs' | 'sm' | 'md' | 'lg'
  const textareaRows = useBreakpointValue({ base: 2, md: 3 })
  const textareaFontSize = useBreakpointValue({ base: 'md', md: 'sm' })
  const textareaMinH = useBreakpointValue({ base: '44px', md: 'auto' })
  const bottomFlexWrap = useBreakpointValue({ base: 'wrap', md: 'nowrap' })
  const bottomGap = useBreakpointValue({ base: 3, md: 0 })
  const bottomHStackGap = useBreakpointValue({ base: 2, md: 2 })
  const buttonSize = useBreakpointValue({ base: 'md', md: 'sm' }) as 'xs' | 'sm' | 'md' | 'lg'
  const buttonMinH = useBreakpointValue({ base: '48px', md: 'auto' })
  const sendButtonSize = useBreakpointValue({ base: 'md', md: 'sm' }) as 'xs' | 'sm' | 'md' | 'lg'
  const sendButtonMinH = useBreakpointValue({ base: '48px', md: 'auto' })
  
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  
  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem('devMode')
    return saved ? JSON.parse(saved) : false
  })

  const [talkMode, setTalkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('talkMode')
    return saved ? JSON.parse(saved) : false
  })

  const [voiceUri, setVoiceUri] = useState<string | undefined>(() => {
    const saved = localStorage.getItem('talkVoiceUri')
    return saved ? JSON.parse(saved) : undefined
  })

  const handleToggleTalkMode = () => {
    setTalkMode((prev) => {
      const next = !prev
      localStorage.setItem('talkMode', JSON.stringify(next))
      return next
    })
  }

  const selectedVoice = useMemo(() => voices.find((v) => v.voiceURI === voiceUri), [voices, voiceUri])
  const voiceOptions = useMemo(
    () => voices.map((v) => ({ uri: v.voiceURI, label: `${v.name}${v.lang ? ` (${v.lang})` : ''}` })),
    [voices],
  )
  const handleSelectVoiceUri = (uri: string) => {
    setVoiceUri(uri || undefined)
    localStorage.setItem('talkVoiceUri', JSON.stringify(uri || ''))
  }

  const handleDevModeToggle = () => {
    setDevMode((prev: boolean) => {
      const newValue = !prev
      localStorage.setItem('devMode', JSON.stringify(newValue))
      return newValue
    })
  }

  

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
  const canSendVoice = useMemo(() => !!audioFile && !isSending && !isRecording, [audioFile, isSending, isRecording])

  useEffect(() => {
    // Persist threads & selection
    localStorage.setItem('chatThreadsV1', JSON.stringify(threads))
    if (currentThread?.id) localStorage.setItem('currentThreadIdV1', currentThread.id)
  }, [threads, currentThread?.id])

  useEffect(() => {
    // Auto-scroll to the latest message
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Auto-narrate the latest assistant message when talkMode is enabled
  useEffect(() => {
    if (!supported || !talkMode) return
    const last = messages[messages.length - 1]
    if (last && last.role === 'assistant' && last.content) {
      speak(last.content, { voice: selectedVoice })
    }
  }, [messages, supported, talkMode, speak, selectedVoice])

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

  function clearAudio() {
    setAudioFile(null)
  }

  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        window.alert('Microphone not supported in this browser')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        setAudioFile(file)
        // cleanup stream
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop())
          audioStreamRef.current = null
        }
        mediaRecorderRef.current = null
        audioChunksRef.current = []
        setIsRecording(false)
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      window.alert('Unable to access microphone. Please check permissions.')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      // ensure cleanup if no recorder
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop())
        audioStreamRef.current = null
      }
      setIsRecording(false)
    }
  }

  async function openCamera() {
    try {
      // Check for HTTPS requirement
      if (window.window.location.protocol !== 'https:' && window.window.location.hostname !== 'localhost') {
        window.alert('Camera requires HTTPS connection. Please use a secure connection.')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        // Fallback to file input if camera API not supported
        window.alert('Camera API not supported. Please use "Choose Image" instead.')
        return
      }

      // Try multiple camera constraint configurations for better Android compatibility
      const constraintOptions = [
        // Prefer rear camera with flexible constraints
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        // Fallback to any rear camera
        { video: { facingMode: 'environment' } },
        // Fallback to front camera
        { video: { facingMode: 'user' } },
        // Fallback to any camera
        { video: true }
      ]

      let stream = null
      let lastError = null

      for (const constraints of constraintOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch (err) {
          lastError = err
          console.warn('Camera constraint failed:', constraints, err)
        }
      }

      if (!stream) {
        // Handle specific error types
        if (lastError instanceof Error) {
          if (lastError.name === 'NotAllowedError') {
            window.alert('Camera permission denied. Please allow camera access and try again.')
          } else if (lastError.name === 'NotFoundError') {
            window.alert('No camera found on this device. Please use "Choose Image" instead.')
          } else if (lastError.name === 'NotReadableError') {
            window.alert('Camera is busy or unavailable. Please close other apps using the camera and try again.')
          } else {
            window.alert(`Camera error: ${lastError.message}. Please try "Choose Image" instead.`)
          }
        } else {
          window.alert('Unable to access camera. Please use "Choose Image" instead.')
        }
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Enhanced play handling for mobile browsers
        try {
          // Set video attributes for better mobile support
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.setAttribute('autoplay', 'true')
          videoRef.current.setAttribute('muted', 'true')
          
          await videoRef.current.play()
        } catch (playError) {
          console.warn('Video play failed:', playError)
          // Continue anyway, many browsers will auto-play
        }
      }
      setCameraOpen(true)
    } catch (err) {
      console.error('Camera setup error:', err)
      window.alert('Unexpected camera error. Please use "Choose Image" instead.')
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
    if (!video) {
      window.alert('Video not ready. Please wait for camera to load.')
      return
    }

    try {
      // Wait for video metadata to load if not ready
      if (video.readyState < 2) {
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve
          setTimeout(resolve, 2000) // Timeout after 2 seconds
        })
      }

      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      
      if (width === 0 || height === 0) {
        window.alert('Camera not ready. Please wait a moment and try again.')
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        window.alert('Unable to create image canvas.')
        return
      }

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, width, height)
      
      // Convert to blob for better mobile compatibility
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader()
          reader.onload = () => {
            if (reader.result) {
              setImages((prev) => [...prev, reader.result as string])
              closeCamera()
            }
          }
          reader.readAsDataURL(blob)
        } else {
          // Fallback to dataURL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
          setImages((prev) => [...prev, dataUrl])
          closeCamera()
        }
      }, 'image/jpeg', 0.9)
      
    } catch (err) {
      console.error('Photo capture error:', err)
      window.alert('Failed to capture photo. Please try again.')
    }
  }

  async function handleSendVoice() {
    if (!audioFile || isSending) return
    const fileToUpload = audioFile
    const filename = fileToUpload.name || 'voice.webm'

    // Create a synthetic user message describing the voice submission
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: `(Voice message) ${filename}`,
    }

    setAudioFile(null)

    setThreads((prev) =>
      prev.map((t) =>
        t.id === currentThread.id
          ? {
              ...t,
              title: t.title === 'New chat' ? `Voice: ${filename}`.slice(0, 40) : t.title,
              messages: [...t.messages, userMessage],
              updatedAt: Date.now(),
            }
          : t,
      ),
    )

    setIsSending(true)
    try {
      const response = await n8nClient.uploadReceipt<unknown>(fileToUpload, {
        filename,
        additionalFields: {
          userId: session?.user?.id || 'anonymous',
        },
        uploadUrl: audioUrl,
      })

      const content = extractN8nText(response) || `Voice uploaded: ${filename}`
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content,
      }
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThread.id
            ? { ...t, messages: [...t.messages, assistantMessage], updatedAt: Date.now() }
            : t,
        ),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThread.id
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  { id: generateMessageId(), role: 'assistant', content: `Voice error: ${message}` },
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

  const uploadUrl = devMode
    ? 'https://homemakr.app.n8n.cloud/webhook-test/upload'
    : 'https://homemakr.app.n8n.cloud/webhook/upload'

  const promptUrl = devMode
    ? 'https://homemakr.app.n8n.cloud/webhook-test/prompt'
    : 'https://homemakr.app.n8n.cloud/webhook/prompt'

  const audioUrl = devMode
    ? 'https://homemakr.app.n8n.cloud/webhook-test/audio'
    : 'https://homemakr.app.n8n.cloud/webhook/audio'

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
          },
          uploadUrl
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
        // Send text-only message to n8n endpoint
        const response = await fetch(promptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: session?.user?.id || 'anonymous',
            messages: [{ role: 'user', content: userMessage.content }],
          }),
        })

        if (!response.ok) {
          throw new Error(`n8n error ${response.status}: ${await response.text()}`)
        }

        const responseData = await response.json()
        const content = responseData.output || extractN8nText(responseData)
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content,
        }

        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThread.id
              ? { ...t, messages: [...t.messages, assistantMessage], updatedAt: Date.now() }
              : t,
          ),
        )
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
    // Check camera support on component mount
    const checkCameraSupport = () => {
      const hasUserMedia = !!(navigator.mediaDevices?.getUserMedia)
      const isSecure = window.window.location.protocol === 'https:' || window.window.location.hostname === 'localhost'
      setCameraSupported(hasUserMedia && isSecure)
    }
    
    checkCameraSupport()
    
    return () => {
      abortRef.current?.abort()
      // Ensure camera stream is closed on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      // Ensure audio stream is closed on unmount
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop())
        audioStreamRef.current = null
      }
    }
  }, [])


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
      {/* Desktop collapsed sidebar button */}
      {!isMobile && sidebarCollapsed && (
        <Box position="fixed" top={4} left={4} zIndex={20}>
          <IconButton
            aria-label="Open sidebar"
            variant="ghost"
            size="md"
            backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            onClick={() => setSidebarCollapsed(false)}
          >
            <MenuIcon size={18} />
          </IconButton>
        </Box>
      )}

      {/* Mobile menu button */}
      {isMobile && (
        <Box position="fixed" top={4} left={4} zIndex={10}>
          <IconButton
            aria-label="Open sidebar"
            variant="ghost"
            size="lg"
            backgroundColor={darkMode ? 'black' : 'gray.300'}
            color={darkMode ? 'white' : 'black'}
            onClick={() => setSidebarOpen(true)}
            minH="44px"
            minW="44px"
          >
            <MenuIcon size={20} />
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
        h="100vh"
        transition="width 0.2s ease"
        overflowX="hidden"
        position="fixed"
        top={0}
        left={0}
        zIndex={5}
      >
        {/* App Title and Description */}
        <Box p={3} borderBottomWidth="1px" borderColor={borderCol}>
          <Stack gap={1}>
            <Heading size="sm" color={pageFg}>{env.appName}</Heading>
            <Text fontSize="xs" color={darkMode ? 'gray.300' : 'gray.600'}>
              Chat-style interface to help manage and track your expenses.
            </Text>
          </Stack>
        </Box>

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

          <Stack gap={1} overflowY="auto" maxH="calc(100dvh - 240px)">
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
            showTalkMode
            talkMode={talkMode}
            onToggleTalkMode={handleToggleTalkMode}
            showVoicePicker
            voiceOptions={voiceOptions}
            selectedVoiceUri={voiceUri}
            onSelectVoiceUri={handleSelectVoiceUri}
          />
        </Box>
      </Box>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
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
            w={mobileWidth} 
            maxW="22rem" 
            bg={darkMode ? '#1f1f1f' : '#ffffff'} 
            borderRightWidth="1px"
            borderRightColor={borderCol}
            overflowY="hidden"
            display="flex"
            flexDirection="column"
            shadow="2xl"
            transform="translateX(0)"
            transition="transform 0.3s ease"
          >
            {/* App Title and Description */}
            <Box p={3} borderBottomWidth="1px" borderColor={borderCol}>
              <Stack gap={1}>
                <Heading size="sm" color={pageFg}>{env.appName}</Heading>
                <Text fontSize="xs" color={darkMode ? 'gray.300' : 'gray.600'}>
                  Chat-style interface to help manage and track your expenses.
                </Text>
              </Stack>
            </Box>

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
            <Box p={3} flex="1" display="flex" flexDirection="column" minH={0}>
                <Button
                  onClick={createNewThread}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                  color={darkMode ? 'white' : 'black'}
                  w="full"
                  mb={3}
                  size="lg"
                  minH="48px"
                >
                New chat
              </Button>

              <Stack gap={1} overflowY="auto" flex="1">
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
                        minH="44px"
                        backgroundColor={selected ? (darkMode ? '#3a3a3a' : '#eaeaea') : 'transparent'}
                        color={selected ? (darkMode ? 'white' : 'black') : pageFg}
                        _hover={{
                          backgroundColor: selected ? (darkMode ? '#3a3a3a' : '#eaeaea') : (darkMode ? 'gray.700' : 'gray.100')
                        }}
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

            {/* Account Information Section - Mobile */}
            <Box 
              borderTopWidth="1px" 
              borderColor={borderCol}
              p={3}
              bg={darkMode ? '#1f1f1f' : '#ffffff'}
              flexShrink={0}
            >
              <AccountMenu
                darkMode={darkMode}
                pageFg={pageFg}
                borderCol={borderCol}
                devMode={devMode}
                onToggleDevMode={handleDevModeToggle}
                onAdminNavigate={() => setSidebarOpen(false)}
                showTalkMode
                talkMode={talkMode}
                onToggleTalkMode={handleToggleTalkMode}
                showVoicePicker
                voiceOptions={voiceOptions}
                selectedVoiceUri={voiceUri}
                onSelectVoiceUri={handleSelectVoiceUri}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Main content */}
      <Flex 
        direction="column" 
        flex="1" 
        ml={{ base: 0, md: sidebarCollapsed ? 0 : 72 }}
        transition="margin-left 0.2s ease"
      >
        {cameraOpen && (
          <Box position="fixed" inset={0} zIndex={20}>
            <Box position="absolute" inset={0} bg="blackAlpha.700" onClick={closeCamera} />
            <Flex position="absolute" inset={0} align="center" justify="center">
              <Box 
                bg={darkMode ? '#1f1f1f' : '#ffffff'} 
                p={cameraP} 
                borderRadius="md" 
                borderWidth="1px" 
                maxW={cameraMaxW} 
                w="full"
                mx={2}
              >
                <Box overflow="hidden" borderRadius="md" position="relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ 
                      width: '100%', 
                      height: 'auto',
                      maxHeight: '60vh',
                      objectFit: 'cover'
                    }} 
                  />
                  {/* Loading indicator for slow cameras */}
                  <Box 
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg="blackAlpha.700"
                    color="white"
                    px={3}
                    py={2}
                    borderRadius="md"
                    fontSize="sm"
                    opacity={(videoRef.current?.readyState ?? 0) < 2 ? 1 : 0}
                    transition="opacity 0.3s"
                    pointerEvents="none"
                  >
                    Loading camera...
                  </Box>
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
        {/* Header with proper mobile spacing */}
        <Box borderBottomWidth="1px" bg={pageBg}>
          <Container maxW="4xl" py={headerPy} px={headerPx}>
            <Box pl={isMobile ? '60px' : '0'} pr={isMobile ? '16px' : '0'}>
              <HStack justify="center" align="center" minH={isMobile ? '60px' : 'auto'}>
                {/* Centered content on mobile, accounting for fixed menu button */}
              </HStack>
            </Box>
          </Container>
        </Box>

        <Box flex="1" overflowY="auto" ref={scrollRef}>
          <Container maxW="4xl" py={contentPy} px={contentPx}>
            <Stack gap={useBreakpointValue({ base: 6, md: 4 })}>
              {messages.map((message) => (
                <MessageBubble 
                  key={message.id} 
                  message={message} 
                  messageBubbleMaxW={messageBubbleMaxW}
                  messageBubbleP={messageBubbleP}
                  messageBubbleFontSize={messageBubbleFontSize}
                  imageGap={imageGap}
                />
              ))}
            </Stack>
          </Container>
        </Box>

        <Box borderTopWidth="1px" bg={pageBg} position="sticky" bottom={0}>
          <Container maxW="4xl" py={inputContainerPy} px={inputContainerPx}>
            <Stack gap={3}>
            {images.length > 0 && (
              <HStack gap={inputGap} wrap="wrap">
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
                  size={clearButtonSize}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'} 
                  color={darkMode ? 'white' : 'black'}
                >
                  Clear attachments
                </Button>
              </HStack>
            )}
            {audioFile && (
              <HStack gap={inputGap} wrap="wrap">
                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                  bg={pageBg}
                  borderColor={borderCol}
                >
                  <Text fontSize="sm" color={pageFg}>
                    Selected audio: {audioFile.name}
                  </Text>
                </Box>

                <Button 
                  onClick={clearAudio} 
                  size={clearButtonSize}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'} 
                  color={darkMode ? 'white' : 'black'}
                >
                  Clear audio
                </Button>
              </HStack>
            )}
            {isRecording && (
              <HStack gap={inputGap} wrap="wrap">
                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                  bg={pageBg}
                  borderColor={borderCol}
                >
                  <Text fontSize="sm" color={pageFg}>
                    Recording... tap Stop to finish
                  </Text>
                </Box>
              </HStack>
            )}
              <Textarea
                placeholder="How can I help you today?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                resize="none"
                rows={textareaRows}
                disabled={isSending}
                bg={pageBg}
                color={pageFg}
                borderColor={borderCol}
                fontSize={textareaFontSize}
                minH={textareaMinH}
                _placeholder={{ color: placeholderCol }}
                shadow="sm"
                _focus={{
                  borderColor: darkMode ? 'blue.400' : 'blue.500',
                  boxShadow: `0 0 0 1px ${darkMode ? '#63b3ed' : '#3182ce'}`
                }}
              />
            {isMobile ? (
              <Stack gap={3}>
                {/* Input controls row 1 */}
                <HStack gap={bottomHStackGap} wrap="wrap">
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
                    size={buttonSize}
                    minH={buttonMinH}
                    flex="1"
                    backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                    color={darkMode ? 'white' : 'black'}
                  >
                    📁 Choose
                  </Button>
                  {/* Camera button with fallback */}
                  <Button
                    onClick={() => {
                      // Check if camera API is available and supported
                      if (!!navigator.mediaDevices?.getUserMedia && 
                          (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
                        void openCamera()
                      } else {
                        // Fallback to file input with camera capture
                        cameraInputRef.current?.click()
                      }
                    }}
                    size={buttonSize}
                    minH={buttonMinH}
                    flex="1"
                    backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                    color={darkMode ? 'white' : 'black'}
                  >
                    📷 Photo
                  </Button>
                </HStack>
                
                {/* Input controls row 2 */}
                <HStack gap={bottomHStackGap}>
                  {!isRecording ? (
                    <Button
                      onClick={() => void startRecording()}
                      size={buttonSize}
                      minH={buttonMinH}
                      flex="1"
                      backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                      color={darkMode ? 'white' : 'black'}
                      disabled={isSending}
                    >
                      🎤 Record
                    </Button>
                  ) : (
                    <Button
                      onClick={() => stopRecording()}
                      size={buttonSize}
                      minH={buttonMinH}
                      flex="1"
                      backgroundColor={darkMode ? 'red.600' : 'red.300'}
                      color={darkMode ? 'white' : 'black'}
                    >
                      ⏹️ Stop
                    </Button>
                  )}
                  {audioFile ? (
                    <Button
                      onClick={() => void handleSendVoice()}
                      size={sendButtonSize}
                      minH={sendButtonMinH}
                      flex="1"
                      backgroundColor={darkMode ? 'blue.600' : 'blue.300'}
                      color={darkMode ? 'white' : 'black'}
                      disabled={!canSendVoice}
                    >
                      🔊 Send Voice
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void handleSend()}
                      size={sendButtonSize}
                      minH={sendButtonMinH}
                      flex="1"
                      backgroundColor={darkMode ? 'blue.600' : 'blue.300'}
                      color={darkMode ? 'white' : 'black'}
                      disabled={!canSend}
                    >
                      ➤ Send
                    </Button>
                  )}
                </HStack>
              </Stack>
            ) : (
              <HStack justify="space-between" flexWrap={bottomFlexWrap} gap={bottomGap}>
                <HStack gap={bottomHStackGap}>
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
                    size={buttonSize}
                    minH={buttonMinH}
                    backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                    color={darkMode ? 'white' : 'black'}
                  >
                    Choose Image
                  </Button>
                  {/* Camera button with fallback */}
                  <Button
                    onClick={() => {
                      // Check if camera API is available and supported
                      if (!!navigator.mediaDevices?.getUserMedia && 
                          (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
                        void openCamera()
                      } else {
                        // Fallback to file input with camera capture
                        cameraInputRef.current?.click()
                      }
                    }}
                    size={buttonSize}
                    minH={buttonMinH}
                    backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                    color={darkMode ? 'white' : 'black'}
                  >
                    Take Photo
                  </Button>
                  {!isRecording ? (
                    <Button
                      onClick={() => void startRecording()}
                      size={buttonSize}
                      minH={buttonMinH}
                      backgroundColor={darkMode ? 'gray.700' : 'gray.300'}
                      color={darkMode ? 'white' : 'black'}
                      disabled={isSending}
                    >
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      onClick={() => stopRecording()}
                      size={buttonSize}
                      minH={buttonMinH}
                      backgroundColor={darkMode ? 'red.600' : 'red.300'}
                      color={darkMode ? 'white' : 'black'}
                    >
                      Stop Recording
                    </Button>
                  )}
                </HStack>
                <HStack gap={bottomHStackGap}>
                  <Button
                    onClick={() => void handleSend()}
                    size={sendButtonSize}
                    minH={sendButtonMinH}
                    backgroundColor={darkMode ? 'blue.600' : 'blue.300'}
                    color={darkMode ? 'white' : 'black'}
                    disabled={!canSend}
                  >
                    Send
                  </Button>
                  <Button
                    onClick={() => void handleSendVoice()}
                    size={sendButtonSize}
                    minH={sendButtonMinH}
                    backgroundColor={darkMode ? 'blue.600' : 'blue.300'}
                    color={darkMode ? 'white' : 'black'}
                    disabled={!canSendVoice}
                  >
                    Send Voice
                  </Button>
                </HStack>
              </HStack>
            )}
            </Stack>
          </Container>
        </Box>
        {devMode && (
          <Box
            position="fixed"
            bottom={4}
            right={4}
            zIndex={30}
            backgroundColor="orange.500"
            color="white"
            px={3}
            py={1}
            borderRadius="full"
            borderWidth="1px"
            borderColor={darkMode ? 'orange.300' : 'orange.600'}
            shadow="lg"
          >
            DEV MODE
          </Box>
        )}
      </Flex>
    </Flex>
  )
}

