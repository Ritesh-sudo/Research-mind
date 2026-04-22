import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createAIProvider } from '@/lib/ai/provider'
import type { AIProviderType } from '@/lib/ai/provider'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider } = await req.json()
  const start = Date.now()

  try {
    const ai = createAIProvider(provider as AIProviderType)
    const response = await ai.chat(
      [{ role: 'user', content: 'Say "OK" and nothing else.' }],
      { maxTokens: 10 }
    )
    const latency = Date.now() - start
    return NextResponse.json({ success: true, response, latency, provider: ai.providerName, model: ai.model })
  } catch (err) {
    const latency = Date.now() - start
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error', latency })
  }
}
