import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProviderForTask } from '@/lib/ai/router'

export const maxDuration = 60

const SYSTEM = `You are an expert research scientist and Python programmer.
Generate clean, well-structured Python experiment code for academic research papers.

Rules:
- Log metrics using: print("METRIC: key=value key2=value2") — one line per step/epoch
- Use matplotlib for figures — call plt.savefig() at the end (path is auto-handled)
- Include numpy, pandas, sklearn, scipy as needed — all are available
- Add descriptive comments
- Print clear section headers like "=== Training ===" for readability
- Always print final summary metrics at the end
- Use realistic but synthetic data if no dataset is specified
- Keep code self-contained and runnable`

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const experiment = await prisma.experiment.findFirst({ where: { id, project: { userId: session.user.id } } })
  if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { description, existingCode } = await req.json()

  const ai = getProviderForTask('write_to_paper')
  const prompt = existingCode
    ? `Refine this experiment code based on: ${description}\n\nExisting code:\n\`\`\`python\n${existingCode}\n\`\`\``
    : `Generate Python experiment code for: ${description}\n\nProject: ${experiment.name}\n\nReturn only the raw Python code, no markdown fences.`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream([{ role: 'user', content: prompt }], { systemPrompt: SYSTEM, maxTokens: 2048 })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
