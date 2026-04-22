import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwned(id: string, userId: string) {
  return prisma.experiment.findFirst({ where: { id, project: { userId } } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await getOwned(id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const experiment = await prisma.experiment.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.params !== undefined && { params: body.params }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.metrics !== undefined && { metrics: body.metrics }),
      ...(body.logs !== undefined && { logs: body.logs }),
      ...(body.duration !== undefined && { duration: body.duration }),
      updatedAt: new Date(),
    },
  })
  return NextResponse.json({ experiment })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await getOwned(id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.experiment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
