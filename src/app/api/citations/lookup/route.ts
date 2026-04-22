import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ingest } from '@/lib/rag/ingest'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, doi, arxivId, title, authors, abstract, year, bibtex } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let resolvedBibtex = bibtex
  let resolvedTitle = title
  let resolvedAbstract = abstract
  let resolvedAuthors = authors
  let resolvedYear = year
  let resolvedArxivId = arxivId

  // Resolve from arXiv
  if (arxivId && !resolvedBibtex) {
    // Use the arXiv Atom API (the /abs/ URL returns HTML, not XML)
    const arxivRes = await fetch(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`
    ).catch(() => null)

    if (arxivRes?.ok) {
      const xml = await arxivRes.text()
      // Parse only the <entry> block (outer feed has its own <title>)
      const entry = xml.match(/<entry>[\s\S]*?<\/entry>/)?.[0] ?? ''
      const parsedTitle = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ')
      const parsedAbstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ')
      const authorMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      const parsedAuthors = authorMatches.map((m) => m[1].trim()).join(' and ')
      const parsedYear = entry.match(/<published>(\d{4})/)?.[1]

      if (parsedTitle) resolvedTitle = parsedTitle
      if (parsedAbstract) resolvedAbstract = parsedAbstract
      if (parsedAuthors) resolvedAuthors = parsedAuthors
      if (parsedYear) resolvedYear = parseInt(parsedYear, 10)
    }

    const citeKey = `arxiv${arxivId.replace(/[^a-zA-Z0-9]/g, '')}`
    resolvedBibtex = `@article{${citeKey},
  title={${resolvedTitle || 'Unknown Title'}},
  author={${resolvedAuthors || 'Unknown Author'}},
  journal={arXiv preprint arXiv:${arxivId}},
  year={${resolvedYear || new Date().getFullYear()}}
}`
  }

  // Resolve from DOI
  if (doi && !resolvedBibtex) {
    const doiRes = await fetch(`https://doi.org/${doi}`, {
      headers: { Accept: 'application/x-bibtex' },
    }).catch(() => null)

    if (doiRes?.ok) {
      resolvedBibtex = await doiRes.text()
    } else {
      const citeKey = `doi${doi.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`
      resolvedBibtex = `@article{${citeKey},
  title={${resolvedTitle ?? 'Unknown Title'}},
  author={${resolvedAuthors ?? 'Unknown Author'}},
  year={${resolvedYear ?? new Date().getFullYear()}},
  doi={${doi}}
}`
    }
  }

  if (!resolvedBibtex) {
    return NextResponse.json({ error: 'Could not resolve citation' }, { status: 400 })
  }

  const citation = await prisma.citation.create({
    data: {
      projectId,
      bibtex: resolvedBibtex,
      doi: doi ?? null,
      arxivId: resolvedArxivId ?? null,
      title: resolvedTitle ?? null,
      authors: resolvedAuthors ?? null,
      abstract: resolvedAbstract ?? null,
      year: resolvedYear ?? null,
    },
  })

  if (resolvedTitle || resolvedAbstract) {
    ingest({
      projectId,
      sourceType: 'citation',
      sourceId: citation.id,
      sourceLabel: `Citation: ${resolvedTitle ?? doi ?? arxivId}`,
      text: [resolvedTitle, resolvedAuthors, resolvedAbstract].filter(Boolean).join('\n\n'),
    }).catch(console.error)
  }

  return NextResponse.json(citation, { status: 201 })
}
