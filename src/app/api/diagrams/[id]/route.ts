import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwned(id: string, userId: string) {
  return prisma.diagram.findFirst({
    where: { id, project: { userId } },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getOwned(id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const diagram = await prisma.diagram.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.caption !== undefined && { caption: body.caption }),
      ...(body.figLabel !== undefined && { figLabel: body.figLabel }),
      ...(body.svgCache !== undefined && { svgCache: body.svgCache }),
      ...(body.type !== undefined && { type: body.type }),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ diagram })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getOwned(id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.diagram.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
