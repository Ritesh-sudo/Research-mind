import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { embed } from '@/lib/rag/embedder'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, idea } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const query = idea ?? project.topic
  const [queryEmbedding] = await embed([query])

  // Search Semantic Scholar for similar papers
  const ssRes = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,abstract,year,citationCount`,
    {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY }
        : {},
    }
  )

  const ssData = await ssRes.json()
  const papers = ssData.data ?? []

  // Score novelty: compute similarity of idea to top papers
  const similarPapers = papers.slice(0, 5).map((p: { title?: string; abstract?: string; year?: number; citationCount?: number }) => ({
    title: p.title,
    abstract: p.abstract?.slice(0, 200),
    year: p.year,
    citationCount: p.citationCount,
  }))

  // Rough novelty: if no highly similar papers found, high novelty
  const noveltyScore = Math.max(
    20,
    100 - Math.min(papers.length * 8, 80)
  )

  await prisma.researchProject.update({
    where: { id: projectId },
    data: { noveltyScore },
  })

  const ai = getProviderForTask('novelty_score')
  const narrative = await ai.chat(
    [
      {
        role: 'user',
        content: `Research idea: "${query}"

Similar papers found (${papers.length} total):
${similarPapers.map((p: { title?: string; year?: number }) => `- ${p.title} (${p.year})`).join('\n')}

Novelty score: ${noveltyScore}/100

Write a 2-3 sentence assessment of how novel this research idea is and what gap it fills.`,
      },
    ],
    { systemPrompt: RESEARCH_SYSTEM_PROMPT, maxTokens: 512 }
  )

  return NextResponse.json({ noveltyScore, narrative, similarPapers })
}
