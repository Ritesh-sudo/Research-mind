'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { MessageSquare, GitCommit, BookMarked, FlaskConical, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

type EventType = 'message' | 'snapshot' | 'citation' | 'hypothesis'

interface TimelineEvent {
  id: string
  type: EventType
  timestamp: string
  data: Record<string, unknown>
}

interface ReplayData {
  timeline: TimelineEvent[]
  project: { title: string; topic: string }
}

interface ResearchReplayProps {
  projectId: string
}

const eventIcon: Record<EventType, React.ElementType> = {
  message: MessageSquare,
  snapshot: GitCommit,
  citation: BookMarked,
  hypothesis: FlaskConical,
}

const eventColor: Record<EventType, string> = {
  message: 'bg-primary',
  snapshot: 'bg-green-500',
  citation: 'bg-yellow-500',
  hypothesis: 'bg-purple-500',
}

export function ResearchReplay({ projectId }: ResearchReplayProps) {
  const [data, setData] = useState<ReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    fetch(`/api/replay?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setCursor(d.timeline.length - 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const prev = useCallback(() => setCursor((c) => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCursor((c) => Math.min((data?.timeline.length ?? 1) - 1, c + 1)), [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No session history yet
      </div>
    )
  }

  const current = data.timeline[cursor]

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <p className="text-sm font-medium">{data.project.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{data.timeline.length} events</p>
      </div>

      {/* Timeline scrubber */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="range"
          min={0}
          max={data.timeline.length - 1}
          value={cursor}
          onChange={(e) => setCursor(parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{format(new Date(data.timeline[0].timestamp), 'MMM d, HH:mm')}</span>
          <span>{format(new Date(data.timeline[data.timeline.length - 1].timestamp), 'MMM d, HH:mm')}</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={prev} disabled={cursor === 0} className="h-7 w-7 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{cursor + 1} / {data.timeline.length}</span>
          <Button size="sm" variant="outline" onClick={next} disabled={cursor === data.timeline.length - 1} className="h-7 w-7 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Current event */}
      {current && (
        <div className="p-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${eventColor[current.type]}`} />
            <Badge variant="outline" className="text-xs">{current.type}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(current.timestamp), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
          <div className="text-sm">
            {current.type === 'message' && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {(current.data.role as string)?.toUpperCase()} {current.data.aiProvider ? `(${current.data.aiProvider})` : ''}
                </p>
                <p className="line-clamp-4">{current.data.content as string}</p>
              </div>
            )}
            {current.type === 'snapshot' && (
              <p>Snapshot: <span className="font-medium">{current.data.label as string}</span></p>
            )}
            {current.type === 'citation' && (
              <p>Added citation: <span className="font-medium">{current.data.title as string}</span></p>
            )}
            {current.type === 'hypothesis' && (
              <div>
                <p className="font-medium mb-1">Hypothesis</p>
                <p className="text-muted-foreground">{current.data.statement as string}</p>
                <p className="text-xs mt-1">Evidence: {current.data.evidenceScore as number}/100</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {data.timeline.map((event, idx) => {
            const Icon = eventIcon[event.type]
            return (
              <button
                key={event.id}
                onClick={() => setCursor(idx)}
                className={`w-full flex items-center gap-2 p-2 rounded text-left text-xs transition-colors hover:bg-accent ${
                  idx === cursor ? 'bg-accent' : ''
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${eventColor[event.type]}`} />
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-muted-foreground">
                  {event.type === 'message' && `${event.data.role}: ${String(event.data.content).slice(0, 50)}`}
                  {event.type === 'snapshot' && `Snapshot: ${event.data.label}`}
                  {event.type === 'citation' && `Cite: ${event.data.title}`}
                  {event.type === 'hypothesis' && `Hyp: ${String(event.data.statement).slice(0, 40)}`}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {format(new Date(event.timestamp), 'HH:mm')}
                </span>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
