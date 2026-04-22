'use client'
import React from 'react'
import { Loader2, FileX } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

export function PdfPreview() {
  const { compiledPdfUrl, isCompiling } = useProjectStore()

  if (isCompiling) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Compiling LaTeX...</p>
      </div>
    )
  }

  if (!compiledPdfUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileX className="h-12 w-12 opacity-30" />
        <p className="text-sm">No compiled PDF</p>
        <p className="text-xs">Save your document (Cmd+S) to compile</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-sm font-medium">PDF Preview</span>
        <a
          href={compiledPdfUrl}
          download="paper.pdf"
          className="text-xs text-primary hover:underline"
        >
          Download PDF
        </a>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          src={compiledPdfUrl}
          className="w-full h-full border-0"
          title="PDF Preview"
        />
      </div>
    </div>
  )
}
