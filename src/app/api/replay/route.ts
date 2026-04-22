import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [messages, snapshots, citations, hypotheses] = await Promise.all([
    prisma.researchMessage.findMany({
      where: { projectId },
      orderBy: { timestamp: 'asc' },
      select: { id: true, role: true, content: true, timestamp: true, aiProvider: true, aiModel: true },
    }),
    prisma.documentSnapshot.findMany({
      where: { documentId: projectId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, createdAt: true },
    }),
    prisma.citation.findMany({
      where: { projectId },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    }),
    prisma.hypothesis.findMany({
      where: { projectId },
      select: { id: true, statement: true, createdAt: true, evidenceScore: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Merge all events into a unified timeline
  type TimelineEvent = {
    id: string
    type: 'message' | 'snapshot' | 'citation' | 'hypothesis'
    timestamp: string
    data: Record<string, unknown>
  }

  const timeline: TimelineEvent[] = [
    ...messages.map((m) => ({
      id: m.id,
      type: 'message' as const,
      timestamp: m.timestamp.toISOString(),
      data: { role: m.role, content: m.content.slice(0, 200), aiProvider: m.aiProvider },
    })),
    ...snapshots.map((s) => ({
      id: s.id,
      type: 'snapshot' as const,
      timestamp: s.createdAt.toISOString(),
      data: { label: s.label },
    })),
    ...citations.map((c) => ({
      id: c.id,
      type: 'citation' as const,
      timestamp: project.createdAt.toISOString(),
      data: { title: c.title },
    })),
    ...hypotheses.map((h) => ({
      id: h.id,
      type: 'hypothesis' as const,
      timestamp: h.createdAt.toISOString(),
      data: { statement: h.statement, evidenceScore: h.evidenceScore },
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return NextResponse.json({ timeline, project: { title: project.title, topic: project.topic } })
}
