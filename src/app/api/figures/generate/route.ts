import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, description, figureType, caption } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ai = getProviderForTask('figure_generate')

  const systemPrompt = `${RESEARCH_SYSTEM_PROMPT}

You are also an expert at generating Python matplotlib code and LaTeX pgfplots/tikz code for academic figures.
Always generate complete, runnable code with consistent academic styling.`

  const prompt = `Generate code for a ${figureType ?? 'line plot'} figure for an academic paper.

Description: ${description}
Caption: ${caption ?? 'Figure showing ' + description}

Return a JSON object with:
{
  "pythonCode": "complete matplotlib Python code",
  "latexCode": "complete \\\\begin{figure}...\\\\end{figure} LaTeX block with pgfplots or \\\\includegraphics",
  "caption": "suggested figure caption",
  "label": "fig:suggested_label"
}`

  const response = await ai.chat(
    [{ role: 'user', content: prompt }],
    { systemPrompt, maxTokens: 2048 }
  )

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { latexCode: response, pythonCode: '' }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ latexCode: response, pythonCode: '', caption: caption ?? '' })
  }
}
