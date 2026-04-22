import { chunkText } from './chunker'
import { embed } from './embedder'
import { prisma } from '@/lib/prisma'

export type IngestSource = {
  projectId: string
  sourceType: 'pdf' | 'chat' | 'latex' | 'citation' | 'hypothesis' | 'arxiv'
  sourceId: string
  sourceLabel: string
  text: string
}

export async function ingest(source: IngestSource): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "Chunk"
    WHERE "sourceId" = ${source.sourceId}
      AND "sourceType" = ${source.sourceType}
      AND "projectId" = ${source.projectId}
  `

  const chunks = chunkText(source.text)
  if (chunks.length === 0) return

  const embeddings = await embed(chunks)

  for (let i = 0; i < chunks.length; i++) {
    const embeddingStr = JSON.stringify(embeddings[i])
    await prisma.$executeRaw`
      INSERT INTO "Chunk" (
        "id", "projectId", "sourceType", "sourceId", "sourceLabel",
        "chunkIndex", "text", "embedding", "createdAt"
      )
      VALUES (
        gen_random_uuid()::text,
        ${source.projectId},
        ${source.sourceType},
        ${source.sourceId},
        ${source.sourceLabel},
        ${i},
        ${chunks[i]},
        ${embeddingStr}::vector,
        NOW()
      )
    `
  }
}
