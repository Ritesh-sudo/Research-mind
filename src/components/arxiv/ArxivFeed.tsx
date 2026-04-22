'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, BookPlus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ArxivPaper } from '@/types'

interface ArxivFeedProps {
  projectId: string
}

export function ArxivFeed({ projectId }: ArxivFeedProps) {
  const [papers, setPapers] = useState<ArxivPaper[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/arxiv/feed?projectId=${projectId}`)
      const data = await res.json()
      setPapers(data.papers ?? [])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const addCitation = async (paper: ArxivPaper) => {
    await fetch('/api/citations/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        arxivId: paper.id,
        title: paper.title,
        authors: paper.authors.join(' and '),
        abstract: paper.abstract,
      }),
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium">arXiv Feed</span>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-7">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {papers.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">No papers found</p>
          )}
          {papers.map((p) => (
            <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:text-primary line-clamp-2 flex-1"
                >
                  {p.title}
                </a>
                {p.similarity !== undefined && p.similarity > 0.85 && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    <AlertCircle className="h-2.5 w-2.5 mr-1" />
                    Similar!
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{p.authors.slice(0, 3).join(', ')}</p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{p.abstract}</p>
              <div className="flex items-center justify-between">
                {p.similarity !== undefined && (
                  <Badge variant="outline" className="text-[10px]">
                    {(p.similarity * 100).toFixed(0)}% similar
                  </Badge>
                )}
                <div className="flex gap-1 ml-auto">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => addCitation(p)}>
                    <BookPlus className="h-3 w-3 mr-1" />
                    Cite
                  </Button>
                  <a href={p.link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
