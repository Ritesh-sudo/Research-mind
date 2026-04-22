'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, MessageSquare, FileText, FlaskConical, BookMarked,
  Share2, Rss, Wand2, Upload, Download, ShieldCheck
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  projectId: string
}

export function CommandPalette({ projectId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { setLeftPanelTab, latexContent, setCompiledPdfUrl, setIsCompiling } = useProjectStore()

  const commands: Command[] = [
    { id: 'chat', label: 'Open AI Chat', icon: MessageSquare, action: () => setLeftPanelTab('chat'), keywords: ['ai', 'research', 'ask'] },
    { id: 'graph', label: 'Knowledge Graph', icon: Share2, action: () => setLeftPanelTab('graph') },
    { id: 'hypothesis', label: 'Hypothesis Tracker', icon: FlaskConical, action: () => setLeftPanelTab('hypothesis') },
    { id: 'arxiv', label: 'arXiv Feed', icon: Rss, action: () => setLeftPanelTab('arxiv') },
    { id: 'citations', label: 'Citation Manager', icon: BookMarked, action: () => setLeftPanelTab('citations') },
    {
      id: 'compile',
      label: 'Compile LaTeX',
      description: 'Recompile the document to PDF',
      icon: FileText,
      keywords: ['pdf', 'build', 'render'],
      action: async () => {
        setIsCompiling(true)
        const res = await fetch('/api/paper/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, content: latexContent }),
        })
        const data = await res.json()
        if (data.pdfBase64) setCompiledPdfUrl(`data:application/pdf;base64,${data.pdfBase64}`)
        setIsCompiling(false)
      },
    },
    {
      id: 'export_latex',
      label: 'Export as LaTeX',
      icon: Download,
      action: async () => {
        const res = await fetch('/api/paper/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, format: 'latex' }),
        })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'paper.tex'; a.click()
        URL.revokeObjectURL(url)
      },
    },
    {
      id: 'export_md',
      label: 'Export as Markdown',
      icon: Download,
      action: async () => {
        const res = await fetch('/api/paper/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, format: 'markdown' }),
        })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'paper.md'; a.click()
        URL.revokeObjectURL(url)
      },
    },
    {
      id: 'export_zip',
      label: 'Export as ZIP (TeX + BibTeX)',
      icon: Download,
      action: async () => {
        const res = await fetch('/api/paper/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, format: 'zip' }),
        })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'paper.zip'; a.click()
        URL.revokeObjectURL(url)
      },
    },
    { id: 'dashboard', label: 'Go to Dashboard', icon: Search, action: () => router.push('/dashboard') },
  ]

  const filtered = query
    ? commands.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        )
      })
    : commands

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const runCommand = useCallback((cmd: Command) => {
    cmd.action()
    setOpen(false)
    setQuery('')
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No commands found</p>
          )}
          {filtered.map((cmd) => {
            const Icon = cmd.icon
            return (
              <button
                key={cmd.id}
                onClick={() => runCommand(cmd)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{cmd.label}</p>
                  {cmd.description && <p className="text-xs text-muted-foreground">{cmd.description}</p>}
                </div>
              </button>
            )
          })}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="border border-border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-border rounded px-1">↵</kbd> select</span>
          <span><kbd className="border border-border rounded px-1.5">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  )
}
