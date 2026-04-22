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

  const diagrams = await prisma.diagram.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, type: true, code: true, caption: true, figLabel: true, svgCache: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json({ diagrams })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, title, type, code, caption, figLabel, svgCache } = await req.json()
  if (!projectId || !code) return NextResponse.json({ error: 'projectId and code required' }, { status: 400 })

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const diagram = await prisma.diagram.create({
    data: { projectId, title: title ?? 'Untitled Diagram', type: type ?? 'flowchart', code, caption: caption ?? '', figLabel: figLabel ?? 'fig:diagram', svgCache },
  })

  return NextResponse.json({ diagram })
}
