import { retrieve, RetrievedChunk } from './retriever'

export async function buildContext(
  query: string,
  projectId: string,
  sourceTypes?: string[]
): Promise<string> {
  const chunks = await retrieve(query, projectId, { topK: 8, sourceTypes })

  if (chunks.length === 0) return ''

  const formatted = chunks
    .map(
      (c, i) =>
        `[${i + 1}] [${c.sourceType.toUpperCase()}: ${c.sourceLabel}]\n${c.text}`
    )
    .join('\n\n---\n\n')

  return `## Relevant context from your research\n\n${formatted}\n\n---\n\nUse the above context to inform your response. Cite sources as [1], [2] etc. where relevant. Do not fabricate information not present in the context.`
}

export async function augmentMessages(
  userMessage: string,
  projectId: string,
  existingMessages: Array<{ role: string; content: string }>,
  sourceTypes?: string[]
): Promise<Array<{ role: string; content: string }>> {
  const context = await buildContext(userMessage, projectId, sourceTypes)
  if (!context) return [...existingMessages, { role: 'user', content: userMessage }]

  return [
    ...existingMessages,
    {
      role: 'user',
      content: `${context}\n\n## User question\n\n${userMessage}`,
    },
  ]
}

export type { RetrievedChunk }
