'use client'
import React, { useState } from 'react'
import { Wand2, FileText, ListChecks, FlaskConical, UserCheck, Loader2, Copy, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/store/useProjectStore'

type Tool = 'related_work' | 'abstract' | 'contributions' | 'experiment_design' | 'reviewer_sim'

const TOOLS: { id: Tool; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'related_work', label: 'Related Work', icon: FileText, description: 'Generate RAG-grounded related work from your uploaded papers' },
  { id: 'abstract', label: 'Abstract Writer', icon: Wand2, description: 'Draft a structured abstract from your project topic and content' },
  { id: 'contributions', label: 'Contributions', icon: ListChecks, description: 'Generate key contribution bullets for Introduction' },
  { id: 'experiment_design', label: 'Experiment Designer', icon: FlaskConical, description: 'Design a rigorous evaluation plan with baselines and metrics' },
  { id: 'reviewer_sim', label: 'Reviewer Simulator', icon: UserCheck, description: 'Simulate a NeurIPS/ICML reviewer with scores and feedback' },
]

interface AISidebarProps {
  projectId: string
}

export function AISidebar({ projectId }: AISidebarProps) {
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const { setLatexContent, latexContent } = useProjectStore()

  const run = async (tool: Tool) => {
    setActiveTool(tool)
    setOutput('')
    setLoading(true)

    try {
      const res = await fetch('/api/sidebar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, tool }),
      })

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setOutput(accumulated)
            }
          } catch {}
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const insertIntoEditor = () => {
    const section = window.prompt('Insert after which section? (e.g., Introduction)')
    if (!section || !output) return
    const marker = `\\section{${section}}`
    if (latexContent.includes(marker)) {
      setLatexContent(latexContent.replace(marker, `${marker}\n${output}`))
    } else {
      setLatexContent(latexContent + '\n\n' + output)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-xs text-muted-foreground">All tools are RAG-augmented with your uploaded papers.</p>
      </div>
      <div className="flex flex-col gap-1 p-2 border-b border-border">
        {TOOLS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => run(t.id)}
              disabled={loading}
              className={`flex items-start gap-3 p-2 rounded-lg text-left transition-colors hover:bg-accent ${activeTool === t.id ? 'bg-accent' : ''}`}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              {loading && activeTool === t.id && <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0 mt-0.5" />}
            </button>
          )
        })}
      </div>

      {output && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              {TOOLS.find((t) => t.id === activeTool)?.label} output
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={copy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={insertIntoEditor}>
                Insert
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{output}</pre>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
