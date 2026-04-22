import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enqueueJob } from '@/lib/jobs/queue'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, statement } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hypothesis = await prisma.hypothesis.create({
    data: { projectId, statement },
  })

  await ingestHypothesis(hypothesis.id, projectId, statement)
  await enqueueJob({ type: 'hypothesis_eval', projectId, hypothesisId: hypothesis.id })

  return NextResponse.json(hypothesis, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const hypotheses = await prisma.hypothesis.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(hypotheses)
}

async function ingestHypothesis(id: string, projectId: string, statement: string) {
  const { ingest } = await import('@/lib/rag/ingest')
  await ingest({
    projectId,
    sourceType: 'hypothesis',
    sourceId: id,
    sourceLabel: `Hypothesis: ${statement.slice(0, 50)}`,
    text: statement,
  })
}
