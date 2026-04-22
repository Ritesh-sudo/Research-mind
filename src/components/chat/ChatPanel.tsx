'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, ChevronDown, BookOpen, FileEdit, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '@/store/useProjectStore'
import { applyToEditor } from '@/lib/editorRef'
import { parseSSE } from '@/lib/sse'
import type { Message, RetrievedChunk } from '@/types'

function SourceChips({ sources }: { sources: RetrievedChunk[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <BookOpen className="h-3 w-3" />
        {sources.length} source{sources.length !== 1 ? 's' : ''}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="text-xs bg-muted/50 rounded p-2 border border-border/50">
              <div className="font-medium text-muted-foreground mb-1">
                [{i + 1}] {s.sourceType.toUpperCase()}: {s.sourceLabel}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {(s.similarity * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className="text-muted-foreground line-clamp-3">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LaTeXBlock({ code }: { code: string }) {
  const [applied, setApplied] = useState(false)
  const handleInsert = () => {
    const ok = applyToEditor(code, 'insert')
    if (ok) setApplied(true)
  }
  const handleAppend = () => {
    const ok = applyToEditor(code, 'append')
    if (ok) setApplied(true)
  }
  return (
    <div className="my-2 rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">LaTeX</span>
        <div className="flex gap-1">
          <button
            onClick={handleInsert}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <FileEdit className="h-3 w-3" />
            Insert at cursor
          </button>
          <button
            onClick={handleAppend}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <PlusCircle className="h-3 w-3" />
            Append
          </button>
        </div>
      </div>
      {applied && (
        <div className="text-[10px] text-green-500 px-3 py-1 bg-green-500/5">Applied to editor ✓</div>
      )}
      <pre className="text-xs p-3 overflow-x-auto bg-[#0f0f0f] text-muted-foreground font-mono whitespace-pre-wrap">{code}</pre>
    </div>
  )
}

function renderContent(content: string) {
  // Split on ```latex ... ``` blocks
  const parts = content.split(/(```latex[\s\S]*?```)/g)
  return (
    <div className="text-sm space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith('```latex')) {
          const code = part.replace(/^```latex\n?/, '').replace(/\n?```$/, '')
          return <LaTeXBlock key={i} code={code} />
        }
        // Render plain markdown lines
        return part.split('\n').map((line, j) => {
          if (line.startsWith('# ')) return <h2 key={`${i}-${j}`} className="font-bold text-base">{line.slice(2)}</h2>
          if (line.startsWith('## ')) return <h3 key={`${i}-${j}`} className="font-semibold">{line.slice(3)}</h3>
          if (line.startsWith('- ') || line.startsWith('* ')) return <div key={`${i}-${j}`} className="flex gap-2"><span>•</span><span>{line.slice(2)}</span></div>
          if (line.startsWith('**') && line.endsWith('**')) return <strong key={`${i}-${j}`}>{line.slice(2, -2)}</strong>
          if (line === '') return <br key={`${i}-${j}`} />
          return <p key={`${i}-${j}`} className="leading-relaxed">{line}</p>
        })
      })}
    </div>
  )
}

interface ChatMessageProps {
  message: Message
}

function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant'
  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isAssistant ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isAssistant ? 'AI' : 'U'}
      </div>
      <div className={`max-w-[85%] ${isAssistant ? '' : 'items-end'}`}>
        <div
          className={`rounded-lg px-3 py-2 ${
            isAssistant
              ? 'bg-muted text-foreground'
              : 'bg-primary text-primary-foreground text-sm'
          }`}
        >
          {isAssistant ? renderContent(message.content) : <p className="text-sm">{message.content}</p>}
        </div>
        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="mt-1 ml-1">
            <SourceChips sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  )
}

interface ChatPanelProps {
  projectId: string
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const { messages, addMessage, updateLastMessage, isChatStreaming, setIsChatStreaming } =
    useProjectStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isChatStreaming) return

    setInput('')
    const userMsg: Message = {
      id: crypto.randomUUID(),
      projectId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      projectId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    addMessage(assistantMsg)
    setIsChatStreaming(true)

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userMessage: text,
          messages: messages
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      })

      if (!res.body) throw new Error('No stream')
      let accumulated = ''
      for await (const parsed of parseSSE<{ text?: string; error?: string }>(res.body)) {
        if (parsed.text) {
          accumulated += parsed.text
          updateLastMessage(accumulated)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        updateLastMessage('Sorry, an error occurred. Please try again.')
      }
    } finally {
      setIsChatStreaming(false)
    }
  }, [input, isChatStreaming, projectId, messages, addMessage, updateLastMessage, setIsChatStreaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <p className="font-medium mb-2">Start your research conversation</p>
              <p className="text-xs">Every response is grounded in your uploaded papers via RAG.</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isChatStreaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                AI
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your research... (Enter to send, Shift+Enter for newline)"
            className="min-h-[60px] max-h-[200px] resize-none text-sm"
            disabled={isChatStreaming}
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || isChatStreaming}
              className="shrink-0"
            >
              {isChatStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {isChatStreaming && (
              <Button
                size="icon"
                variant="outline"
                onClick={() => abortRef.current?.abort()}
                className="shrink-0"
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
