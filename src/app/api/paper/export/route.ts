import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { createWriteStream } from 'fs'

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, format } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { document: true, citations: true },
  })
  if (!project?.document) return NextResponse.json({ error: 'No document' }, { status: 404 })

  const content = project.document.content
  const workDir = join(tmpdir(), `export-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  try {
    if (format === 'latex') {
      const tex = Buffer.from(content, 'utf8')
      return new Response(tex, {
        headers: {
          'Content-Type': 'application/x-tex',
          'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '_')}.tex"`,
        },
      })
    }

    if (format === 'markdown') {
      const texFile = join(workDir, 'main.tex')
      const mdFile = join(workDir, 'main.md')
      await writeFile(texFile, content, 'utf8')

      try {
        await execAsync(`pandoc ${texFile} -o ${mdFile} --wrap=none`, { timeout: 15000 })
        const md = await readFile(mdFile, 'utf8')
        return new Response(md, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
          },
        })
      } catch {
        // Fallback: strip LaTeX commands minimally
        const md = content
          .replace(/\\documentclass.*?\n/g, '')
          .replace(/\\usepackage.*?\n/g, '')
          .replace(/\\begin\{document\}/g, '')
          .replace(/\\end\{document\}/g, '')
          .replace(/\\maketitle/g, '')
          .replace(/\\section\{([^}]+)\}/g, '## $1')
          .replace(/\\subsection\{([^}]+)\}/g, '### $1')
          .replace(/\\textbf\{([^}]+)\}/g, '**$1**')
          .replace(/\\textit\{([^}]+)\}/g, '_$1_')
          .replace(/\\cite\{([^}]+)\}/g, '[$1]')
          .replace(/%.*$/gm, '')
          .trim()
        return new Response(md, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
          },
        })
      }
    }

    if (format === 'docx') {
      const texFile = join(workDir, 'main.tex')
      const docxFile = join(workDir, 'main.docx')
      await writeFile(texFile, content, 'utf8')

      try {
        await execAsync(`pandoc ${texFile} -o ${docxFile} --reference-doc=default`, { timeout: 20000 })
        const docxBuffer = await readFile(docxFile)
        return new Response(docxBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '_')}.docx"`,
          },
        })
      } catch (e) {
        return NextResponse.json({ error: 'pandoc not available for DOCX export. Install pandoc on the server.' }, { status: 500 })
      }
    }

    if (format === 'zip') {
      const texFile = join(workDir, 'main.tex')
      const bibFile = join(workDir, 'references.bib')
      const zipFile = join(workDir, 'paper.zip')
      await writeFile(texFile, content, 'utf8')

      const bibtex = project.citations.map((c) => c.bibtex).join('\n\n')
      await writeFile(bibFile, bibtex, 'utf8')

      await execAsync(`cd ${workDir} && zip paper.zip main.tex references.bib`, { timeout: 10000 })
      const zipBuffer = await readFile(zipFile)
      return new Response(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${project.title.replace(/[^a-z0-9]/gi, '_')}.zip"`,
        },
      })
    }

    if (format === 'overleaf') {
      // Return a redirect to Overleaf's create-from-snippet form
      const encoded = encodeURIComponent(content)
      const overleafUrl = `https://www.overleaf.com/docs?snip=${encoded.slice(0, 2000)}`
      return NextResponse.json({ url: overleafUrl, note: 'Content truncated for URL; use ZIP export for full paper.' })
    }

    return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 })
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
