import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trending = await prisma.researchProject.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: {
      user: { select: { name: true, image: true } },
      _count: { select: { messages: true, citations: true } },
    },
  })

  return NextResponse.json(trending)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, isPublic } = await req.json()

  await prisma.researchProject.updateMany({
    where: { id: projectId, userId: session.user.id },
    data: { isPublic },
  })

  return NextResponse.json({ updated: true })
}
