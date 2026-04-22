import { embed } from './embedder'
import { prisma } from '@/lib/prisma'

export type RetrievedChunk = {
  text: string
  sourceLabel: string
  sourceType: string
  similarity: number
}

export async function retrieve(
  query: string,
  projectId: string,
  options?: {
    topK?: number
    sourceTypes?: string[]
    minSimilarity?: number
  }
): Promise<RetrievedChunk[]> {
  const topK = options?.topK ?? 8
  const minSim = options?.minSimilarity ?? 0.3
  const [queryEmbedding] = await embed([query])
  const embeddingStr = JSON.stringify(queryEmbedding)

  let results: RetrievedChunk[]

  if (options?.sourceTypes && options.sourceTypes.length > 0) {
    const types = options.sourceTypes
    results = await prisma.$queryRaw<RetrievedChunk[]>`
      SELECT text, "sourceLabel", "sourceType",
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM "Chunk"
      WHERE "projectId" = ${projectId}
        AND "sourceType" = ANY(${types}::text[])
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK * 2}
    `
  } else {
    results = await prisma.$queryRaw<RetrievedChunk[]>`
      SELECT text, "sourceLabel", "sourceType",
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM "Chunk"
      WHERE "projectId" = ${projectId}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK * 2}
    `
  }

  return results
    .filter((r) => Number(r.similarity) >= minSim)
    .slice(0, topK)
}
