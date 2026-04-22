import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { augmentMessages } from '@/lib/rag/context'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, sectionName, instruction, currentContent } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { document: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userMessage = `Write or improve the "${sectionName}" section of the LaTeX paper.
Instruction: ${instruction}
Current section content:
${currentContent ?? '(empty)'}

Return ONLY valid LaTeX code for this section, starting with \\section{${sectionName}}.`

  const augmented = await augmentMessages(userMessage, projectId, [], ['latex', 'pdf', 'citation'])

  const ai = getProviderForTask('write_to_paper')
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream(augmented as Parameters<typeof ai.stream>[0], {
          systemPrompt: RESEARCH_SYSTEM_PROMPT + '\n\nAlways output valid LaTeX. Use \\cite{} for references.',
          maxTokens: 2048,
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
