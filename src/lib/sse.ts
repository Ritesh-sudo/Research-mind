/**
 * Parse a ReadableStream of SSE `data: ...\n\n` messages. Yields each JSON-parsed
 * payload once, handling UTF-8 correctly and re-assembling lines split across
 * stream chunks. Stops when a `[DONE]` sentinel arrives.
 */
export async function* parseSSE<T = unknown>(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        if (buffer.trim()) {
          const parsed = tryParseDataLine<T>(buffer)
          if (parsed !== undefined) yield parsed
        }
        return
      }
      buffer += decoder.decode(value, { stream: true })
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          yield JSON.parse(data) as T
        } catch {
          /* skip malformed */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function tryParseDataLine<T>(line: string): T | undefined {
  if (!line.startsWith('data: ')) return undefined
  const data = line.slice(6)
  if (data === '[DONE]') return undefined
  try {
    return JSON.parse(data) as T
  } catch {
    return undefined
  }
}
