import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Textarea,
  useBreakpointValue,
} from '@chakra-ui/react'
import { env } from '../config/env'
import { openaiClient } from '../service/api/openai'
import type { OpenAIChatMessage } from '../service/api/openai'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
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
        bg={isUser ? 'blue.500' : 'gray.100'}
        color={isUser ? 'white' : 'gray.900'}
        borderRadius="lg"
        p={3}
      >
        <Text whiteSpace="pre-wrap">{message.content}</Text>
      </Box>
    </Flex>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateMessageId(),
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant. Ask me anything to get started.',
    },
  ])

  const [input, setInput] = useState<string>('')

  const [isSending, setIsSending] = useState<boolean>(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending])

  useEffect(() => {
    // Auto-scroll to the latest message
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!canSend) return

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
    }

    setInput('')

    setMessages((prev) => [...prev, userMessage])

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
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        // Stream response from OpenAI
        const history: OpenAIChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))
        const pendingAssistantId = generateMessageId()
        setMessages((prev) => [...prev, { id: pendingAssistantId, role: 'assistant', content: '' }])

        let accumulated = ''
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        for await (const delta of openaiClient.streamChat(
          [...history, { role: 'user', content: userMessage.content }],
          { model: env.openaiModel, signal: abortRef.current.signal },
        )) {
          accumulated += delta
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingAssistantId ? { ...m, content: accumulated } : m)),
          )
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        { id: generateMessageId(), role: 'assistant', content: `Error: ${message}` },
      ])
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <Box minH="100dvh" display="flex" flexDirection="column" bg="gray.50" color="gray.900">
      <Box borderBottomWidth="1px" bg="white">
        <Container maxW="4xl" py={4}>
          <Stack gap={1}>
            <Heading size="md">{env.appName}</Heading>
            <Text color="gray.600" fontSize="sm">Chat-style interface to help manage and track your expenses.</Text>
          </Stack>
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

      <Box borderTopWidth="1px" bg="white" position="sticky" bottom={0}>
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
              bg="white"
              color="gray.900"
              borderColor="gray.300"
              _placeholder={{ color: 'gray.500' }}
              shadow="sm"
            />

            <HStack justify="flex-end">
              <Button
                onClick={() => void handleSend()}
                colorScheme="blue"
                disabled={!canSend}
              >
                Send
              </Button>
            </HStack>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

