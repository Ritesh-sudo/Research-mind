import { Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { JobData } from './queue'
import { prisma } from '@/lib/prisma'
import { retrieve } from '@/lib/rag/retriever'
import { ingest } from '@/lib/rag/ingest'

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

async function processJob(job: Job<JobData>): Promise<void> {
  const data = job.data

  switch (data.type) {
    case 'ingest': {
      await ingest({
        projectId: data.projectId,
        sourceType: data.sourceType as 'pdf' | 'chat' | 'latex' | 'citation' | 'hypothesis' | 'arxiv',
        sourceId: data.sourceId,
        sourceLabel: data.sourceLabel,
        text: data.text,
      })
      break
    }

    case 'hypothesis_eval': {
      const hyp = await prisma.hypothesis.findUnique({ where: { id: data.hypothesisId } })
      if (!hyp) break

      const supporting = await retrieve(hyp.statement, data.projectId, {
        topK: 5,
        minSimilarity: 0.5,
        sourceTypes: ['pdf', 'chat', 'arxiv'],
      })

      const contradicting = await retrieve(`NOT: ${hyp.statement}`, data.projectId, {
        topK: 3,
        minSimilarity: 0.4,
        sourceTypes: ['pdf', 'chat'],
      })

      const score = Math.min(100, supporting.length * 15 + (contradicting.length === 0 ? 10 : 0))

      const status =
        score >= 70 ? 'supported' : score >= 40 ? 'partial' : 'unconfirmed'

      await prisma.hypothesis.update({
        where: { id: data.hypothesisId },
        data: {
          evidenceScore: score,
          status,
          supportingChunks: supporting as object[],
          contradictingChunks: contradicting as object[],
        },
      })
      break
    }

    case 'contradiction_scan': {
      const doc = await prisma.latexDocument.findUnique({
        where: { projectId: data.projectId },
      })
      if (!doc) break

      const sections = doc.content.split(/\\section\{/).slice(1)
      const findings: Array<{ section: string; count: number }> = []
      for (const section of sections) {
        const title = section.split('}')[0] ?? 'Unknown'
        const body = section.slice(0, 400)
        const chunks = await retrieve(`Contradiction with: ${body}`, data.projectId, {
          topK: 5,
          sourceTypes: ['latex', 'pdf'],
          minSimilarity: 0.55,
        })
        if (chunks.length > 0) findings.push({ section: title, count: chunks.length })
      }
      console.log(`[contradiction_scan] project=${data.projectId} flagged=${findings.length} sections`, findings)
      break
    }

    case 'arxiv_feed': {
      const project = await prisma.researchProject.findUnique({
        where: { id: data.projectId },
      })
      if (!project) break

      const res = await fetch(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(project.topic)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`
      )
      const xml = await res.text()
      const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? []

      for (const entry of entries.slice(0, 5)) {
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? ''
        const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() ?? ''
        const arxivId = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.split('/').pop() ?? ''

        if (title && abstract) {
          await ingest({
            projectId: data.projectId,
            sourceType: 'arxiv',
            sourceId: arxivId,
            sourceLabel: `arXiv: ${title}`,
            text: `${title}\n\n${abstract}`,
          })
        }
      }
      break
    }
  }
}

let worker: Worker | null = null

export function startWorker(): void {
  if (worker) return
  worker = new Worker('research-jobs', processJob, { connection })
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err)
  })
}
