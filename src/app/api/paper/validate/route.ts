import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { augmentMessages } from '@/lib/rag/context'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, sectionContent, sectionName } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userMessage = `Validate the arguments in the "${sectionName}" section below.
Find any unsupported claims, logical gaps, or statements that contradict the uploaded papers.
Return a JSON array of issues: [{claim, issue, severity: 'high'|'medium'|'low', suggestion}]

Section:
${sectionContent}`

  const augmented = await augmentMessages(userMessage, projectId, [], ['pdf', 'citation', 'latex'])
  const ai = getProviderForTask('argument_validate')

  const response = await ai.chat(augmented as Parameters<typeof ai.chat>[0], {
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
    maxTokens: 2048,
  })

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    const issues = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return NextResponse.json({ issues })
  } catch {
    return NextResponse.json({ issues: [], raw: response })
  }
}
