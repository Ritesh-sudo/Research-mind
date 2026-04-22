import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProviderForTask } from '@/lib/ai/router'

export const maxDuration = 60

const DIAGRAM_SYSTEM = `You are an expert at creating Mermaid.js diagrams for academic research papers.
Generate clean, well-structured Mermaid syntax. Only output the raw Mermaid code — no markdown fences, no explanation.

Mermaid diagram types you can use:
- flowchart TD/LR — for pipelines, architectures, workflows
- sequenceDiagram — for protocols, interactions
- classDiagram — for model architectures, class structures
- erDiagram — for data relationships
- mindmap — for concept maps
- graph — for general graphs

Always use descriptive node labels. Keep diagrams clear and publication-ready.`

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, description, diagramType } = await req.json()
  if (!projectId || !description) {
    return NextResponse.json({ error: 'projectId and description required' }, { status: 400 })
  }

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ai = getProviderForTask('figure_generate')

  const prompt = `Create a Mermaid diagram for an academic research paper.

Paper topic: ${project.topic ?? project.title}
Diagram request: ${description}
${diagramType ? `Preferred diagram type: ${diagramType}` : ''}

Output only the raw Mermaid code. No code fences, no explanation.`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream(
          [{ role: 'user', content: prompt }],
          { systemPrompt: DIAGRAM_SYSTEM, maxTokens: 1024 }
        )) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
