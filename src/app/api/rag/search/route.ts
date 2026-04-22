import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { retrieve } from '@/lib/rag/retriever'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('projectId')
  const query = req.nextUrl.searchParams.get('q')
  const topK = parseInt(req.nextUrl.searchParams.get('topK') ?? '8', 10)

  if (!projectId || !query) {
    return NextResponse.json({ error: 'projectId and q required' }, { status: 400 })
  }

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const chunks = await retrieve(query, projectId, { topK })
  return NextResponse.json({ chunks, query, projectId })
}
