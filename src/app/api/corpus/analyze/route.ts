import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { augmentMessages } from '@/lib/rag/context'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, query, analysisType } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { papers: { select: { filename: true, id: true } } },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const paperList = project.papers.map((p: { filename: string; id: string }) => `- ${p.filename}`).join('\n')

  const prompts: Record<string, string> = {
    gaps: `Analyze the research gaps across these uploaded papers. What questions remain unanswered?\n\nPapers:\n${paperList}`,
    themes: `Identify the major themes and research directions across these papers.\n\nPapers:\n${paperList}`,
    methods: `Compare the methodologies used across these papers. What are the common approaches?\n\nPapers:\n${paperList}`,
    related_work: `Generate a Related Work section for a paper on "${project.topic}" using the uploaded papers as sources. Include \\cite{} keys.\n\nPapers:\n${paperList}`,
    custom: query ?? `Analyze these papers: ${paperList}`,
  }

  const userMessage = prompts[analysisType ?? 'themes'] ?? prompts.themes
  const augmented = await augmentMessages(userMessage, projectId, [], ['pdf'])
  const ai = getProviderForTask('corpus_analyze')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream(augmented as Parameters<typeof ai.stream>[0], {
          systemPrompt: RESEARCH_SYSTEM_PROMPT,
          maxTokens: 4096,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
