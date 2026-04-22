'use client'
import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, GitMerge, FileText, Zap, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: Brain,
    title: 'RAG-Powered Research',
    description: 'Every AI response is grounded in your uploaded papers. Upload PDFs and the AI will cite specific sections when answering.',
    tip: 'Upload papers via the Corpus tab to build your research context.',
  },
  {
    icon: FileText,
    title: 'Live LaTeX Editor',
    description: 'Write your paper in the center panel. Hit Cmd+S to save and auto-compile to PDF. Choose NeurIPS, ICML, IEEE, ACM, or arXiv templates.',
    tip: 'Right-click any section to get AI to expand, critique, or rewrite it.',
  },
  {
    icon: GitMerge,
    title: 'Knowledge Graph + Hypotheses',
    description: 'Concepts from your chat automatically appear in the knowledge graph. Log hypotheses and the system scores them against your papers in real-time.',
    tip: 'BullMQ background jobs re-evaluate hypothesis evidence whenever you upload a new paper.',
  },
  {
    icon: Zap,
    title: 'AI Sidebar Tools',
    description: 'Use the AI Sidebar to generate Related Work, write abstracts, design experiments, or simulate a paper reviewer — all RAG-augmented.',
    tip: 'Press Cmd+K for the command palette to access any feature instantly.',
  },
]

const STORAGE_KEY = 'researchmind-onboarded'

export function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setOpen(true)
  }, [])

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Welcome to ResearchMind AI</span>
            <Badge variant="outline" className="text-xs font-normal">{step + 1}/{STEPS.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">{current.title}</h3>
              <p className="text-sm text-muted-foreground">{current.description}</p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            💡 {current.tip}
          </div>
          <div className="flex justify-between gap-3 mt-2 pt-2">
            <div className="flex gap-1.5 items-center">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-border hover:bg-muted-foreground'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={finish}>Skip</Button>
              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={() => setStep(step + 1)}>
                  Next <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={finish}>
                  Start researching
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
