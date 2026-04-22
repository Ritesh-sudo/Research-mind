'use client'
import React, { useEffect, useState } from 'react'
import { Plus, Check, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface Comment {
  id: string
  selectedText: string
  comment: string
  resolved: boolean
  createdAt: string
}

interface AdvisorReviewProps {
  projectId: string
}

export function AdvisorReview({ projectId }: AdvisorReviewProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedText, setSelectedText] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/review?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => setComments(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [projectId])

  const add = async () => {
    if (!comment.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, selectedText: selectedText.trim(), comment: comment.trim() }),
      })
      const newComment = await res.json()
      setComments((prev) => [newComment, ...prev])
      setSelectedText('')
      setComment('')
    } finally {
      setLoading(false)
    }
  }

  const resolve = async (id: string, resolved: boolean) => {
    const res = await fetch('/api/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resolved }),
    })
    const updated = await res.json()
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/review/${projectId}`
    : ''

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={shareLink}
            readOnly
            className="text-xs h-7 font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            onClick={() => navigator.clipboard.writeText(shareLink)}
          >
            Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Share this link with advisors (read-only, no sign-in required)</p>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <Input
          value={selectedText}
          onChange={(e) => setSelectedText(e.target.value)}
          placeholder="Quote from paper (optional)"
          className="text-xs h-8"
        />
        <div className="flex gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a review comment..."
            className="text-sm min-h-[60px] resize-none"
          />
          <Button onClick={add} disabled={loading || !comment.trim()} className="shrink-0 self-end">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No review comments yet</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className={`border rounded-lg p-3 space-y-1.5 ${c.resolved ? 'opacity-50' : ''}`}>
              {c.selectedText && (
                <blockquote className="border-l-2 border-primary pl-2 text-xs text-muted-foreground italic">
                  {c.selectedText}
                </blockquote>
              )}
              <p className="text-sm">{c.comment}</p>
              <div className="flex items-center justify-between">
                <Badge variant={c.resolved ? 'secondary' : 'outline'} className="text-xs">
                  {c.resolved ? 'Resolved' : 'Open'}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => resolve(c.id, !c.resolved)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  {c.resolved ? 'Reopen' : 'Resolve'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
