export type OpenAIChatRole = 'system' | 'user' | 'assistant'

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface OpenAIChatMessage {
  role: OpenAIChatRole
  content: string | OpenAIContentPart[]
}

export interface OpenAIChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
  apiBaseUrl?: string
}

interface OpenAIChatCompletionChunkChoiceDelta {
  role?: OpenAIChatRole
  content?: string
}

interface OpenAIChatCompletionChunkChoice {
  delta: OpenAIChatCompletionChunkChoiceDelta
  finish_reason: string | null
  index: number
}

interface OpenAIChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: OpenAIChatCompletionChunkChoice[]
}

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name as keyof ImportMetaEnv] as unknown as string | undefined
  return value && value.length > 0 ? value : undefined
}

function getDefaultApiKey(): string | undefined {
  return readEnv('VITE_OPENAI_API_KEY')
}

function getDefaultApiBaseUrl(): string {
  return 'https://api.openai.com/v1'
}

export class OpenAIClient {
  private readonly apiKey?: string
  private readonly apiBaseUrl: string

  constructor(apiKey?: string, apiBaseUrl: string = getDefaultApiBaseUrl()) {
    this.apiKey = apiKey ?? getDefaultApiKey()
    this.apiBaseUrl = apiBaseUrl
  }

  async chat(
    messages: OpenAIChatMessage[],
    options: OpenAIChatCompletionOptions = {},
  ): Promise<string> {
    const { model = 'gpt-5', temperature, maxTokens, signal, apiBaseUrl } = options

    const key = this.apiKey
    if (!key) {
      throw new Error(
        'Missing OpenAI API key. Provide VITE_OPENAI_API_KEY or pass an apiKey to OpenAIClient.',
      )
    }

    const body: Record<string, unknown> = {
      model,
      messages,
    }

    if (typeof temperature === 'number') body.temperature = temperature

    if (typeof maxTokens === 'number') body.max_tokens = maxTokens

    const url = `${apiBaseUrl ?? this.apiBaseUrl}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorText = await safeReadText(response)
      throw new Error(`OpenAI error ${response.status}: ${errorText}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { role: OpenAIChatRole; content: string } }>
    }

    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI returned no content')
    return content
  }

  async *streamChat(
    messages: OpenAIChatMessage[],
    options: OpenAIChatCompletionOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    const { model = 'gpt-5', temperature, maxTokens, signal, apiBaseUrl } = options

    const key = this.apiKey
    if (!key) {
      throw new Error(
        'Missing OpenAI API key. Provide VITE_OPENAI_API_KEY or pass an apiKey to OpenAIClient.',
      )
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    }
    if (typeof temperature === 'number') body.temperature = temperature
    if (typeof maxTokens === 'number') body.max_tokens = maxTokens

    const url = `${apiBaseUrl ?? this.apiBaseUrl}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok || !response.body) {
      const errorText = await safeReadText(response)
      throw new Error(`OpenAI stream error ${response.status}: ${errorText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '' || !trimmed.startsWith('data:')) continue
        const payload = trimmed.replace(/^data:\s*/, '')
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload) as OpenAIChatCompletionChunk
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            yield delta
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return 'unknown error'
  }
}

export const openaiClient = new OpenAIClient()

