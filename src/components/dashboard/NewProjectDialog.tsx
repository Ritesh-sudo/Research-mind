'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const TEMPLATES = [
  { id: 'neurips', label: 'NeurIPS' },
  { id: 'icml', label: 'ICML' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'acm', label: 'ACM' },
  { id: 'arxiv', label: 'arXiv' },
]

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [template, setTemplate] = useState('neurips')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (!title.trim() || !topic.trim()) {
      setError('Title and topic are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), topic: topic.trim(), template }),
      })
      const project = await res.json()
      if (res.ok) {
        router.push(`/project/${project.id}`)
        onClose()
      } else {
        setError(project.error ?? 'Failed to create project')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Research Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Paper title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Attention Is All You Need"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Research topic / abstract idea</label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Transformer architecture for sequence-to-sequence tasks using self-attention..."
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Template</label>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    template === t.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
