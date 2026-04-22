import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      collaborators: { include: { user: true } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const project = await prisma.researchProject.updateMany({
    where: { id, userId: session.user.id },
    data: { title: body.title, topic: body.topic, status: body.status },
  })

  return NextResponse.json({ updated: project.count })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await prisma.researchProject.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ deleted: true })
}
