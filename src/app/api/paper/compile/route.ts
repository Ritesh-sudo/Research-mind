import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { shimMissingStyles } from '@/lib/latex/shim'

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, content } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workDir = join(tmpdir(), `latex-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const texFile = join(workDir, 'main.tex')

  try {
    const { content: compileContent, shimmed } = await shimMissingStyles(content)
    await writeFile(texFile, compileContent, 'utf8')

    const { stdout, stderr } = await execAsync(
      `pdflatex -interaction=nonstopmode -output-directory=${workDir} ${texFile}`,
      { timeout: 30000 }
    ).catch((err) => ({ stdout: err.stdout ?? '', stderr: err.stderr ?? '' }))

    const pdfPath = join(workDir, 'main.pdf')
    let pdfBase64: string | null = null
    let errors: string[] = []

    try {
      const pdfBuffer = await readFile(pdfPath)
      pdfBase64 = pdfBuffer.toString('base64')
    } catch {
      // PDF not generated
    }

    const fullOutput = stdout + stderr

    // Parse LaTeX errors from stdout — pair '! message' with the following 'l.N' context line
    const outputLines = fullOutput.split('\n')
    const lineErrors: Array<{ line: number; message: string }> = []
    errors = []

    for (let i = 0; i < outputLines.length; i++) {
      const line = outputLines[i]
      if (line.startsWith('!')) {
        const msg = line.slice(1).trim()
        errors.push(msg)
        // Look ahead for the l.N line to get the line number
        for (let j = i + 1; j < Math.min(i + 10, outputLines.length); j++) {
          const ctxMatch = outputLines[j].match(/^l\.(\d+)\s*(.*)/)
          if (ctxMatch) {
            lineErrors.push({ line: parseInt(ctxMatch[1], 10), message: msg })
            break
          }
        }
      }
    }

    // Fallback: if no '!' errors found, scan for 'l.N' patterns
    if (lineErrors.length === 0) {
      const lineRegex = /l\.(\d+)\s+(.*)/g
      let m
      while ((m = lineRegex.exec(fullOutput)) !== null) {
        lineErrors.push({ line: parseInt(m[1], 10), message: m[2].trim() })
      }
    }

    if (pdfBase64) {
      await prisma.latexDocument.update({
        where: { projectId },
        data: { compiledPdfUrl: `data:application/pdf;base64,${pdfBase64}` },
      })
    }

    return NextResponse.json({ pdfBase64, errors, lineErrors, shimmed, success: !!pdfBase64 })
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
