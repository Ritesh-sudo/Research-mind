'use client'
import React, { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Provider {
  id: string
  name: string
  configured: boolean
  models: string[]
}

interface ProvidersData {
  providers: Provider[]
  current: {
    aiProvider: string
    aiModel: string
    embeddingProvider: string
    embeddingModel: string
  }
}

interface TestResult {
  success: boolean
  latency: number
  response?: string
  error?: string
}

export function ProviderSettings() {
  const [data, setData] = useState<ProvidersData | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  useEffect(() => {
    fetch('/api/ai/providers')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const test = async (providerId: string) => {
    setTesting(providerId)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      })
      const result = await res.json()
      setTestResults((prev) => ({ ...prev, [providerId]: result }))
    } finally {
      setTesting(null)
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="border border-border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-2">Active configuration</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">AI Provider:</span> <span className="font-medium">{data.current.aiProvider}</span></div>
            <div><span className="text-muted-foreground">AI Model:</span> <span className="font-medium">{data.current.aiModel}</span></div>
            <div><span className="text-muted-foreground">Embedding:</span> <span className="font-medium">{data.current.embeddingProvider}</span></div>
            <div><span className="text-muted-foreground">Embed Model:</span> <span className="font-medium">{data.current.embeddingModel}</span></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Switch providers by changing AI_PROVIDER in .env and restarting.</p>
        </div>

        <div className="space-y-3">
          {data.providers.map((p) => {
            const result = testResults[p.id]
            const isActive = data.current.aiProvider === p.id
            return (
              <div key={p.id} className={`border rounded-lg p-3 ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {isActive && <Badge variant="default" className="text-xs">Active</Badge>}
                    <Badge variant={p.configured ? 'success' : 'secondary'} className="text-xs">
                      {p.configured ? 'Configured' : 'No API key'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => test(p.id)}
                    disabled={testing === p.id || !p.configured}
                  >
                    {testing === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <><Zap className="h-3 w-3 mr-1" />Test</>
                    )}
                  </Button>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {p.models.map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
                {result && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {result.success ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className={result.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                      {result.success ? `${result.latency}ms — "${result.response}"` : result.error}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}
