'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  MessageSquare, Share2, FlaskConical, Rss, BookMarked,
  ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen,
  Wand2, ShieldCheck, History, MessageCircle, Settings, Upload, PenTool, TestTube2
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { LatexEditor } from '@/components/editor/LatexEditor'
import { PdfPreview } from '@/components/editor/PdfPreview'
import { KnowledgeGraph } from '@/components/graph/KnowledgeGraph'
import { HypothesisTracker } from '@/components/hypothesis/HypothesisTracker'
import { CitationManager } from '@/components/citations/CitationManager'
import { ArxivFeed } from '@/components/arxiv/ArxivFeed'
import { AISidebar } from '@/components/sidebar/AISidebar'
import { SubmissionChecker } from '@/components/sidebar/SubmissionChecker'
import { ResearchReplay } from '@/components/replay/ResearchReplay'
import { AdvisorReview } from '@/components/review/AdvisorReview'
import { ProviderSettings } from '@/components/settings/ProviderSettings'
import { CorpusUploader } from '@/components/corpus/CorpusUploader'
import { DiagramStudio } from '@/components/diagram/DiagramStudio'
import { ExperimentLab } from '@/components/experiment/ExperimentLab'
import { CommandPalette } from './CommandPalette'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { useProjectStore } from '@/store/useProjectStore'

type LeftTab = 'chat' | 'graph' | 'hypothesis' | 'arxiv' | 'citations' | 'ai_tools' | 'submission' | 'replay' | 'review' | 'settings' | 'corpus' | 'diagrams' | 'experiments'

const LEFT_TABS: { id: LeftTab; icon: React.ElementType; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'AI Chat' },
  { id: 'experiments', icon: TestTube2, label: 'Experiment Lab' },
  { id: 'diagrams', icon: PenTool, label: 'Diagram Studio' },
  { id: 'graph', icon: Share2, label: 'Knowledge Graph' },
  { id: 'hypothesis', icon: FlaskConical, label: 'Hypotheses' },
  { id: 'arxiv', icon: Rss, label: 'arXiv Feed' },
  { id: 'citations', icon: BookMarked, label: 'Citations' },
  { id: 'ai_tools', icon: Wand2, label: 'AI Sidebar Tools' },
  { id: 'submission', icon: ShieldCheck, label: 'Submission Checker' },
  { id: 'corpus', icon: Upload, label: 'Upload Papers' },
  { id: 'replay', icon: History, label: 'Research Replay' },
  { id: 'review', icon: MessageCircle, label: 'Advisor Review' },
  { id: 'settings', icon: Settings, label: 'Provider Settings' },
]

const ICON_BAR_W = 48
const MIN_LEFT = 200
const MIN_RIGHT = 200
const MIN_CENTER = 300

function useDragResize(
  initial: number,
  min: number,
  max: () => number,
  direction: 'left' | 'right' = 'left'
) {
  const [width, setWidth] = useState(initial)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = direction === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX
      const next = Math.max(min, Math.min(max(), startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [min, max, direction])

  return { width, onMouseDown }
}

interface ResearchWorkspaceProps {
  projectId: string
  initialData: {
    content: string
    messages: unknown[]
    citations: unknown[]
    hypotheses: unknown[]
    nodes: unknown[]
    edges: unknown[]
    papers: unknown[]
  }
}

export function ResearchWorkspace({ projectId, initialData }: ResearchWorkspaceProps) {
  const {
    leftPanelTab, setLeftPanelTab,
    rightPanelVisible, toggleRightPanel,
    sidebarCollapsed, toggleSidebar,
    setLatexContent, setMessages, setCitations, setHypotheses, setNodes, setEdges, setPapers,
    setActiveProject,
  } = useProjectStore()

  useEffect(() => {
    setActiveProject(projectId)
    setLatexContent(initialData.content)
    setMessages(initialData.messages as Parameters<typeof setMessages>[0])
    setCitations(initialData.citations as Parameters<typeof setCitations>[0])
    setHypotheses(initialData.hypotheses as Parameters<typeof setHypotheses>[0])
    setNodes(initialData.nodes as Parameters<typeof setNodes>[0])
    setEdges(initialData.edges as Parameters<typeof setEdges>[0])
    setPapers(initialData.papers as Parameters<typeof setPapers>[0])
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const containerRef = useRef<HTMLDivElement>(null)

  const getMaxLeft = useCallback(() => {
    const total = containerRef.current?.clientWidth ?? window.innerWidth
    return total - ICON_BAR_W - MIN_CENTER - (rightPanelVisible ? MIN_RIGHT : 0) - 8
  }, [rightPanelVisible])

  const getMaxRight = useCallback(() => {
    const total = containerRef.current?.clientWidth ?? window.innerWidth
    return total - ICON_BAR_W - (sidebarCollapsed ? 0 : leftPanel.width) - MIN_CENTER - 8
  }, [sidebarCollapsed]) // eslint-disable-line react-hooks/exhaustive-deps

  const leftPanel = useDragResize(360, MIN_LEFT, getMaxLeft, 'left')
  const rightPanel = useDragResize(420, MIN_RIGHT, getMaxRight, 'right')

  const renderLeftContent = () => {
    const tab = leftPanelTab as LeftTab
    switch (tab) {
      case 'chat': return <ChatPanel projectId={projectId} />
      case 'graph': return <KnowledgeGraph projectId={projectId} />
      case 'hypothesis': return <HypothesisTracker projectId={projectId} />
      case 'arxiv': return <ArxivFeed projectId={projectId} />
      case 'citations': return <CitationManager projectId={projectId} />
      case 'ai_tools': return <AISidebar projectId={projectId} />
      case 'submission': return <SubmissionChecker projectId={projectId} />
      case 'corpus': return <CorpusUploader projectId={projectId} />
      case 'replay': return <ResearchReplay projectId={projectId} />
      case 'review': return <AdvisorReview projectId={projectId} />
      case 'settings': return <ProviderSettings />
      case 'diagrams': return <DiagramStudio projectId={projectId} />
      case 'experiments': return <ExperimentLab projectId={projectId} />
      default: return <ChatPanel projectId={projectId} />
    }
  }

  return (
    <TooltipProvider>
      <div ref={containerRef} className="flex h-screen bg-background overflow-hidden">
        {/* Left sidebar tab icons */}
        <div className="flex flex-col items-center gap-0.5 py-3 px-1 border-r border-border bg-muted/30 w-12 shrink-0 overflow-y-auto">
          {LEFT_TABS.map(({ id, icon: Icon, label }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setLeftPanelTab(id)
                    if (sidebarCollapsed) toggleSidebar()
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    leftPanelTab === id && !sidebarCollapsed
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground shrink-0"
                aria-label={sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{sidebarCollapsed ? 'Expand' : 'Collapse'} panel</TooltipContent>
          </Tooltip>
        </div>

        {/* Left panel content */}
        {!sidebarCollapsed && (
          <>
            <div
              className="shrink-0 border-r border-border flex flex-col min-h-0"
              style={{ width: leftPanel.width }}
            >
              <div className="px-3 py-2 border-b border-border bg-muted/20 shrink-0">
                <span className="text-sm font-medium">
                  {LEFT_TABS.find((t) => t.id === leftPanelTab)?.label ?? 'AI Chat'}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ErrorBoundary>
                  {renderLeftContent()}
                </ErrorBoundary>
              </div>
            </div>
            {/* Left resize handle */}
            <div
              onMouseDown={leftPanel.onMouseDown}
              className="w-1 shrink-0 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors group relative z-10"
              title="Drag to resize"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          </>
        )}

        {/* Center: LaTeX Editor */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <ErrorBoundary>
            <LatexEditor projectId={projectId} />
          </ErrorBoundary>
        </div>

        {/* Right resize handle */}
        {rightPanelVisible && (
          <div
            onMouseDown={rightPanel.onMouseDown}
            className="w-1 shrink-0 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors relative z-10"
            title="Drag to resize"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Right: PDF Preview */}
        {rightPanelVisible && (
          <div
            className="shrink-0 border-l border-border flex flex-col min-h-0"
            style={{ width: rightPanel.width }}
          >
            <ErrorBoundary>
              <PdfPreview />
            </ErrorBoundary>
          </div>
        )}

        {/* Toggle right panel */}
        <button
          onClick={toggleRightPanel}
          className="fixed right-0 top-1/2 -translate-y-1/2 w-5 h-10 bg-muted border border-border rounded-l flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
          aria-label="Toggle PDF preview"
        >
          {rightPanelVisible ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
        </button>

        <CommandPalette projectId={projectId} />
        <OnboardingModal />
      </div>
    </TooltipProvider>
  )
}
