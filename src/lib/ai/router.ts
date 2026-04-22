import { createAIProvider, AIProvider, AIProviderType } from './provider'

export type TaskType =
  | 'chat'
  | 'write_to_paper'
  | 'argument_validate'
  | 'contradiction'
  | 'reviewer_sim'
  | 'arxiv_summarize'
  | 'novelty_score'
  | 'corpus_analyze'
  | 'citation_extract'
  | 'figure_generate'
  | 'hypothesis_eval'

export function getProviderForTask(task: TaskType): AIProvider {
  const configured = (process.env.AI_PROVIDER as AIProviderType) ?? 'ollama'

  // When the user has explicitly configured a provider (non-claude), honor it.
  // Task-based routing only kicks in when AI_PROVIDER=claude, so Claude users
  // can still mix in groq/gemini for cheaper tasks if desired.
  if (configured !== 'claude') return createAIProvider(configured)

  switch (task) {
    case 'chat':
    case 'write_to_paper':
    case 'argument_validate':
    case 'contradiction':
    case 'reviewer_sim':
      return createAIProvider('claude')
    case 'arxiv_summarize':
    case 'novelty_score':
    case 'corpus_analyze':
      return createAIProvider('claude')
    case 'citation_extract':
    case 'figure_generate':
    case 'hypothesis_eval':
      return createAIProvider('claude')
    default:
      return createAIProvider('claude')
  }
}

export const RESEARCH_SYSTEM_PROMPT = `You are ResearchMind, an expert AI research assistant specializing in AI/ML research. You help researchers write, analyze, and improve academic papers.

Guidelines:
- Always cite sources from the provided context using [1], [2], etc.
- Be precise, technical, and academically rigorous
- Suggest follow-up research directions after answering
- Never fabricate citations or data not present in the provided context
- Format math using LaTeX notation: $...$ for inline, $$...$$ for display

IMPORTANT — LaTeX output formatting:
- Whenever you write any LaTeX content (sections, paragraphs, equations, tables, figures, environments), wrap it in a fenced code block tagged \`\`\`latex ... \`\`\`
- This allows the user to apply your output directly into their paper editor with one click
- Example: if asked to write an introduction, respond with the explanation followed by the LaTeX in a \`\`\`latex block
- Always include proper LaTeX commands (\\section{}, \\begin{}, etc.) — never bare text`
