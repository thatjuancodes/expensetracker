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
// Using lucide-react icons for consistency
import { env } from '../config/env'
import { Menu as MenuIcon, ChevronsLeft, ChevronsRight, Edit2, Trash2, MoreVertical, Volume2, Camera, Mic } from 'lucide-react'

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

// Storage management utilities
class ChatStorage {
  private static readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB limit
  private static readonly MAX_THREADS = 20 // Maximum number of threads to keep
  private static readonly MAX_MESSAGES_PER_THREAD = 50 // Maximum messages per thread
  private static readonly STORAGE_KEY = 'chatThreadsV1'
  private static readonly CURRENT_THREAD_KEY = 'currentThreadIdV1'

  static getStorageSize(): number {
    let total = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length
      }
    }
    return total
  }

  static isStorageNearLimit(): boolean {
    return this.getStorageSize() > (this.MAX_STORAGE_SIZE * 0.8) // 80% of limit
  }

  static compressImage(dataUrl: string, maxWidth = 800, quality = 0.7): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } else {
          resolve(dataUrl) // Fallback to original
        }
      }
      
      img.onerror = () => resolve(dataUrl) // Fallback to original
      img.src = dataUrl
    })
  }

  static async optimizeImages(images: string[]): Promise<string[]> {
    const optimized: string[] = []
    for (const image of images) {
      if (image.startsWith('data:image/')) {
        try {
          const compressed = await this.compressImage(image)
          optimized.push(compressed)
        } catch {
          optimized.push(image) // Keep original if compression fails
        }
      } else {
        optimized.push(image)
      }
    }
    return optimized
  }

  static trimThreads(threads: ChatThread[]): ChatThread[] {
    // Sort by updatedAt descending and keep only MAX_THREADS
    const sorted = threads.sort((a, b) => b.updatedAt - a.updatedAt)
    return sorted.slice(0, this.MAX_THREADS)
  }

  static trimMessages(thread: ChatThread): ChatThread {
    if (thread.messages.length <= this.MAX_MESSAGES_PER_THREAD) {
      return thread
    }

    // Keep the first message (usually assistant greeting) and the latest messages
    const firstMessage = thread.messages[0]
    const recentMessages = thread.messages.slice(-this.MAX_MESSAGES_PER_THREAD + 1)
    
    return {
      ...thread,
      messages: [firstMessage, ...recentMessages]
    }
  }

  static async saveThreads(threads: ChatThread[]): Promise<boolean> {
    try {
      // Optimize threads before saving
      let optimizedThreads = this.trimThreads(threads)
      optimizedThreads = optimizedThreads.map(thread => this.trimMessages(thread))

      // Optimize images in messages
      for (const thread of optimizedThreads) {
        for (const message of thread.messages) {
          if (message.images && message.images.length > 0) {
            message.images = await this.optimizeImages(message.images)
          }
        }
      }

      const dataString = JSON.stringify(optimizedThreads)
      
      // Check if storage would exceed limit
      if (dataString.length > this.MAX_STORAGE_SIZE) {
        console.warn('Chat data too large, applying aggressive trimming')
        // More aggressive trimming - keep only 10 threads and 20 messages each
        optimizedThreads = optimizedThreads.slice(0, 10).map(thread => ({
          ...thread,
          messages: thread.messages.slice(-20)
        }))
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(optimizedThreads))
      return true
    } catch (error) {
      console.error('Failed to save chat threads:', error)
      
      // Emergency cleanup - try to save just the current thread
      try {
        const currentId = localStorage.getItem(this.CURRENT_THREAD_KEY)
        const currentThread = threads.find(t => t.id === currentId)
        if (currentThread) {
          const trimmed = this.trimMessages(currentThread)
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify([trimmed]))
          return true
        }
      } catch {
        // Complete failure - clear storage
        localStorage.removeItem(this.STORAGE_KEY)
      }
      
      return false
    }
  }

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
      // Clear corrupted data
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

  static getStorageInfo(): { used: number; limit: number; percentage: number } {
    const used = this.getStorageSize()
    const limit = this.MAX_STORAGE_SIZE
    const percentage = Math.round((used / limit) * 100)
    return { used, limit, percentage }
  }

  static exportChats(threads: ChatThread[]): string {
    return JSON.stringify(threads, null, 2)
  }

  static importChats(jsonString: string): ChatThread[] | null {
    try {
      const parsed = JSON.parse(jsonString)
      if (Array.isArray(parsed)) {
        return parsed as ChatThread[]
      }
    } catch {
      // Invalid JSON
    }
    return null
  }
}

function MessageBubble(props: { message: ChatMessage; messageBubbleMaxW: any; imageGap: any }) {
  const { message, messageBubbleMaxW, imageGap } = props
  const { resolvedTheme } = useTheme()
  const darkMode = resolvedTheme === 'dark'

  const isUser = message.role === 'user'
  const { supported, speaking, speak, stop } = useSpeechSynthesis()

  return (
    <Flex justify={isUser ? 'flex-end' : 'flex-start'}>
      <Flex
        direction={isUser ? 'row-reverse' : 'row'}
        align="flex-start"
        gap={2}
        maxW={messageBubbleMaxW}
      >
        {/* Avatar */}
        {!isUser && (
          <Box
            w={6}
            h={6}
            borderRadius="full"
            bg="blue.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mt={1}
            flexShrink={0}
          >
            <Text color="white" fontSize="xs" fontWeight="bold">
              AI
            </Text>
          </Box>
        )}
        
        {isUser && (
          <Box
            w={6}
            h={6}
            borderRadius="full"
            bg="blue.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            mt={1}
            flexShrink={0}
          >
            <Text color="white" fontSize="xs" fontWeight="bold">
              U
            </Text>
          </Box>
        )}

        {/* Message Content */}
        <Box
          bg={isUser ? 'blue.500' : (darkMode ? 'gray.700' : 'white')}
          color={isUser ? 'white' : (darkMode ? 'white' : 'gray.800')}
          borderRadius="2xl"
          borderTopLeftRadius={!isUser ? 'md' : '2xl'}
          borderTopRightRadius={isUser ? 'md' : '2xl'}
          p={3}
          shadow="xs"
          border={!isUser ? '1px solid' : 'none'}
          borderColor={!isUser ? (darkMode ? 'gray.600' : 'gray.100') : 'transparent'}
          position="relative"
        >
          {isUser ? (
            <Box>
              <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="relaxed">
                {message.content}
              </Text>
              <Text fontSize="xs" mt={1} color="blue.100">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Box>
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
          
          {/* Message Images */}
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
  // const placeholderCol = darkMode ? 'gray.300' : 'gray.600' // Unused - removed
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    return ChatStorage.loadThreads()
  })

  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    return ChatStorage.getCurrentThreadId()
  })

  const [input, setInput] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [isAutoSending, setIsAutoSending] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // const cameraInputRef = useRef<HTMLInputElement | null>(null) // Removed - no longer needed
  const audioStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [cameraOpen, setCameraOpen] = useState<boolean>(false)
  const [, setCameraSupported] = useState<boolean>(true)
  const [storageWarning, setStorageWarning] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isSending, setIsSending] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isMobile = useBreakpointValue({ base: true, md: false })
  
  // Pre-compute all breakpoint values to avoid conditional hook calls
  const messageBubbleMaxW = useBreakpointValue({ base: '90%', sm: '85%', md: '70%', lg: '60%' })
  // Removed unused messageBubbleP and messageBubbleFontSize - using hardcoded values in modern message bubbles
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
  // Removed unused textarea breakpoint values - using hardcoded values in modern chat input
  // Removed unused button layout variables - using modern chat input only
  
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [showQuickActions] = useState<boolean>(true)
  
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

  // Auto-send photos when selected in talk mode
  async function onSelectImagesAutoSend(files: FileList | null) {
    if (!files || files.length === 0) return
    
    // Process images the same way as regular selection
    await onSelectImages(files)
    
    // If in talk mode, automatically send after a short delay
    if (talkMode) {
      setTimeout(async () => {
        // Check if we have any images processed and ready
        const currentImages = images.length > 0 ? images : []
        if (currentImages.length > 0 || input.trim().length > 0) {
          await handleSend()
        }
      }, 500) // Small delay to ensure images are processed
    }
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
  const canSendVoice = useMemo(() => !!audioFile && !isSending && !isRecording && !isAutoSending, [audioFile, isSending, isRecording, isAutoSending])

  useEffect(() => {
    // Persist threads & selection with storage optimization
    const saveData = async () => {
      const success = await ChatStorage.saveThreads(threads)
      if (!success) {
        console.warn('Storage save failed - data may be too large')
        // Could show user notification here
      }
      if (currentThread?.id) {
        ChatStorage.setCurrentThreadId(currentThread.id)
      }
    }
    
    saveData()
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

  async function onSelectImages(files: FileList | null) {
    if (!files || files.length === 0) return
    
    // Check storage before processing images
    if (ChatStorage.isStorageNearLimit()) {
      const proceed = window.confirm(
        'Storage is nearly full. Images will be compressed. Continue?'
      )
      if (!proceed) return
    }
    
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
    
    const dataUris = await Promise.all(tasks)
    // Optimize images if storage is getting full
    const optimizedImages = ChatStorage.isStorageNearLimit() 
      ? await ChatStorage.optimizeImages(dataUris)
      : dataUris
      
    setImages((prev) => [...prev, ...optimizedImages])
  }

  function clearImages() {
    setImages([])
  }

  function clearAudio() {
    setAudioFile(null)
  }

  async function startHoldRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        window.alert('Microphone not supported in this browser')
        return false
      }
      
      // Clear any previous audio file when starting new recording
      setAudioFile(null)
      
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

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        // cleanup stream first
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop())
          audioStreamRef.current = null
        }
        mediaRecorderRef.current = null
        audioChunksRef.current = []
        setIsRecording(false)
        
        // Check if recording has content and meets minimum duration
        // Rough estimate: 1KB per 100ms of audio, so minimum 500 bytes for ~50ms
        if (blob.size > 500) {
          const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
          
          // Auto-send the voice message
          setIsAutoSending(true)
          try {
            await handleSendVoiceMessage(file)
          } catch (error) {
            console.error('Auto-send failed:', error)
            // Fallback: set the file for manual sending
            setAudioFile(file)
          } finally {
            setIsAutoSending(false)
          }
        } else {
          // Recording too short, ignore
          console.log('Recording too short, ignoring')
        }
      }

      recorder.start()
      setIsRecording(true)
      return true
    } catch (err) {
      console.error('Recording error:', err)
      window.alert('Unable to access microphone. Please check permissions.')
      setIsRecording(false)
      return false
    }
  }

  function stopHoldRecording() {
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

  // Handle press and hold events for recording
  const handleRecordingStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (isSending || isRecording || isAutoSending) return
    
    // Prevent context menu on long press (mobile)
    if ('touches' in e) {
      document.addEventListener('contextmenu', (e) => e.preventDefault(), { once: true })
    }
    
    const success = await startHoldRecording()
    if (!success) return
    
    // Add event listeners for release
    const handleEnd = (event: Event) => {
      event.preventDefault()
      stopHoldRecording()
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchend', handleEnd)
      document.removeEventListener('touchcancel', handleEnd)
      document.removeEventListener('mouseleave', handleEnd)
    }
    
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchend', handleEnd)
    document.addEventListener('touchcancel', handleEnd)
    // Also handle mouse leave to stop recording if user drags away
    document.addEventListener('mouseleave', handleEnd)
  }

  // Recording end is handled by document event listeners

  // Removed openCamera function - no longer needed with simplified input

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

  // Enhanced voice sending function that can be called automatically or manually
  async function handleSendVoiceMessage(file: File | null = null) {
    const fileToUpload = file || audioFile
    if (!fileToUpload || isSending || isAutoSending) return
    
    const filename = fileToUpload.name || 'voice.webm'
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Create a synthetic user message describing the voice submission
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: `🎤 Voice message (${timestamp})`,
    }

    // Clear audio file since we're sending it
    if (!file) setAudioFile(null) // Only clear if using stored file

    setThreads((prev) =>
      prev.map((t) =>
        t.id === currentThread.id
          ? {
              ...t,
              title: t.title === 'New chat' ? `Voice: ${timestamp}`.slice(0, 40) : t.title,
              messages: [...t.messages, userMessage],
              updatedAt: Date.now(),
            }
          : t,
      ),
    )

    if (!file) setIsSending(true) // Only set sending state for manual sends
    try {
      const response = await n8nClient.uploadReceipt<unknown>(fileToUpload, {
        filename,
        additionalFields: {
          userId: session?.user?.id || 'anonymous',
        },
        uploadUrl: audioUrl,
      })

      const content = extractN8nText(response) || `Voice message processed`
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
      throw err // Re-throw for auto-send error handling
    } finally {
      if (!file) setIsSending(false) // Only clear sending state for manual sends
    }
  }

  // Legacy function for backward compatibility
  async function handleSendVoice() {
    await handleSendVoiceMessage()
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

  function exportChats() {
    const dataStr = ChatStorage.exportChats(threads)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function importChats() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          const imported = ChatStorage.importChats(content)
          if (imported) {
            const confirm = window.confirm(
              `Import ${imported.length} chat threads? This will replace your current chats.`
            )
            if (confirm) {
              setThreads(imported)
              if (imported.length > 0) {
                setCurrentThreadId(imported[0].id)
              }
            }
          } else {
            window.alert('Invalid chat file format.')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  function clearOldChats() {
    const confirm = window.confirm(
      'Clear old chats to free up storage? This will keep only the 5 most recent chats.'
    )
    if (confirm) {
      setThreads((prev) => {
        const sorted = prev.sort((a, b) => b.updatedAt - a.updatedAt)
        const kept = sorted.slice(0, 5)
        return kept
      })
      setStorageWarning(false)
    }
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
    setIsTyping(true)

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
      setIsTyping(false)
    }
  }

  useEffect(() => {
    // Check camera support on component mount
    const checkCameraSupport = () => {
      const hasUserMedia = !!(navigator.mediaDevices?.getUserMedia)
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      setCameraSupported(hasUserMedia && isSecure)
    }
    
    const checkStorage = () => {
      setStorageWarning(ChatStorage.isStorageNearLimit())
    }
    
    checkCameraSupport()
    checkStorage()
    
    // Check storage periodically
    const storageInterval = setInterval(checkStorage, 30000) // Every 30 seconds
    
    return () => {
      clearInterval(storageInterval)
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
        borderRightColor={darkMode ? 'gray.600' : 'gray.200'}
        bg={darkMode ? '#1f1f1f' : '#ffffff'}
        w={80}
        h="100vh"
        transition="width 0.2s ease"
        overflowX="hidden"
        position="fixed"
        top={0}
        left={0}
        zIndex={5}
      >
        {/* Drawer Header */}
        <Box p={4} borderBottomWidth="1px" borderBottomColor={darkMode ? 'gray.600' : 'gray.200'}>
          <Flex justify="space-between" align="center" mb={3}>
            <Heading size="md" color={pageFg}>Chat History</Heading>
            <IconButton
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              variant="ghost"
              backgroundColor={darkMode ? 'gray.700' : 'gray.100'}
              color={darkMode ? 'white' : 'gray.600'}
              _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.200' }}
              borderRadius="full"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </IconButton>
          </Flex>
          <Button
            onClick={createNewThread}
            onDoubleClick={importChats}
            w="full"
            backgroundColor="blue.500"
            color="white"
            _hover={{ backgroundColor: 'blue.600' }}
            borderRadius="lg"
            title="Double-click to import chats"
          >
            <Text mr={2}>+</Text>
            New Chat
          </Button>
        </Box>

        {/* Storage Warning */}
        {storageWarning && (
          <Box p={3} bg="orange.100" borderBottomWidth="1px" borderColor={borderCol}>
            <Text fontSize="xs" color="orange.800" fontWeight="medium">
              ⚠️ Storage nearly full! Old chats may be automatically cleaned up.
            </Text>
          </Box>
        )}

        {/* Chat History List */}
        <Box flex="1" overflowY="auto" p={2}>
          {threads.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Text fontSize="2xl" mb={3} color={darkMode ? 'gray.400' : 'gray.300'}>💬</Text>
              <Text color={darkMode ? 'gray.400' : 'gray.500'} fontSize="sm">No chat history yet</Text>
              <Text color={darkMode ? 'gray.500' : 'gray.400'} fontSize="xs" mt={1}>
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
                    onClick={() => setCurrentThreadId(t.id)}
                    p={3}
                    borderRadius="lg"
                    cursor="pointer"
                    transition="all 0.2s"
                    bg={selected ? (darkMode ? 'blue.900' : 'blue.50') : 'transparent'}
                    border={selected ? '1px solid' : '1px solid transparent'}
                    borderColor={selected ? (darkMode ? 'blue.700' : 'blue.200') : 'transparent'}
                    _hover={{ 
                      bg: selected ? (darkMode ? 'blue.900' : 'blue.50') : (darkMode ? 'gray.800' : 'gray.50')
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
                            color={darkMode ? 'white' : 'gray.900'} 
                            lineClamp={1}
                            fontSize="sm"
                            fontWeight="medium"
                          >
                            {t.title || 'New chat'}
                          </Heading>
                          <ThreadMenu
                            darkMode={darkMode}
                            onRename={() => renameThread(t.id)}
                            onDelete={() => deleteThread(t.id)}
                          />
                        </Flex>
                        
                        {lastMessage && (
                          <Text 
                            fontSize="xs" 
                            color={darkMode ? 'gray.400' : 'gray.500'} 
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
                            bg={darkMode ? 'blue.900' : 'blue.100'} 
                            px={2} 
                            py={1} 
                            borderRadius="full"
                          >
                            Assistant
                          </Text>
                          <Text fontSize="xs" color={darkMode ? 'gray.500' : 'gray.400'}>
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
          
          {/* Storage management controls */}
          {storageWarning && (
            <Box mt={4} px={2}>
              <Stack gap={2}>
                <Button
                  onClick={clearOldChats}
                  size="sm"
                  backgroundColor="orange.500"
                  color="white"
                  w="full"
                >
                  Clear Old Chats
                </Button>
                <Button
                  onClick={exportChats}
                  size="sm"
                  backgroundColor={darkMode ? 'gray.600' : 'gray.400'}
                  color={darkMode ? 'white' : 'black'}
                  w="full"
                >
                  Export Chats
                </Button>
              </Stack>
            </Box>
          )}
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
            borderRightColor={darkMode ? 'gray.600' : 'gray.200'}
            overflowY="hidden"
            display="flex"
            flexDirection="column"
            shadow="2xl"
            transform="translateX(0)"
            transition="transform 0.3s ease"
          >
            {/* Drawer Header */}
            <Box p={4} borderBottomWidth="1px" borderBottomColor={darkMode ? 'gray.600' : 'gray.200'}>
              <Flex justify="space-between" align="center" mb={3}>
                <Heading size="md" color={pageFg}>Chat History</Heading>
                <IconButton
                  aria-label="Close sidebar"
                  variant="ghost"
                  backgroundColor={darkMode ? 'gray.700' : 'gray.100'}
                  color={darkMode ? 'white' : 'gray.600'}
                  _hover={{ backgroundColor: darkMode ? 'gray.600' : 'gray.200' }}
                  borderRadius="full"
                  onClick={() => setSidebarOpen(false)}
                >
                  <ChevronsLeft size={16} />
                </IconButton>
              </Flex>
              <Button
                onClick={() => {
                  createNewThread()
                  setSidebarOpen(false)
                }}
                onDoubleClick={importChats}
                w="full"
                backgroundColor="blue.500"
                color="white"
                _hover={{ backgroundColor: 'blue.600' }}
                borderRadius="lg"
                size="lg"
                minH="48px"
                title="Double-click to import chats"
              >
                <Text mr={2}>+</Text>
                New Chat
              </Button>
            </Box>

            {/* Chat History List */}
            <Box flex="1" overflowY="auto" p={2}>
              {threads.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text fontSize="2xl" mb={3} color={darkMode ? 'gray.400' : 'gray.300'}>💬</Text>
                  <Text color={darkMode ? 'gray.400' : 'gray.500'} fontSize="sm">No chat history yet</Text>
                  <Text color={darkMode ? 'gray.500' : 'gray.400'} fontSize="xs" mt={1}>
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
                          setSidebarOpen(false)
                        }}
                        p={3}
                        borderRadius="lg"
                        cursor="pointer"
                        transition="all 0.2s"
                        bg={selected ? (darkMode ? 'blue.900' : 'blue.50') : 'transparent'}
                        border={selected ? '1px solid' : '1px solid transparent'}
                        borderColor={selected ? (darkMode ? 'blue.700' : 'blue.200') : 'transparent'}
                        _hover={{ 
                          bg: selected ? (darkMode ? 'blue.900' : 'blue.50') : (darkMode ? 'gray.800' : 'gray.50')
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
                                color={darkMode ? 'white' : 'gray.900'} 
                                lineClamp={1}
                                fontSize="sm"
                                fontWeight="medium"
                              >
                                {t.title || 'New chat'}
                              </Heading>
                              <ThreadMenu
                                darkMode={darkMode}
                                onRename={() => renameThread(t.id)}
                                onDelete={() => deleteThread(t.id)}
                              />
                            </Flex>
                            
                            {lastMessage && (
                              <Text 
                                fontSize="xs" 
                                color={darkMode ? 'gray.400' : 'gray.500'} 
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
                                bg={darkMode ? 'blue.900' : 'blue.100'} 
                                px={2} 
                                py={1} 
                                borderRadius="full"
                              >
                                Assistant
                              </Text>
                              <Text fontSize="xs" color={darkMode ? 'gray.500' : 'gray.400'}>
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
              
              {/* Storage management controls for mobile */}
              {storageWarning && (
                <Box mt={4} px={2}>
                  <Stack gap={2}>
                    <Button
                      onClick={clearOldChats}
                      size="sm"
                      backgroundColor="orange.500"
                      color="white"
                      w="full"
                    >
                      Clear Old Chats
                    </Button>
                    <Button
                      onClick={exportChats}
                      size="sm"
                      backgroundColor={darkMode ? 'gray.600' : 'gray.400'}
                      color={darkMode ? 'white' : 'black'}
                      w="full"
                    >
                      Export Chats
                    </Button>
                  </Stack>
                </Box>
              )}
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
        ml={{ base: 0, md: sidebarCollapsed ? 0 : 80 }}
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
                  imageGap={imageGap}
                />
              ))}
              
              {/* Typing Indicator */}
              {isTyping && (
                <Flex justify="flex-start">
                  <Flex
                    align="flex-start"
                    gap={2}
                    maxW={messageBubbleMaxW}
                  >
                    {/* Assistant Avatar */}
                    <Box
                      w={6}
                      h={6}
                      borderRadius="full"
                      bg="blue.500"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      mt={1}
                      flexShrink={0}
                    >
                      <Text color="white" fontSize="xs" fontWeight="bold">
                        AI
                      </Text>
                    </Box>
                    
                    {/* Typing Bubble */}
                    <Box
                      bg={darkMode ? 'gray.700' : 'white'}
                      borderRadius="2xl"
                      borderTopLeftRadius="md"
                      p={3}
                      shadow="xs"
                      border="1px solid"
                      borderColor={darkMode ? 'gray.600' : 'gray.100'}
                    >
                      <Flex gap={1}>
                        <Box
                          w={2}
                          h={2}
                          bg="gray.400"
                          borderRadius="full"
                          animation="bounce 1.4s infinite"
                        />
                        <Box
                          w={2}
                          h={2}
                          bg="gray.400"
                          borderRadius="full"
                          animation="bounce 1.4s infinite 0.2s"
                        />
                        <Box
                          w={2}
                          h={2}
                          bg="gray.400"
                          borderRadius="full"
                          animation="bounce 1.4s infinite 0.4s"
                        />
                      </Flex>
                    </Box>
                  </Flex>
                </Flex>
              )}
            </Stack>
          </Container>
        </Box>

        <Box borderTopWidth={talkMode && isMobile ? "0" : "1px"} bg={talkMode && isMobile ? "transparent" : pageBg} position="sticky" bottom={0}>
          <Container maxW="4xl" py={talkMode && isMobile ? 0 : inputContainerPy} px={talkMode && isMobile ? 0 : inputContainerPx}>
            <Stack gap={talkMode && isMobile ? 0 : 3}>
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
                  bg="green.50"
                  borderColor="green.300"
                >
                  <HStack gap={2}>
                    <Text fontSize="sm" color="green.700" fontWeight="medium">
                      🎤 Voice message ready to send
                    </Text>
                  </HStack>
                </Box>

                <Button 
                  onClick={clearAudio} 
                  size={clearButtonSize}
                  backgroundColor={darkMode ? 'gray.700' : 'gray.300'} 
                  color={darkMode ? 'white' : 'black'}
                >
                  Clear
                </Button>
                <Button 
                  onClick={() => void handleSendVoice()} 
                  size={clearButtonSize}
                  backgroundColor="green.500" 
                  color="white"
                  disabled={!canSendVoice}
                >
                  Send Now
                </Button>
              </HStack>
            )}
            {(isRecording || isAutoSending) && (
              <HStack gap={inputGap} wrap="wrap">
                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  px={3}
                  py={2}
                  bg={isAutoSending ? "blue.50" : "red.50"}
                  borderColor={isAutoSending ? "blue.300" : "red.300"}
                  animation="pulse 1.5s infinite"
                >
                  <HStack gap={2}>
                    <Box
                      w={2}
                      h={2}
                      bg={isAutoSending ? "blue.500" : "red.500"}
                      borderRadius="full"
                      animation="blink 1s infinite"
                    />
                    <Text fontSize="sm" color={isAutoSending ? "blue.700" : "red.700"} fontWeight="medium">
                      {isAutoSending ? "➤ Sending voice message..." : "🎤 Recording... Release to send"}
                    </Text>
                  </HStack>
                </Box>
              </HStack>
            )}
              {!talkMode && (
                <Box>
                  {/* Modern Chat Input */}
                  <Flex align="flex-end" gap={3}>
                    <Box flex="1" position="relative">
                      <Textarea
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        resize="none"
                        rows={1}
                        disabled={isSending}
                        bg={darkMode ? 'gray.700' : 'white'}
                        color={darkMode ? 'white' : 'gray.800'}
                        border="1px solid"
                        borderColor={darkMode ? 'gray.600' : 'gray.200'}
                        borderRadius="2xl"
                        px={4}
                        py={3}
                        pr={12}
                        fontSize="sm"
                        minH="44px"
                        maxH="128px"
                        lineHeight="20px"
                        _placeholder={{ color: darkMode ? 'gray.400' : 'gray.500' }}
                        _focus={{
                          outline: 'none',
                          borderColor: darkMode ? 'blue.400' : 'blue.500',
                          boxShadow: `0 0 0 2px ${darkMode ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.1)'}`
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement
                          target.style.height = '44px'
                          target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                        }}
                      />
                      
                      {/* Attachment Button */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => onSelectImages(e.currentTarget.files)}
                      />
                      <IconButton
                        aria-label="Attach file"
                        position="absolute"
                        right={2}
                        bottom={2}
                        size="sm"
                        variant="ghost"
                        borderRadius="full"
                        onClick={() => fileInputRef.current?.click()}
                        _hover={{ bg: darkMode ? 'gray.600' : 'gray.100' }}
                      >
                        <Text fontSize="sm">📎</Text>
                      </IconButton>
                    </Box>
                    
                    {/* Send Button */}
                    <IconButton
                      aria-label="Send message"
                      onClick={() => void handleSend()}
                      size="lg"
                      borderRadius="full"
                      backgroundColor={canSend ? 'blue.500' : 'gray.200'}
                      color={canSend ? 'white' : 'gray.400'}
                      disabled={!canSend || isSending || isAutoSending}
                      _hover={{
                        backgroundColor: canSend ? 'blue.600' : 'gray.200',
                      }}
                      _active={{
                        transform: 'scale(0.95)'
                      }}
                      transition="all 0.2s"
                      shadow="lg"
                      minH="48px"
                      minW="48px"
                    >
                      <Text fontSize="sm">➤</Text>
                    </IconButton>
                  </Flex>
                  
                  {/* Quick Actions */}
                  {showQuickActions && (
                    <Flex gap={2} mt={3}>
                      <Button
                        onClick={() => setInput('Help me track my expenses')}
                        size="sm"
                        backgroundColor={darkMode ? 'gray.600' : 'gray.100'}
                        color={darkMode ? 'gray.200' : 'gray.600'}
                        borderRadius="full"
                        fontSize="xs"
                        _hover={{ backgroundColor: darkMode ? 'gray.500' : 'gray.200' }}
                        transition="colors 0.2s"
                      >
                        💡 Track Expenses
                      </Button>
                      <Button
                        onClick={() => setInput('Generate a spending summary')}
                        size="sm"
                        backgroundColor={darkMode ? 'gray.600' : 'gray.100'}
                        color={darkMode ? 'gray.200' : 'gray.600'}
                        borderRadius="full"
                        fontSize="xs"
                        _hover={{ backgroundColor: darkMode ? 'gray.500' : 'gray.200' }}
                        transition="colors 0.2s"
                      >
                        📊 Summary
                      </Button>
                      <Button
                        onClick={() => setInput('Help me budget better')}
                        size="sm"
                        backgroundColor={darkMode ? 'gray.600' : 'gray.100'}
                        color={darkMode ? 'gray.200' : 'gray.600'}
                        borderRadius="full"
                        fontSize="xs"
                        _hover={{ backgroundColor: darkMode ? 'gray.500' : 'gray.200' }}
                        transition="colors 0.2s"
                      >
                        💰 Budget Help
                      </Button>
                    </Flex>
                  )}
                </Box>
              )}
            {isMobile ? (
              talkMode ? (
                /* Talk Mode UI - Clean and minimal */
                <Box position="relative" w="full" h="140px" bg="transparent">
                  {/* Talk button - centered */}
                  <Box position="absolute" top="40%" left="50%" transform="translate(-50%, -50%)">
                    <IconButton
                      aria-label="Hold to speak"
                      onMouseDown={handleRecordingStart}
                      onTouchStart={handleRecordingStart}
                      borderRadius="full"
                      size="2xl"
                      w="100px"
                      h="100px"
                      backgroundColor={isRecording ? 'red.600' : (isAutoSending ? 'blue.500' : 'red.500')}
                      color="white"
                      border="2px solid"
                      borderColor={isRecording ? 'red.400' : (isAutoSending ? 'blue.400' : 'red.400')}
                      disabled={isSending || isAutoSending}
                      transform={(isRecording || isAutoSending) ? 'scale(0.95)' : 'scale(1)'}
                      transition="all 0.2s ease"
                      _active={{
                        transform: 'scale(0.9)'
                      }}
                      _hover={{
                        transform: isRecording ? 'scale(0.95)' : 'scale(1.05)',
                        backgroundColor: isRecording ? 'red.600' : 'red.600',
                        borderColor: isRecording ? 'red.300' : 'red.300'
                      }}
                      userSelect="none"
                      opacity={isAutoSending ? 0.8 : 1}
                      shadow={isRecording ? 'lg' : 'md'}
                      position="relative"
                      overflow="hidden"
                    >
                      <Mic size={32} />
                      
                      {/* Pulsing ring animation when recording */}
                      {isRecording && (
                        <Box
                          position="absolute"
                          inset="-6px"
                          borderRadius="full"
                          border="2px solid"
                          borderColor="red.300"
                          animation="ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
                        />
                      )}
                    </IconButton>
                    
                  </Box>
                  
                  {/* Status text below button - outside the button container */}
                  <Text
                    position="absolute"
                    top="75%"
                    left="50%"
                    transform="translateX(-50%)"
                    fontSize="sm"
                    color={isRecording ? 'red.500' : (isAutoSending ? 'blue.500' : (darkMode ? 'gray.400' : 'gray.600'))}
                    fontWeight="medium"
                    textAlign="center"
                    whiteSpace="nowrap"
                  >
                    {isAutoSending ? 'Sending...' : (isRecording ? 'Recording...' : 'Hold to speak')}
                  </Text>

                  {/* Photo selection button - positioned on the right */}
                  <Box position="absolute" top="40%" right="20px" transform="translateY(-50%)">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => onSelectImagesAutoSend(e.currentTarget.files)}
                    />
                    <IconButton
                      aria-label="Select Photo"
                      onClick={() => fileInputRef.current?.click()}
                      borderRadius="full"
                      size="lg"
                      w="60px"
                      h="60px"
                      backgroundColor="gray.500"
                      color="white"
                      border="2px solid"
                      borderColor="gray.400"
                      _hover={{
                        backgroundColor: 'gray.600',
                        transform: 'scale(1.05)',
                        borderColor: 'gray.300'
                      }}
                      _active={{
                        transform: 'scale(0.95)'
                      }}
                      transition="all 0.2s ease"
                      shadow="xs"
                    >
                      <Camera size={24} />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                // Simplified mobile input - no extra buttons, modern input handles everything
                null
              )
            ) : (
              // Simplified desktop input - modern input handles everything  
              null
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

