import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ingest } from '@/lib/rag/ingest'
import { getTemplate } from '@/lib/latex/templates'
import type { LatexTemplate } from '@/lib/latex/templates'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.researchProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true, citations: true, papers: true } } },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, topic, template = 'neurips' } = await req.json()
  if (!title || !topic) return NextResponse.json({ error: 'title and topic required' }, { status: 400 })

  const project = await prisma.researchProject.create({
    data: { userId: session.user.id, title, topic, template },
  })

  const latexContent = getTemplate(template as LatexTemplate, title, topic)
  await prisma.latexDocument.create({
    data: { projectId: project.id, content: latexContent },
  })

  ingest({
    projectId: project.id,
    sourceType: 'latex',
    sourceId: project.id + '_seed',
    sourceLabel: `Project: ${title}`,
    text: `Research project: ${title}\n\nTopic: ${topic}`,
  }).catch(console.error)

  return NextResponse.json(project, { status: 201 })
}
