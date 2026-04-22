import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ingest } from '@/lib/rag/ingest'
import { enqueueJob } from '@/lib/jobs/queue'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, content, createSnapshot, label } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const doc = await prisma.latexDocument.upsert({
    where: { projectId },
    update: { content, version: { increment: 1 } },
    create: { projectId, content },
  })

  if (createSnapshot) {
    await prisma.documentSnapshot.create({
      data: { documentId: projectId, content, label: label ?? `v${doc.version}` },
    })
  }

  ingest({
    projectId,
    sourceType: 'latex',
    sourceId: doc.id,
    sourceLabel: `LaTeX document: ${project.title}`,
    text: content,
  }).catch(console.error)

  enqueueJob({ type: 'contradiction_scan', projectId, documentId: doc.id }).catch(console.error)

  return NextResponse.json(doc)
}
