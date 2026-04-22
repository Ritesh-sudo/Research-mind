'use client'
import React, { useEffect, useState } from 'react'
import { Plus, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/store/useProjectStore'
import type { Hypothesis } from '@/types'

interface HypothesisTrackerProps {
  projectId: string
}

const statusConfig = {
  unconfirmed: { label: 'Unconfirmed', variant: 'outline' as const, icon: Minus },
  partial: { label: 'Partial', variant: 'warning' as const, icon: TrendingUp },
  supported: { label: 'Supported', variant: 'success' as const, icon: TrendingUp },
  contradicted: { label: 'Contradicted', variant: 'destructive' as const, icon: TrendingDown },
}

function HypothesisCard({ hyp }: { hyp: Hypothesis }) {
  const config = statusConfig[hyp.status as keyof typeof statusConfig] ?? statusConfig.unconfirmed
  const Icon = config.icon

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{hyp.statement}</p>
        <Badge variant={config.variant} className="shrink-0 text-xs">
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${hyp.evidenceScore}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{hyp.evidenceScore}/100</span>
      </div>
      {hyp.supportingChunks && Array.isArray(hyp.supportingChunks) && hyp.supportingChunks.length > 0 && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            {hyp.supportingChunks.length} supporting source{hyp.supportingChunks.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1">
            {(hyp.supportingChunks as Array<{ sourceLabel?: string; text?: string }>).slice(0, 3).map((c, i) => (
              <div key={i} className="bg-muted/50 rounded p-1.5 text-muted-foreground line-clamp-2">
                {c.sourceLabel}: {c.text?.slice(0, 100)}...
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

export function HypothesisTracker({ projectId }: HypothesisTrackerProps) {
  const { hypotheses, setHypotheses, addHypothesis } = useProjectStore()
  const [statement, setStatement] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/hypotheses/evaluate?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setHypotheses(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [projectId, setHypotheses])

  const submit = async () => {
    if (!statement.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/hypotheses/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, statement: statement.trim() }),
      })
      const hyp = await res.json()
      addHypothesis(hyp)
      setStatement('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">
          State a hypothesis. Evidence is scored automatically via RAG.
        </p>
        <div className="flex gap-2">
          <Textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Attention mechanisms improve performance by..."
            className="min-h-[60px] text-sm resize-none"
          />
          <Button onClick={submit} disabled={loading || !statement.trim()} className="shrink-0 self-end">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {hypotheses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hypotheses yet</p>
          )}
          {hypotheses.map((h) => (
            <HypothesisCard key={h.id} hyp={h} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
