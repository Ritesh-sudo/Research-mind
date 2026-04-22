'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Message, Citation, Hypothesis, KnowledgeNode, KnowledgeEdge, UploadedPaper, LatexDocument } from '@/types'

interface ProjectState {
  activeProjectId: string | null
  latexContent: string
  messages: Message[]
  citations: Citation[]
  hypotheses: Hypothesis[]
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  papers: UploadedPaper[]
  latexDoc: LatexDocument | null
  compiledPdfUrl: string | null
  isCompiling: boolean
  isChatStreaming: boolean
  leftPanelTab: 'chat' | 'graph' | 'hypothesis' | 'arxiv' | 'citations' | 'ai_tools' | 'submission' | 'corpus' | 'replay' | 'review' | 'settings' | 'diagrams' | 'experiments'
  rightPanelVisible: boolean
  sidebarCollapsed: boolean

  setActiveProject: (id: string) => void
  setLatexContent: (content: string) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateLastMessage: (content: string) => void
  setCitations: (citations: Citation[]) => void
  addCitation: (citation: Citation) => void
  setHypotheses: (hypotheses: Hypothesis[]) => void
  addHypothesis: (hypothesis: Hypothesis) => void
  updateHypothesis: (id: string, updates: Partial<Hypothesis>) => void
  setNodes: (nodes: KnowledgeNode[]) => void
  setEdges: (edges: KnowledgeEdge[]) => void
  setPapers: (papers: UploadedPaper[]) => void
  setLatexDoc: (doc: LatexDocument | null) => void
  setCompiledPdfUrl: (url: string | null) => void
  setIsCompiling: (value: boolean) => void
  setIsChatStreaming: (value: boolean) => void
  setLeftPanelTab: (tab: ProjectState['leftPanelTab'] | string) => void
  toggleRightPanel: () => void
  toggleSidebar: () => void
  reset: () => void
}

const initial = {
  activeProjectId: null,
  latexContent: '',
  messages: [],
  citations: [],
  hypotheses: [],
  nodes: [],
  edges: [],
  papers: [],
  latexDoc: null,
  compiledPdfUrl: null,
  isCompiling: false,
  isChatStreaming: false,
  leftPanelTab: 'chat' as ProjectState['leftPanelTab'],
  rightPanelVisible: true,
  sidebarCollapsed: false,
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initial,

      setActiveProject: (id) => set({ activeProjectId: id }),
      setLatexContent: (content) => set({ latexContent: content }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateLastMessage: (content) =>
        set((s) => {
          const msgs = [...s.messages]
          if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
          return { messages: msgs }
        }),
      setCitations: (citations) => set({ citations }),
      addCitation: (citation) => set((s) => ({ citations: [...s.citations, citation] })),
      setHypotheses: (hypotheses) => set({ hypotheses }),
      addHypothesis: (hypothesis) =>
        set((s) => ({ hypotheses: [...s.hypotheses, hypothesis] })),
      updateHypothesis: (id, updates) =>
        set((s) => ({
          hypotheses: s.hypotheses.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      setPapers: (papers) => set({ papers }),
      setLatexDoc: (doc) => set({ latexDoc: doc }),
      setCompiledPdfUrl: (url) => set({ compiledPdfUrl: url }),
      setIsCompiling: (value) => set({ isCompiling: value }),
      setIsChatStreaming: (value) => set({ isChatStreaming: value }),
      setLeftPanelTab: (tab) => set({ leftPanelTab: tab as ProjectState['leftPanelTab'] }),
      toggleRightPanel: () => set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      reset: () => set(initial),
    }),
    { name: 'research-mind-project', partialize: (s) => ({ activeProjectId: s.activeProjectId, leftPanelTab: s.leftPanelTab }) }
  )
)
