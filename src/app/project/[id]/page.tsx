import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ResearchWorkspace } from '@/components/layout/ResearchWorkspace'
import { MobileWorkspace } from '@/components/layout/MobileWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

function isMobile(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}

export default async function ProjectPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const { id } = await params

  const project = await prisma.researchProject.findFirst({
    where: { id, userId: session.user.id },
    include: {
      document: true,
      messages: { orderBy: { timestamp: 'asc' }, take: 100 },
      citations: true,
      hypotheses: { orderBy: { createdAt: 'desc' } },
      nodes: true,
      edges: true,
      papers: true,
    },
  })

  if (!project) notFound()

  const initialData = {
    content: project.document?.content ?? '',
    messages: project.messages.map((m: typeof project.messages[number]) => ({
      id: m.id,
      projectId: m.projectId,
      role: m.role,
      content: m.content,
      aiProvider: m.aiProvider ?? undefined,
      aiModel: m.aiModel ?? undefined,
      sources: (m.sources as unknown[] | null) ?? undefined,
      timestamp: m.timestamp.toISOString(),
    })),
    citations: project.citations,
    hypotheses: project.hypotheses.map((h: typeof project.hypotheses[number]) => ({
      ...h,
      status: h.status as 'unconfirmed' | 'partial' | 'supported' | 'contradicted',
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
    nodes: project.nodes,
    edges: project.edges,
    papers: project.papers.map((p: typeof project.papers[number]) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  }

  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const mobile = isMobile(ua)

  if (mobile) {
    return <MobileWorkspace projectId={id} />
  }

  return <ResearchWorkspace projectId={id} initialData={initialData} />
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const project = await prisma.researchProject.findUnique({
    where: { id },
    select: { title: true },
  })
  return { title: project ? `${project.title} — ResearchMind AI` : 'ResearchMind AI' }
}
