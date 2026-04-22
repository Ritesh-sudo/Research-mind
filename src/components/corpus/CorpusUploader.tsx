'use client'
import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Trash2, Loader2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProjectStore } from '@/store/useProjectStore'
import type { UploadedPaper } from '@/types'

interface CorpusUploaderProps {
  projectId: string
}

export function CorpusUploader({ projectId }: CorpusUploaderProps) {
  const { papers, setPapers } = useProjectStore()
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisOutput, setAnalysisOutput] = useState('')
  const [analysisType, setAnalysisType] = useState<'gaps' | 'themes' | 'methods' | 'related_work'>('themes')
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('projectId', projectId)
      form.append('file', file)
      const res = await fetch('/api/corpus/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!data.error) {
        const newPaper: UploadedPaper = {
          id: data.id,
          projectId,
          filename: data.filename,
          extractedText: '',
          createdAt: new Date().toISOString(),
        }
        setPapers([...papers, newPaper])
      }
    } finally {
      setUploading(false)
    }
  }, [projectId, papers, setPapers])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(uploadFile)
  }

  const analyze = async () => {
    setAnalyzing(true)
    setAnalysisOutput('')
    const res = await fetch('/api/corpus/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, analysisType }),
    })
    if (!res.body) { setAnalyzing(false); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let acc = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '))
      for (const line of lines) {
        const d = line.slice(6)
        if (d === '[DONE]') break
        try {
          const p = JSON.parse(d)
          if (p.text) { acc += p.text; setAnalysisOutput(acc) }
        } catch {}
      }
    }
    setAnalyzing(false)
  }

  const ANALYSIS_TYPES = [
    { id: 'themes', label: 'Themes' },
    { id: 'gaps', label: 'Gaps' },
    { id: 'methods', label: 'Methods' },
    { id: 'related_work', label: 'Related Work' },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`m-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading & indexing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop PDFs here or click to upload</p>
            <p className="text-xs text-muted-foreground">Up to 20 papers. Each is chunked and indexed into RAG.</p>
          </div>
        )}
      </div>

      {/* Papers list */}
      {papers.length > 0 && (
        <div className="px-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {papers.length} / 20 papers indexed
            </span>
          </div>
          <ScrollArea className="max-h-32">
            <div className="space-y-1">
              {papers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-xs p-1.5 bg-muted/30 rounded">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{p.filename}</span>
                  <Badge variant="success" className="text-[10px] shrink-0">Indexed</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Analysis */}
      {papers.length >= 2 && (
        <div className="px-3 pb-3 border-t border-border pt-3 flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex gap-1 flex-wrap">
            {ANALYSIS_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setAnalysisType(t.id)}
                className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                  analysisType === t.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={analyze} disabled={analyzing} className="w-full">
            {analyzing ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Analyzing...</> : <><BarChart3 className="h-3 w-3 mr-2" />Analyze Corpus</>}
          </Button>
          {analysisOutput && (
            <ScrollArea className="flex-1 min-h-0 bg-muted/20 rounded p-2">
              <pre className="text-xs whitespace-pre-wrap">{analysisOutput}</pre>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
