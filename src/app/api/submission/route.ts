import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProviderForTask, RESEARCH_SYSTEM_PROMPT } from '@/lib/ai/router'

type Venue = 'neurips' | 'icml' | 'iclr' | 'emnlp' | 'acl' | 'cvpr' | 'iccv' | 'aaai'

interface VenueSpec {
  name: string
  pageLimit: number
  anonymized: boolean
  deadline: string
  format: string
}

const VENUES: Record<Venue, VenueSpec> = {
  neurips: { name: 'NeurIPS 2025', pageLimit: 9, anonymized: true, deadline: '2025-05-23', format: 'neurips' },
  icml: { name: 'ICML 2025', pageLimit: 8, anonymized: true, deadline: '2025-01-31', format: 'icml' },
  iclr: { name: 'ICLR 2025', pageLimit: 8, anonymized: true, deadline: '2024-10-01', format: 'iclr' },
  emnlp: { name: 'EMNLP 2025', pageLimit: 8, anonymized: true, deadline: '2025-06-01', format: 'acl' },
  acl: { name: 'ACL 2025', pageLimit: 8, anonymized: true, deadline: '2025-02-15', format: 'acl' },
  cvpr: { name: 'CVPR 2025', pageLimit: 8, anonymized: true, deadline: '2024-11-14', format: 'ieee' },
  iccv: { name: 'ICCV 2025', pageLimit: 8, anonymized: true, deadline: '2025-03-07', format: 'ieee' },
  aaai: { name: 'AAAI 2025', pageLimit: 7, anonymized: true, deadline: '2024-08-15', format: 'aaai' },
}

interface CheckResult {
  category: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  suggestion?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, venue } = await req.json()

  const project = await prisma.researchProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { document: true, citations: true },
  })
  if (!project?.document) return NextResponse.json({ error: 'No document' }, { status: 404 })

  const content = project.document.content
  const venueSpec = VENUES[venue as Venue]
  const checks: CheckResult[] = []

  // Estimate page count (rough: ~500 words per page)
  const wordCount = content.split(/\s+/).length
  const estimatedPages = Math.ceil(wordCount / 500)
  checks.push({
    category: 'Length',
    status: venueSpec
      ? estimatedPages <= venueSpec.pageLimit
        ? 'pass'
        : estimatedPages <= venueSpec.pageLimit + 2
          ? 'warning'
          : 'fail'
      : 'warning',
    message: `~${estimatedPages} estimated pages (limit: ${venueSpec?.pageLimit ?? '?'})`,
    suggestion: estimatedPages > (venueSpec?.pageLimit ?? 9)
      ? 'Reduce paper length. Consider trimming related work or moving proofs to appendix.'
      : undefined,
  })

  // Check anonymization
  const authorPatterns = [/\\author\{[^}]*[A-Z][a-z]+/g, /\\email\{[^}]+\}/g, /https?:\/\/github\.com\/[a-zA-Z0-9-]+/g]
  const hasAuthorInfo = authorPatterns.some((p) => p.test(content))
  if (venueSpec?.anonymized) {
    checks.push({
      category: 'Anonymization',
      status: hasAuthorInfo ? 'fail' : 'pass',
      message: hasAuthorInfo
        ? 'Author information detected in document — blind review violation'
        : 'No author identifiers found',
      suggestion: hasAuthorInfo ? 'Remove \\author, \\email, and any GitHub/institutional links that identify you.' : undefined,
    })
  }

  // Required sections
  const requiredSections = ['Introduction', 'Related Work', 'Conclusion']
  for (const sec of requiredSections) {
    const present = new RegExp(`\\\\section\\{${sec}`, 'i').test(content)
    checks.push({
      category: 'Sections',
      status: present ? 'pass' : 'warning',
      message: `${sec}: ${present ? 'present' : 'missing'}`,
      suggestion: present ? undefined : `Add a \\section{${sec}} section.`,
    })
  }

  // Abstract
  const hasAbstract = /\\begin\{abstract\}[\s\S]{100,}\\end\{abstract\}/.test(content)
  checks.push({
    category: 'Abstract',
    status: hasAbstract ? 'pass' : 'fail',
    message: hasAbstract ? 'Abstract present and non-empty' : 'Abstract missing or too short',
    suggestion: hasAbstract ? undefined : 'Add a \\begin{abstract}...\\end{abstract} block with 150-250 words.',
  })

  // Figures
  const figureCount = (content.match(/\\begin\{figure/g) ?? []).length
  checks.push({
    category: 'Figures',
    status: figureCount >= 1 ? 'pass' : 'warning',
    message: `${figureCount} figure${figureCount !== 1 ? 's' : ''} found`,
    suggestion: figureCount === 0 ? 'Consider adding figures to illustrate your method or results.' : undefined,
  })

  // Caption completeness
  const figBlocks = content.match(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g) ?? []
  const uncaptioned = figBlocks.filter((b) => !b.includes('\\caption')).length
  if (figBlocks.length > 0) {
    checks.push({
      category: 'Captions',
      status: uncaptioned === 0 ? 'pass' : 'fail',
      message: uncaptioned === 0 ? 'All figures have captions' : `${uncaptioned} figure(s) missing captions`,
      suggestion: uncaptioned > 0 ? 'Add \\caption{} to all figures and tables.' : undefined,
    })
  }

  // Citations
  const citeCount = (content.match(/\\cite\{/g) ?? []).length
  checks.push({
    category: 'Citations',
    status: citeCount >= 10 ? 'pass' : citeCount >= 5 ? 'warning' : 'fail',
    message: `${citeCount} citation${citeCount !== 1 ? 's' : ''} in text`,
    suggestion: citeCount < 10 ? 'Consider adding more references to contextualize your work.' : undefined,
  })

  // Venue deadline
  if (venueSpec) {
    const deadline = new Date(venueSpec.deadline)
    const now = new Date()
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    checks.push({
      category: 'Deadline',
      status: daysLeft > 14 ? 'pass' : daysLeft > 0 ? 'warning' : 'fail',
      message: daysLeft > 0 ? `${daysLeft} days until ${venueSpec.name} deadline` : `${venueSpec.name} deadline has passed`,
    })
  }

  // AI overall assessment
  const ai = getProviderForTask('reviewer_sim')
  const failCount = checks.filter((c) => c.status === 'fail').length
  const warnCount = checks.filter((c) => c.status === 'warning').length
  const score = Math.max(0, 100 - failCount * 20 - warnCount * 5)

  return NextResponse.json({
    checks,
    score,
    venue: venueSpec ?? null,
    summary: `${checks.filter((c) => c.status === 'pass').length} passed, ${warnCount} warnings, ${failCount} failed`,
  })
}
