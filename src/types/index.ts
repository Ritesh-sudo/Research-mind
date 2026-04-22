export interface Project {
  id: string
  title: string
  topic: string
  template: string
  status: string
  noveltyScore: number | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  projectId: string
  role: 'user' | 'assistant'
  content: string
  aiProvider?: string
  aiModel?: string
  sources?: RetrievedChunk[]
  timestamp: string
}

export interface RetrievedChunk {
  text: string
  sourceLabel: string
  sourceType: string
  similarity: number
}

export interface Citation {
  id: string
  projectId: string
  bibtex: string
  doi?: string
  arxivId?: string
  title?: string
  authors?: string
  abstract?: string
  year?: number
}

export interface Hypothesis {
  id: string
  projectId: string
  statement: string
  evidenceScore: number
  status: 'unconfirmed' | 'partial' | 'supported' | 'contradicted'
  supportingChunks?: RetrievedChunk[]
  contradictingChunks?: RetrievedChunk[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeNode {
  id: string
  projectId: string
  label: string
  type: string
  summary?: string
  x: number
  y: number
}

export interface KnowledgeEdge {
  id: string
  projectId: string
  sourceId: string
  targetId: string
  relationship: string
}

export interface UploadedPaper {
  id: string
  projectId: string
  filename: string
  extractedText: string
  s3Url?: string
  createdAt: string
}

export interface ArxivPaper {
  id: string
  title: string
  authors: string[]
  abstract: string
  published: string
  link: string
  similarity?: number
}

export interface LatexDocument {
  id: string
  projectId: string
  content: string
  compiledPdfUrl?: string
  version: number
  updatedAt: string
}

export interface DocumentSnapshot {
  id: string
  documentId: string
  content: string
  label?: string
  createdAt: string
}
