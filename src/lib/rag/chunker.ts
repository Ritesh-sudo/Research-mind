export function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 50
): string[] {
  const separators = ['\n\n', '\n', '. ', ' ']
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize
    if (end >= text.length) {
      chunks.push(text.slice(start).trim())
      break
    }
    let bestBreak = end
    for (const sep of separators) {
      const pos = text.lastIndexOf(sep, end)
      if (pos > start + chunkSize * 0.5) {
        bestBreak = pos + sep.length
        break
      }
    }
    chunks.push(text.slice(start, bestBreak).trim())
    start = bestBreak - overlap
  }

  return chunks.filter((c) => c.length > 30)
}
