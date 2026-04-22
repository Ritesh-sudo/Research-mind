import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const researchQueue = new Queue('research-jobs', { connection })

export type JobData =
  | { type: 'contradiction_scan'; projectId: string; documentId: string }
  | { type: 'hypothesis_eval'; projectId: string; hypothesisId: string }
  | { type: 'arxiv_feed'; projectId: string }
  | { type: 'ingest'; projectId: string; sourceType: string; sourceId: string; sourceLabel: string; text: string }

export async function enqueueJob(data: JobData): Promise<void> {
  await researchQueue.add(data.type, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })
}
