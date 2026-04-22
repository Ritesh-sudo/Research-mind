import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = req.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,authors,year,abstract,externalIds,citationCount`,
    {
      headers: process.env.SEMANTIC_SCHOLAR_API_KEY
        ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY }
        : {},
    }
  )

  const data = await res.json()
  const papers = (data.data ?? []).map((p: {
    paperId?: string
    title?: string
    authors?: Array<{ name: string }>
    year?: number
    abstract?: string
    externalIds?: { DOI?: string; ArXiv?: string }
    citationCount?: number
  }) => ({
    paperId: p.paperId,
    title: p.title,
    authors: p.authors?.map((a) => a.name).join(', '),
    year: p.year,
    abstract: p.abstract,
    doi: p.externalIds?.DOI,
    arxivId: p.externalIds?.ArXiv,
    citationCount: p.citationCount,
  }))

  return NextResponse.json({ papers })
}
