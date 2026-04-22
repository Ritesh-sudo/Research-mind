export async function embed(texts: string[]): Promise<number[][]> {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'ollama'

  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    const model = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text'
    const results = await Promise.all(
      texts.map(async (text) => {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: text }),
        })
        if (!res.ok) throw new Error(`Ollama embed error: ${res.statusText}`)
        const data = await res.json()
        return data.embedding as number[]
      })
    )
    return results
  }

  if (provider === 'openai') {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.embeddings.create({
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
      input: texts,
    })
    return res.data.map((d) => d.embedding)
  }

  throw new Error(`Unknown embedding provider: ${provider}`)
}

export function validateEmbeddingDimension(embedding: number[]): void {
  const expected = parseInt(process.env.EMBEDDING_DIM ?? '768', 10)
  if (embedding.length !== expected) {
    throw new Error(
      `Embedding dimension mismatch: got ${embedding.length}, expected ${expected}. ` +
        `Check EMBEDDING_MODEL and EMBEDDING_DIM env vars.`
    )
  }
}
