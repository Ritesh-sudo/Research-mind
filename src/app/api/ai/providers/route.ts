import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providers = [
    { id: 'ollama', name: 'Ollama (Local)', configured: !!process.env.AI_BASE_URL || true, models: ['qwen2.5:14b', 'qwen2.5:7b', 'llama3.2'] },
    { id: 'claude', name: 'Anthropic Claude', configured: !!process.env.ANTHROPIC_API_KEY, models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'] },
    { id: 'openai', name: 'OpenAI', configured: !!process.env.OPENAI_API_KEY, models: ['gpt-4o', 'gpt-4o-mini'] },
    { id: 'groq', name: 'Groq', configured: !!process.env.GROQ_API_KEY, models: ['llama-3.3-70b-versatile'] },
    { id: 'gemini', name: 'Google Gemini', configured: !!process.env.GEMINI_API_KEY, models: ['gemini-2.0-flash'] },
  ]

  const current = {
    aiProvider: process.env.AI_PROVIDER ?? 'ollama',
    aiModel: process.env.AI_MODEL ?? 'qwen2.5:14b',
    embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'ollama',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'nomic-embed-text',
  }

  return NextResponse.json({ providers, current })
}
