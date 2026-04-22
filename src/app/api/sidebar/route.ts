import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { augmentMessages } from '@/lib/rag/context'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export const maxDuration = 60

export type SidebarTool =
  | 'related_work'
  | 'abstract'
  | 'contributions'
  | 'experiment_design'
  | 'reviewer_sim'

const TOOL_PROMPTS: Record<SidebarTool, (title: string, topic: string) => string> = {
  related_work: (title, topic) =>
    `Generate a complete Related Work section for a paper titled "${title}" on the topic: ${topic}.
Use \\cite{key} for references from the uploaded papers. Group by themes. 2-3 paragraphs.
Return valid LaTeX starting with \\section{Related Work}.`,

  abstract: (title, topic) =>
    `Write a compelling abstract for a paper titled "${title}" on: ${topic}.
Structure: motivation (1 sentence), problem (1 sentence), method (2 sentences), results (1 sentence), impact (1 sentence).
Return the abstract text only (no LaTeX wrapping), ready for \\begin{abstract}...\\end{abstract}.`,

  contributions: (title, topic) =>
    `Generate a concise bullet-point list of 3-5 key contributions for a paper titled "${title}" on: ${topic}.
Return as a LaTeX itemize list:
\\begin{itemize}
  \\item We propose...
  \\item We demonstrate...
\\end{itemize}`,

  experiment_design: (title, topic) =>
    `Design a rigorous experimental evaluation plan for a paper on: ${topic}.
Include: datasets to use, baselines to compare against, evaluation metrics, ablation studies, and statistical significance tests.
Return as a structured LaTeX Experiments section.`,

  reviewer_sim: (title, topic) =>
    `Simulate a rigorous NeurIPS/ICML reviewer for a paper titled "${title}" on: ${topic}.
Score on: Originality (1-10), Significance (1-10), Clarity (1-10), Technical Quality (1-10).
Provide: 3 strengths, 3 weaknesses, 3 questions for authors, and an overall recommendation (Accept/Weak Accept/Weak Reject/Reject).
Base your review on the paper content in context.`,
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, tool } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { document: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const promptFn = TOOL_PROMPTS[tool as SidebarTool]
  if (!promptFn) return NextResponse.json({ error: 'Unknown tool' }, { status: 400 })

  const userMessage = promptFn(project.title, project.topic)
  const augmented = await augmentMessages(userMessage, projectId, [], ['pdf', 'citation', 'latex'])

  const taskMap: Record<SidebarTool, Parameters<typeof getProviderForTask>[0]> = {
    related_work: 'write_to_paper',
    abstract: 'write_to_paper',
    contributions: 'write_to_paper',
    experiment_design: 'write_to_paper',
    reviewer_sim: 'reviewer_sim',
  }

  const ai = getProviderForTask(taskMap[tool as SidebarTool] ?? 'write_to_paper')
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ai.stream(augmented as Parameters<typeof ai.stream>[0], {
          systemPrompt: RESEARCH_SYSTEM_PROMPT,
          maxTokens: 2048,
        })) {
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
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
