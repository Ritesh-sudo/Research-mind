import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { augmentMessages } from '@/lib/rag/context'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'
import { retrieve } from '@/lib/rag/retriever'
import { ingest } from '@/lib/rag/ingest'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, projectId, userMessage } = await req.json()
  if (!projectId || !userMessage) {
    return NextResponse.json({ error: 'projectId and userMessage required' }, { status: 400 })
  }

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  await prisma.researchMessage.create({
    data: { projectId, role: 'user', content: userMessage },
  })

  const retrieved = await retrieve(userMessage, projectId, {
    topK: 8,
    sourceTypes: ['pdf', 'chat', 'latex', 'citation'],
  }).catch(() => [])

  const augmented = await augmentMessages(userMessage, projectId, messages ?? [])

  const ai = getProviderForTask('chat')

  let fullResponse = ''
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream(augmented as Parameters<typeof ai.stream>[0], {
          systemPrompt: RESEARCH_SYSTEM_PROMPT,
          maxTokens: 4096,
        })) {
          fullResponse += chunk
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        )
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()

      const msgRecord = await prisma.researchMessage.create({
        data: {
          projectId,
          role: 'assistant',
          content: fullResponse,
          aiProvider: ai.providerName,
          aiModel: ai.model,
          sources: retrieved as object[],
        },
      })

      ingest({
        projectId,
        sourceType: 'chat',
        sourceId: msgRecord.id,
        sourceLabel: 'Research chat',
        text: fullResponse,
      }).catch(console.error)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
