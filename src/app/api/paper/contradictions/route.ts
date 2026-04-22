import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieve } from '@/lib/rag/retriever'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { document: true },
  })
  if (!project?.document) return NextResponse.json({ contradictions: [] })

  // Split into sections and retrieve semantically similar content
  const sections = project.document.content.split(/(?=\\section\{)/).filter((s: string) => s.trim())
  const contradictions: Array<{ section1: string; section2: string; claim1: string; claim2: string }> = []

  for (let i = 0; i < Math.min(sections.length, 8); i++) {
    const claim = sections[i].slice(0, 300)
    const similar = await retrieve(claim, projectId, {
      topK: 5,
      sourceTypes: ['latex'],
      minSimilarity: 0.7,
    })

    if (similar.length > 1) {
      const ai = getProviderForTask('contradiction')
      const prompt = `Do any of these text chunks contradict each other? If yes, return JSON: [{section1, section2, claim1, claim2}]. If no contradictions, return [].

Chunks:
${similar.map((c, i) => `[${i}] ${c.text}`).join('\n\n')}`

      const response = await ai.chat([{ role: 'user', content: prompt }], {
        systemPrompt: RESEARCH_SYSTEM_PROMPT,
        maxTokens: 1024,
      })

      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const found = JSON.parse(jsonMatch[0])
          contradictions.push(...found)
        }
      } catch {}
    }
  }

  return NextResponse.json({ contradictions: contradictions.slice(0, 10) })
}
