'use client'
import React, { useState } from 'react'
import { MessageSquare, FileEdit, Eye, Wrench } from 'lucide-react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { LatexEditor } from '@/components/editor/LatexEditor'
import { PdfPreview } from '@/components/editor/PdfPreview'
import { AISidebar } from '@/components/sidebar/AISidebar'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { CommandPalette } from './CommandPalette'

type Tab = 'chat' | 'editor' | 'preview' | 'tools'

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'editor', icon: FileEdit, label: 'Editor' },
  { id: 'preview', icon: Eye, label: 'Preview' },
  { id: 'tools', icon: Wrench, label: 'Tools' },
]

interface MobileWorkspaceProps {
  projectId: string
}

export function MobileWorkspace({ projectId }: MobileWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('chat')

  const renderTab = () => {
    switch (tab) {
      case 'chat': return <ChatPanel projectId={projectId} />
      case 'editor': return <LatexEditor projectId={projectId} />
      case 'preview': return <PdfPreview />
      case 'tools': return <AISidebar projectId={projectId} />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-1 min-h-0">
        <ErrorBoundary>{renderTab()}</ErrorBoundary>
      </div>
      <nav className="border-t border-border bg-card shrink-0">
        <div className="flex">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      <CommandPalette projectId={projectId} />
      <OnboardingModal />
    </div>
  )
}
