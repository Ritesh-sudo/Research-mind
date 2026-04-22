import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ingest } from '@/lib/rag/ingest'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const projectId = formData.get('projectId') as string
  const file = formData.get('file') as File

  if (!projectId || !file) {
    return NextResponse.json({ error: 'projectId and file required' }, { status: 400 })
  }

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.uploadedPaper.count({ where: { projectId } })
  if (existing >= 20) {
    return NextResponse.json({ error: 'Maximum 20 PDFs per project' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  let text = ''
  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfParseModule
    const parsed = await pdfParse(buffer)
    text = parsed.text
  } catch {
    text = `[PDF: ${file.name} — text extraction failed]`
  }

  const paper = await prisma.uploadedPaper.create({
    data: { projectId, filename: file.name, extractedText: text },
  })

  ingest({
    projectId,
    sourceType: 'pdf',
    sourceId: paper.id,
    sourceLabel: file.name,
    text,
  }).catch(console.error)

  return NextResponse.json({ id: paper.id, filename: paper.filename, chunks: text.length }, { status: 201 })
}
