import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieve } from '@/lib/rag/retriever'
import { ingest } from '@/lib/rag/ingest'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const [nodes, edges] = await Promise.all([
    prisma.knowledgeNode.findMany({ where: { projectId } }),
    prisma.knowledgeEdge.findMany({ where: { projectId } }),
  ])

  return NextResponse.json({ nodes, edges })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, label, type, summary, x, y } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // RAG dedup: check if similar node exists
  const similar = await retrieve(label, projectId, {
    topK: 3,
    minSimilarity: 0.85,
  }).catch(() => [])

  const existingNodes = await prisma.knowledgeNode.findMany({
    where: { projectId, label: { contains: label.slice(0, 20), mode: 'insensitive' } },
    take: 1,
  })

  if (existingNodes.length > 0) {
    return NextResponse.json({ node: existingNodes[0], duplicate: true })
  }

  const node = await prisma.knowledgeNode.create({
    data: {
      projectId,
      label,
      type: type ?? 'concept',
      summary: summary ?? null,
      x: x ?? Math.random() * 600,
      y: y ?? Math.random() * 400,
    },
  })

  ingest({
    projectId,
    sourceType: 'hypothesis',
    sourceId: node.id,
    sourceLabel: `Graph node: ${label}`,
    text: [label, summary].filter(Boolean).join('\n'),
  }).catch(console.error)

  return NextResponse.json({ node, duplicate: false }, { status: 201 })
}
