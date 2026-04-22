'use client'
import React, { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const VENUES = [
  { id: 'neurips', label: 'NeurIPS' },
  { id: 'icml', label: 'ICML' },
  { id: 'iclr', label: 'ICLR' },
  { id: 'emnlp', label: 'EMNLP' },
  { id: 'acl', label: 'ACL' },
  { id: 'cvpr', label: 'CVPR' },
  { id: 'iccv', label: 'ICCV' },
  { id: 'aaai', label: 'AAAI' },
]

interface CheckResult {
  category: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  suggestion?: string
}

interface SubmissionCheckerProps {
  projectId: string
}

export function SubmissionChecker({ projectId }: SubmissionCheckerProps) {
  const [venue, setVenue] = useState('neurips')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    checks: CheckResult[]
    score: number
    summary: string
    venue: { name: string; deadline: string } | null
  } | null>(null)

  const check = async () => {
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch('/api/submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, venue }),
      })
      setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = (s: CheckResult['status']) => {
    if (s === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    if (s === 'fail') return <XCircle className="h-4 w-4 text-destructive shrink-0" />
    return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex gap-2 flex-wrap">
          {VENUES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVenue(v.id)}
              className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                venue === v.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Button onClick={check} disabled={loading} className="w-full" size="sm">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" />Check Readiness</>
          )}
        </Button>
      </div>

      {results && (
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{results.venue?.name ?? venue.toUpperCase()}</span>
              <Badge
                variant={results.score >= 80 ? 'success' : results.score >= 60 ? 'warning' : 'destructive'}
                className="text-sm font-bold"
              >
                {results.score}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{results.summary}</p>
            {results.venue?.deadline && (
              <p className="text-xs text-muted-foreground">Deadline: {results.venue.deadline}</p>
            )}
            <div className="space-y-2">
              {results.checks.map((c, i) => (
                <div key={i} className="border border-border rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-2">
                    {statusIcon(c.status)}
                    <span className="text-xs font-medium">{c.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">{c.message}</p>
                  {c.suggestion && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 ml-6 bg-yellow-50 dark:bg-yellow-900/20 rounded p-1.5">
                      💡 {c.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
