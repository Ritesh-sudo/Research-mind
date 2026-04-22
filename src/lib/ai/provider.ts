export type AIProviderType = 'ollama' | 'openai' | 'groq' | 'gemini' | 'claude' | 'openrouter'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatOptions {
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface AIProvider {
  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>
  stream(messages: AIMessage[], options?: ChatOptions): AsyncGenerator<string>
  model: string
  providerName: AIProviderType
}

class OpenAICompatibleProvider implements AIProvider {
  constructor(
    public providerName: AIProviderType,
    private baseUrl: string,
    private apiKey: string,
    public model: string
  ) {}

  private get headers() {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
    if (this.providerName === 'openrouter') {
      h['HTTP-Referer'] = 'http://localhost:3000'
      h['X-Title'] = 'ResearchMind AI'
    }
    return h
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const allMessages = options?.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.model,
        messages: allMessages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
      }),
    })
    if (!res.ok) throw new Error(`${this.providerName} API error: ${res.statusText}`)
    const data = await res.json()
    return data.choices[0].message.content
  }

  async *stream(messages: AIMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const allMessages = options?.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.model,
        messages: allMessages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    })
    if (!res.ok) throw new Error(`${this.providerName} API error: ${res.statusText}`)
    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter((l) => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {}
      }
    }
  }
}

class ClaudeProvider implements AIProvider {
  public providerName: AIProviderType = 'claude'
  public model: string

  constructor(
    private apiKey: string,
    model?: string
  ) {
    this.model = model ?? 'claude-sonnet-4-6'
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: this.apiKey })

    const systemMessages = messages.filter((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')
    const systemContent =
      options?.systemPrompt ??
      systemMessages.map((m) => m.content).join('\n') ??
      undefined

    const res = await client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      system: systemContent,
      messages: userMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
    })

    return res.content[0].type === 'text' ? res.content[0].text : ''
  }

  async *stream(messages: AIMessage[], options?: ChatOptions): AsyncGenerator<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: this.apiKey })

    const systemMessages = messages.filter((m) => m.role === 'system')
    const userMessages = messages.filter((m) => m.role !== 'system')
    const systemContent =
      options?.systemPrompt ??
      systemMessages.map((m) => m.content).join('\n') ??
      undefined

    const stream = client.messages.stream({
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      system: systemContent,
      messages: userMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}

export function createAIProvider(type?: AIProviderType): AIProvider {
  const p = type ?? ((process.env.AI_PROVIDER as AIProviderType) ?? 'ollama')
  switch (p) {
    case 'ollama':
      return new OpenAICompatibleProvider(
        'ollama',
        process.env.AI_BASE_URL ?? 'http://localhost:11434/v1',
        'ollama',
        process.env.AI_MODEL ?? 'qwen2.5:14b'
      )
    case 'openai':
      return new OpenAICompatibleProvider(
        'openai',
        'https://api.openai.com/v1',
        process.env.OPENAI_API_KEY!,
        process.env.AI_MODEL ?? 'gpt-4o'
      )
    case 'groq':
      return new OpenAICompatibleProvider(
        'groq',
        'https://api.groq.com/openai/v1',
        process.env.GROQ_API_KEY!,
        process.env.AI_MODEL ?? 'llama-3.3-70b-versatile'
      )
    case 'gemini':
      return new OpenAICompatibleProvider(
        'gemini',
        'https://generativelanguage.googleapis.com/v1beta/openai',
        process.env.GEMINI_API_KEY!,
        process.env.AI_MODEL ?? 'gemini-2.0-flash'
      )
    case 'claude':
      return new ClaudeProvider(
        process.env.ANTHROPIC_API_KEY!,
        process.env.AI_MODEL ?? 'claude-sonnet-4-6'
      )
    case 'openrouter':
      return new OpenAICompatibleProvider(
        'openrouter',
        'https://openrouter.ai/api/v1',
        process.env.OPENROUTER_API_KEY!,
        process.env.AI_MODEL ?? 'nvidia/llama-3.1-nemotron-ultra-253b-v1'
      )
    default:
      throw new Error(`Unknown AI provider: ${p}`)
  }
}
