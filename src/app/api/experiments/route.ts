import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.researchProject.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const experiments = await prisma.experiment.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 10 } },
  })

  return NextResponse.json({ experiments })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, name, description, code, language, params } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.researchProject.findFirst({ where: { id: projectId, userId: session.user.id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const experiment = await prisma.experiment.create({
    data: { projectId, name: name ?? 'Untitled Experiment', description: description ?? '', code: code ?? '', language: language ?? 'python', params: params ?? {} },
  })

  return NextResponse.json({ experiment: { ...experiment, runs: [] } })
}
