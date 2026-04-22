'use client'
import React, { useEffect, useState } from 'react'
import { Search, Plus, Copy, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '@/store/useProjectStore'
import type { Citation } from '@/types'

interface SearchResult {
  paperId: string
  title: string
  authors: string
  year: number
  abstract: string
  doi?: string
  arxivId?: string
  citationCount: number
}

interface CitationManagerProps {
  projectId: string
}

export function CitationManager({ projectId }: CitationManagerProps) {
  const { citations, setCitations, addCitation } = useProjectStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => d.citations && setCitations(d.citations))
      .catch(() => {})
  }, [projectId, setCitations])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const res = await fetch(`/api/citations/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.papers ?? [])
    } finally {
      setSearching(false)
    }
  }

  const addFromResult = async (r: SearchResult) => {
    setAdding(r.paperId)
    try {
      const res = await fetch('/api/citations/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          doi: r.doi,
          arxivId: r.arxivId,
          title: r.title,
          authors: r.authors,
          abstract: r.abstract,
          year: r.year,
        }),
      })
      const citation = await res.json()
      addCitation(citation)
    } finally {
      setAdding(null)
    }
  }

  const addManual = async () => {
    if (!manualInput.trim()) return
    const isArxiv = manualInput.match(/\d+\.\d+/)
    const isDoi = manualInput.startsWith('10.')
    const res = await fetch('/api/citations/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        arxivId: isArxiv ? manualInput.trim() : undefined,
        doi: isDoi ? manualInput.trim() : undefined,
      }),
    })
    const citation = await res.json()
    if (!citation.error) addCitation(citation)
    setManualInput('')
  }

  const copyBibtex = (bibtex: string) => {
    navigator.clipboard.writeText(bibtex)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Semantic Scholar..."
            className="text-sm h-8"
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Button size="sm" onClick={search} disabled={searching} className="h-8 shrink-0">
            {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="DOI or arXiv ID (e.g. 2312.12345)"
            className="text-sm h-8"
            onKeyDown={(e) => e.key === 'Enter' && addManual()}
          />
          <Button size="sm" variant="outline" onClick={addManual} className="h-8 shrink-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {results.length > 0 && (
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Search results</p>
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.paperId} className="border border-border rounded p-2 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-muted-foreground truncate">{r.authors} ({r.year})</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px]">{r.citationCount} citations</Badge>
                        {r.arxivId && <Badge variant="outline" className="text-[10px]">arXiv</Badge>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-6 text-xs shrink-0"
                      onClick={() => addFromResult(r)}
                      disabled={adding === r.paperId}
                    >
                      {adding === r.paperId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Project citations ({citations.length})
          </p>
          <div className="space-y-2">
            {citations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No citations yet</p>
            )}
            {citations.map((c) => (
              <div key={c.id} className="border border-border rounded p-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.title ?? 'Unknown title'}</p>
                    <p className="text-muted-foreground truncate">{c.authors} {c.year && `(${c.year})`}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyBibtex(c.bibtex)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    {c.arxivId && (
                      <a href={`https://arxiv.org/abs/${c.arxivId}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
