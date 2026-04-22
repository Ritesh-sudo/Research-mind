import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { embed } from '@/lib/rag/embedder'
import { enqueueJob } from '@/lib/jobs/queue'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const query = project.topic.slice(0, 100)
  const arxivRes = await fetch(
    `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
  )
  const xml = await arxivRes.text()
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? []

  const [topicEmbedding] = await embed([project.topic]).catch(() => [[]])

  const papers = await Promise.all(
    entries.map(async (entry) => {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ''
      const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() ?? ''
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.split('/').pop() ?? ''
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() ?? ''
      const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      const authors = authorMatches.map((m) => m[1].trim())

      let similarity = 0
      if (topicEmbedding.length > 0 && abstract) {
        const [paperEmbedding] = await embed([abstract]).catch(() => [[]])
        if (paperEmbedding.length > 0) {
          const dot = topicEmbedding.reduce((s: number, v: number, i: number) => s + v * (paperEmbedding[i] ?? 0), 0)
          const normA = Math.sqrt(topicEmbedding.reduce((s: number, v: number) => s + v * v, 0))
          const normB = Math.sqrt(paperEmbedding.reduce((s: number, v: number) => s + v * v, 0))
          similarity = normA && normB ? dot / (normA * normB) : 0
        }
      }

      return { id, title, authors, abstract, published, link: `https://arxiv.org/abs/${id}`, similarity }
    })
  )

  const sorted = papers
    .filter((p) => p.title)
    .sort((a, b) => b.similarity - a.similarity)

  enqueueJob({ type: 'arxiv_feed', projectId }).catch(console.error)

  return NextResponse.json({ papers: sorted })
}
