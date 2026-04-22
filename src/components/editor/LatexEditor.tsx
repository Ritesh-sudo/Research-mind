'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Save, RefreshCw, GitBranch, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '@/store/useProjectStore'
import { editorRef } from '@/lib/editorRef'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  { ssr: false, loading: () => <div className="flex-1 bg-[#0f0f0f] flex items-center justify-center text-muted-foreground text-sm">Loading editor...</div> }
)

interface LineError {
  line: number
  message: string
}

interface LatexEditorProps {
  projectId: string
}

const DEBOUNCE_COMPILE_MS = 3000
const AUTOSAVE_MS = 30_000

export function LatexEditor({ projectId }: LatexEditorProps) {
  const { latexContent, setLatexContent, setCompiledPdfUrl, isCompiling, setIsCompiling } =
    useProjectStore()

  const [lineErrors, setLineErrors] = useState<LineError[]>([])
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const save = useCallback(
    async (content: string, createSnapshot = false) => {
      setSaveStatus('saving')
      try {
        await fetch('/api/paper/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, content, createSnapshot }),
        })
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    },
    [projectId]
  )

  const compile = useCallback(
    async (content: string) => {
      setIsCompiling(true)
      setLineErrors([])
      try {
        const res = await fetch('/api/paper/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, content }),
        })
        const data = await res.json()
        if (data.pdfBase64) {
          setCompiledPdfUrl(`data:application/pdf;base64,${data.pdfBase64}`)
        }
        if (data.lineErrors) {
          setLineErrors(data.lineErrors)
        }
      } catch {}
      finally {
        setIsCompiling(false)
      }
    },
    [projectId, setIsCompiling, setCompiledPdfUrl]
  )

  const handleChange = useCallback(
    (value: string | undefined) => {
      const content = value ?? ''
      setLatexContent(content)
      setSaveStatus('unsaved')

      clearTimeout(compileTimerRef.current)
      clearTimeout(autosaveTimerRef.current)

      compileTimerRef.current = setTimeout(() => compile(content), DEBOUNCE_COMPILE_MS)
      autosaveTimerRef.current = setTimeout(() => save(content), AUTOSAVE_MS)
    },
    [compile, save, setLatexContent]
  )

  useEffect(() => {
    if (latexContent) compile(latexContent)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        save(latexContent, true)
        compile(latexContent)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [latexContent, save, compile])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">LaTeX Editor</span>
          {lineErrors.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {lineErrors.length} error{lineErrors.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />Saved
              </span>
            )}
            {saveStatus === 'unsaved' && 'Unsaved'}
          </span>
          <Button size="sm" variant="outline" onClick={() => save(latexContent, true)} className="h-7 text-xs">
            <GitBranch className="h-3 w-3 mr-1" />
            Snapshot
          </Button>
          <Button size="sm" variant="outline" onClick={() => save(latexContent)} className="h-7 text-xs">
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button size="sm" onClick={() => compile(latexContent)} disabled={isCompiling} className="h-7 text-xs">
            <RefreshCw className={`h-3 w-3 mr-1 ${isCompiling ? 'animate-spin' : ''}`} />
            Compile
          </Button>
        </div>
      </div>

      {lineErrors.length > 0 && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-3 py-2 max-h-24 overflow-auto">
          {lineErrors.map((err, i) => (
            <div key={i} className="text-xs text-destructive flex gap-2">
              <span className="font-mono">L{err.line}:</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language="latex"
          theme="vs-dark"
          value={latexContent}
          onChange={handleChange}
          onMount={(editor, monaco) => {
            editorRef.current = editor
            monaco.editor.defineTheme('research-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
                { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
              ],
              colors: { 'editor.background': '#0f0f0f' },
            })
            monaco.editor.setTheme('research-dark')
          }}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            smoothScrolling: true,
          }}
        />
      </div>
    </div>
  )
}
