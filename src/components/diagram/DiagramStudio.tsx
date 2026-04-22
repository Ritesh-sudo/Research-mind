'use client'
import React, {
  useState, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, Wand2, Download, FileCode2, Copy, CheckCheck,
  Save, Trash2, Plus, RefreshCw, ZoomIn, ZoomOut, Maximize2,
  Pencil, ChevronDown, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { applyToEditor } from '@/lib/editorRef'
import { parseSSE } from '@/lib/sse'

// ─── Monaco (lazy) ────────────────────────────────────────────────────────────
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(m => m.default),
  { ssr: false, loading: () => <div className="flex-1 bg-[#0f0f0f] flex items-center justify-center text-xs text-muted-foreground">Loading editor…</div> }
)

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES: Record<string, { label: string; code: string }[]> = {
  flowchart: [
    {
      label: 'ML Pipeline',
      code: `flowchart TD
    A([Raw Data]) --> B[Preprocessing]
    B --> C{Quality\nCheck}
    C -- Pass --> D[Feature Engineering]
    C -- Fail --> B
    D --> E[Train / Val / Test Split]
    E --> F[Model Training]
    F --> G[Hyperparameter Tuning]
    G --> H{Metrics\nThreshold?}
    H -- Yes --> I([Deploy])
    H -- No --> F`,
    },
    {
      label: 'Transformer Architecture',
      code: `flowchart LR
    subgraph Encoder
      A[Input Embeddings] --> B[Multi-Head\nSelf-Attention]
      B --> C[Add & Norm]
      C --> D[Feed-Forward]
      D --> E[Add & Norm]
    end
    subgraph Decoder
      F[Output Embeddings] --> G[Masked MHA]
      G --> H[Add & Norm]
      H --> I[Cross-Attention]
      E --> I
      I --> J[Add & Norm]
      J --> K[Feed-Forward]
      K --> L[Add & Norm]
    end
    L --> M[Linear + Softmax] --> N([Predictions])`,
    },
    {
      label: 'RAG Pipeline',
      code: `flowchart LR
    Q([User Query]) --> E1[Embed Query]
    E1 --> R[Vector Search\nin pgvector]
    R --> C[Retrieved Chunks]
    C --> P[Prompt Builder]
    Q --> P
    P --> LLM[LLM]
    LLM --> A([Answer + Citations])`,
    },
  ],
  sequenceDiagram: [
    {
      label: 'API Request Flow',
      code: `sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as Next.js API
    participant DB as PostgreSQL
    participant LLM as Ollama

    U->>FE: Send chat message
    FE->>API: POST /api/chat
    API->>DB: Retrieve context chunks
    DB-->>API: Top-k embeddings
    API->>LLM: Augmented prompt
    LLM-->>API: Stream tokens
    API-->>FE: SSE stream
    FE-->>U: Rendered response`,
    },
    {
      label: 'Auth Sequence',
      code: `sequenceDiagram
    actor U as User
    participant FE as Browser
    participant AS as Auth Server
    participant RS as Resource Server

    U->>FE: Click Sign In
    FE->>AS: Redirect + state param
    AS->>U: Login prompt
    U->>AS: Credentials
    AS-->>FE: Authorization code
    FE->>AS: Exchange code for tokens
    AS-->>FE: access_token + refresh_token
    FE->>RS: API call with Bearer token
    RS-->>FE: Protected resource`,
    },
  ],
  classDiagram: [
    {
      label: 'Model Hierarchy',
      code: `classDiagram
    class BaseModel {
      <<abstract>>
      +String id
      +forward(x: Tensor) Tensor
      +loss(pred, target) Float
    }
    class TransformerModel {
      +int num_layers
      +int hidden_dim
      +int num_heads
      +encode(x) Tensor
      +decode(z, ctx) Tensor
    }
    class AttentionHead {
      +int dim_k
      +int dim_v
      +attend(q, k, v) Tensor
    }
    class FeedForward {
      +int d_model
      +int d_ff
      +forward(x) Tensor
    }
    BaseModel <|-- TransformerModel
    TransformerModel *-- AttentionHead : has many
    TransformerModel *-- FeedForward : has many`,
    },
  ],
  erDiagram: [
    {
      label: 'Research DB',
      code: `erDiagram
    USER {
      string id PK
      string email
      string name
    }
    PROJECT {
      string id PK
      string userId FK
      string title
      string topic
      datetime createdAt
    }
    PAPER {
      string id PK
      string projectId FK
      string filename
      string extractedText
    }
    CITATION {
      string id PK
      string projectId FK
      string bibtex
      string doi
    }
    HYPOTHESIS {
      string id PK
      string projectId FK
      string statement
      float evidenceScore
    }
    USER ||--o{ PROJECT : owns
    PROJECT ||--o{ PAPER : contains
    PROJECT ||--o{ CITATION : references
    PROJECT ||--o{ HYPOTHESIS : tracks`,
    },
  ],
  mindmap: [
    {
      label: 'Research Topics',
      code: `mindmap
  root((Research\nMind))
    AI/ML
      Large Language Models
        Fine-tuning
        RLHF
        RAG
      Computer Vision
        Object Detection
        Segmentation
    Methodology
      Data Collection
      Preprocessing
      Evaluation Metrics
    Writing
      Introduction
      Related Work
      Experiments
      Conclusion`,
    },
  ],
  graph: [
    {
      label: 'Citation Network',
      code: `graph LR
    A[Attention Is All\nYou Need] --> B[BERT]
    A --> C[GPT Series]
    B --> D[RoBERTa]
    B --> E[ALBERT]
    C --> F[GPT-3]
    F --> G[InstructGPT]
    G --> H[ChatGPT]
    A --> I[T5]
    I --> J[FLAN-T5]`,
    },
  ],
}

const DIAGRAM_TYPES = [
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'sequenceDiagram', label: 'Sequence' },
  { id: 'classDiagram', label: 'Class' },
  { id: 'erDiagram', label: 'ER' },
  { id: 'mindmap', label: 'Mind Map' },
  { id: 'graph', label: 'Graph' },
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface SavedDiagram {
  id: string
  title: string
  type: string
  code: string
  caption: string
  figLabel: string
  svgCache?: string | null
  updatedAt: string
}

interface DiagramStudioProps {
  projectId: string
}

// ─── Mermaid theme vars ───────────────────────────────────────────────────────
const MERMAID_DARK_VARS = {
  primaryColor: '#6366f1',
  primaryTextColor: '#f1f5f9',
  primaryBorderColor: '#4f46e5',
  lineColor: '#94a3b8',
  secondaryColor: '#1e293b',
  tertiaryColor: '#0f172a',
  background: '#0f172a',
  mainBkg: '#1e293b',
  nodeBorder: '#4f46e5',
  clusterBkg: '#1e293b',
  titleColor: '#f1f5f9',
  edgeLabelBackground: '#1e293b',
  actorBkg: '#1e293b',
  actorBorder: '#4f46e5',
  actorTextColor: '#f1f5f9',
  signalColor: '#94a3b8',
  signalTextColor: '#f1f5f9',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DiagramStudio({ projectId }: DiagramStudioProps) {
  // ── Active diagram state ──────────────────────────────────────────────────
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null)
  const [title, setTitle] = useState('Untitled Diagram')
  const [editingTitle, setEditingTitle] = useState(false)
  const [diagramType, setDiagramType] = useState('flowchart')
  const [code, setCode] = useState(TEMPLATES.flowchart?.[0]?.code ?? 'flowchart TD\n  A --> B')
  const [caption, setCaption] = useState('')
  const [figLabel, setFigLabel] = useState('fig:diagram1')

  // ── Undo/redo ─────────────────────────────────────────────────────────────
  const history = useRef<string[]>([TEMPLATES.flowchart?.[0]?.code ?? 'flowchart TD\n  A --> B'])
  const historyIdx = useRef(0)
  const skipHistory = useRef(false)

  // ── Saved diagrams ────────────────────────────────────────────────────────
  const [saved, setSaved] = useState<SavedDiagram[]>([])
  const [saving, setSaving] = useState(false)

  // ── AI ────────────────────────────────────────────────────────────────────
  const [aiMode, setAiMode] = useState<'generate' | 'refine'>('generate')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewRef = useRef<HTMLDivElement>(null)
  const mermaidRef = useRef<unknown>(null)
  const [renderError, setRenderError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // ── Vertical resize (editor / preview split) ──────────────────────────────
  const [editorHeight, setEditorHeight] = useState(240)
  const vDragging = useRef(false)
  const vStartY = useRef(0)
  const vStartH = useRef(0)

  // ── Misc ──────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const renderTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Init mermaid ──────────────────────────────────────────────────────────
  useEffect(() => {
    import('mermaid').then(m => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mermaid = (m as any).default ?? m
      mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: MERMAID_DARK_VARS, flowchart: { curve: 'basis' }, sequence: { actorMargin: 50 } })
      mermaidRef.current = mermaid
      renderDiagram(code, mermaid)
    })
    loadSaved()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load saved diagrams ───────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    const res = await fetch(`/api/diagrams?projectId=${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setSaved(data.diagrams ?? [])
    }
  }, [projectId])

  // ── Render mermaid ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDiagram = useCallback(async (src: string | undefined | null, m?: any) => {
    const mermaid = m ?? mermaidRef.current
    if (!mermaid || !previewRef.current) return
    if (typeof src !== 'string') return
    const trimmed = src.trim()
    if (!trimmed) {
      previewRef.current.innerHTML = ''
      setRenderError('')
      return
    }

    // Mermaid leaves orphan render containers in <body> between renders.
    // Clean up anything from our previous renders (ids we minted start with `rm-mmd-`).
    document.querySelectorAll('[id^="rm-mmd-"]').forEach(el => el.remove())

    setRenderError('')
    const paintSvg = (svg: string) => {
      if (!previewRef.current) return
      previewRef.current.innerHTML = svg
      const svgEl = previewRef.current.querySelector('svg')
      if (svgEl) {
        svgEl.style.width = '100%'
        svgEl.style.height = 'auto'
        svgEl.removeAttribute('width')
        svgEl.removeAttribute('height')
      }
    }

    const doRender = async () => {
      const id = `rm-mmd-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (mermaid as any).render(id, trimmed)
      return typeof result?.svg === 'string' ? result.svg as string : ''
    }

    try {
      const svg = await doRender()
      if (svg) { paintSvg(svg); return }
      // Empty svg without a thrown error — re-init and retry once
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mermaid as any).initialize({ startOnLoad: false, theme: 'dark', themeVariables: MERMAID_DARK_VARS, flowchart: { curve: 'basis' } })
      const svg2 = await doRender()
      if (svg2) { paintSvg(svg2); return }
      setRenderError('Mermaid returned no SVG output')
      if (previewRef.current) previewRef.current.innerHTML = ''
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('No diagram') || msg.includes('No diagramType')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mermaid as any).initialize({ startOnLoad: false, theme: 'dark', themeVariables: MERMAID_DARK_VARS, flowchart: { curve: 'basis' } })
          const svg = await doRender()
          if (svg) { paintSvg(svg); return }
        } catch { /* fall through */ }
      }
      setRenderError(msg)
      if (previewRef.current) previewRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    clearTimeout(renderTimer.current)
    renderTimer.current = setTimeout(() => renderDiagram(code), 800)
    return () => clearTimeout(renderTimer.current)
  }, [code, renderDiagram])

  // ── Code change with history ──────────────────────────────────────────────
  const handleCodeChange = useCallback((val: string | undefined) => {
    const v = val ?? ''
    setCode(v)
    if (!skipHistory.current) {
      const h = history.current.slice(0, historyIdx.current + 1)
      h.push(v)
      if (h.length > 100) h.shift()
      history.current = h
      historyIdx.current = h.length - 1
    }
    // auto-save if editing existing diagram
    if (activeDiagramId) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(() => patchDiagram(activeDiagramId, { code: v }), 2000)
    }
  }, [activeDiagramId]) // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return
    const next = history.current[historyIdx.current - 1]
    if (typeof next !== 'string') return
    historyIdx.current--
    skipHistory.current = true
    setCode(next)
    skipHistory.current = false
  }, [])

  const redo = useCallback(() => {
    if (historyIdx.current >= history.current.length - 1) return
    const next = history.current[historyIdx.current + 1]
    if (typeof next !== 'string') return
    historyIdx.current++
    skipHistory.current = true
    setCode(next)
    skipHistory.current = false
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 's') { e.preventDefault(); saveCurrentDiagram() }
      if (meta && e.key === 'Enter') { e.preventDefault(); if (description.trim()) runAI() }
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [description, undo, redo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI ────────────────────────────────────────────────────────────────────
  const runAI = useCallback(async () => {
    if (!description.trim() || generating) return
    setGenerating(true)
    const prevCode = code
    setCode('')
    let acc = ''
    try {
      const body = aiMode === 'refine'
        ? { projectId, description: `Existing diagram:\n${prevCode}\n\nRefine: ${description}`, diagramType }
        : { projectId, description, diagramType }

      const res = await fetch('/api/diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.body) return
      for await (const p of parseSSE<{ text?: string }>(res.body)) {
        if (p.text) { acc += p.text; setCode(acc) }
      }
      // push to history
      history.current = [...history.current.slice(0, historyIdx.current + 1), acc]
      historyIdx.current = history.current.length - 1
    } finally {
      setGenerating(false)
    }
  }, [description, generating, code, aiMode, projectId, diagramType])

  // ── Save / CRUD ───────────────────────────────────────────────────────────
  const patchDiagram = useCallback(async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/diagrams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }, [])

  const saveCurrentDiagram = useCallback(async () => {
    setSaving(true)
    try {
      const svgCache = previewRef.current?.querySelector('svg')?.outerHTML ?? undefined
      if (activeDiagramId) {
        await patchDiagram(activeDiagramId, { title, code, caption, figLabel, svgCache, type: diagramType })
        setSaved(prev => prev.map(d => d.id === activeDiagramId ? { ...d, title, code, caption, figLabel, type: diagramType, svgCache, updatedAt: new Date().toISOString() } : d))
      } else {
        const res = await fetch('/api/diagrams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, title, type: diagramType, code, caption, figLabel, svgCache }),
        })
        const data = await res.json()
        setActiveDiagramId(data.diagram.id)
        setSaved(prev => [data.diagram, ...prev])
      }
    } finally {
      setSaving(false)
    }
  }, [activeDiagramId, title, code, caption, figLabel, diagramType, projectId, patchDiagram])

  const newDiagram = useCallback(() => {
    setActiveDiagramId(null)
    setTitle('Untitled Diagram')
    setDiagramType('flowchart')
    const tpl = TEMPLATES.flowchart?.[0]?.code ?? 'flowchart TD\n  A --> B'
    setCode(tpl)
    setCaption('')
    setFigLabel('fig:diagram')
    history.current = [tpl]
    historyIdx.current = 0
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const loadDiagram = useCallback((d: SavedDiagram) => {
    setActiveDiagramId(d.id)
    setTitle(d.title ?? 'Untitled Diagram')
    setDiagramType(d.type ?? 'flowchart')
    const loadedCode = typeof d.code === 'string' ? d.code : ''
    setCode(loadedCode)
    setCaption(d.caption ?? '')
    setFigLabel(d.figLabel ?? 'fig:diagram')
    history.current = [loadedCode]
    historyIdx.current = 0
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const deleteDiagram = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/diagrams/${id}`, { method: 'DELETE' })
    setSaved(prev => prev.filter(d => d.id !== id))
    if (activeDiagramId === id) newDiagram()
  }, [activeDiagramId, newDiagram])

  // ── Preview zoom/pan ──────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.2, Math.min(4, z - e.deltaY * 0.001)))
  }

  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanning.current = true
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  useLayoutEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanning.current) return
      setPan({ x: panStart.current.px + (e.clientX - panStart.current.mx), y: panStart.current.py + (e.clientY - panStart.current.my) })
    }
    const onUp = () => { isPanning.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const fitPreview = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // ── Vertical resize ───────────────────────────────────────────────────────
  const onVDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    vDragging.current = true
    vStartY.current = e.clientY
    vStartH.current = editorHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  useLayoutEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!vDragging.current) return
      setEditorHeight(Math.max(100, Math.min(500, vStartH.current + (e.clientY - vStartY.current))))
    }
    const onUp = () => { vDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Export ────────────────────────────────────────────────────────────────
  const getSvgEl = () => previewRef.current?.querySelector('svg')

  const exportSvg = () => {
    const el = getSvgEl()
    if (!el) return
    const blob = new Blob([el.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${figLabel}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPng = (scale = 3) => {
    const el = getSvgEl()
    if (!el) return
    const svgData = new XMLSerializer().serializeToString(el)
    const canvas = document.createElement('canvas')
    const bbox = el.getBoundingClientRect()
    canvas.width = bbox.width * scale; canvas.height = bbox.height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale); ctx.drawImage(img, 0, 0)
      const a = document.createElement('a'); a.download = `${figLabel}.png`; a.href = canvas.toDataURL('image/png'); a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const copySvg = () => {
    const el = getSvgEl()
    if (!el) return
    navigator.clipboard.writeText(el.outerHTML)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const insertLatex = () => {
    const latex = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.9\\linewidth]{figures/${figLabel}.pdf}\n  \\caption{${caption || title}}\n  \\label{${figLabel}}\n\\end{figure}`
    applyToEditor(latex, 'insert')
  }

  // ── Monaco mount: register Mermaid tokenizer ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMonacoMount = (_editor: any, monaco: any) => {
    if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'mermaid')) return
    monaco.languages.register({ id: 'mermaid' })
    monaco.languages.setMonarchTokensProvider('mermaid', {
      tokenizer: {
        root: [
          [/^(flowchart|sequenceDiagram|classDiagram|erDiagram|mindmap|graph|gantt|pie|stateDiagram|gitGraph)(\s.*)$/, ['keyword', '']],
          [/\b(subgraph|end|participant|actor|as|loop|alt|else|opt|par|and|critical|break|rect|note|over|left of|right of)\b/, 'keyword'],
          [/%%.*$/, 'comment'],
          [/"[^"]*"/, 'string'],
          [/\[[^\]]*\]/, 'type'],
          [/\([^)]*\)/, 'string'],
          [/\{[^}]*\}/, 'variable'],
          [/(-->|--|->|->>|-->>|-\.|\.->|\|>|o--|--o|<-->)/, 'operator'],
          [/:[^:\n]+/, 'string'],
        ],
      },
    })
    monaco.editor.defineTheme('mermaid-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '818cf8', fontStyle: 'bold' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'type', foreground: 'ffd700' },
        { token: 'variable', foreground: 'f97316' },
        { token: 'operator', foreground: '94a3b8' },
      ],
      colors: { 'editor.background': '#0a0a0f' },
    })
    monaco.editor.setTheme('mermaid-dark')
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Top toolbar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-muted/20 px-3 py-2 space-y-2">
        {/* Row 1: title + type + save */}
        <div className="flex items-center gap-2">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); if (activeDiagramId) patchDiagram(activeDiagramId, { title }) }}
              onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false) }}
              className="flex-1 h-7 text-sm bg-background border border-primary rounded px-2 font-medium"
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="flex items-center gap-1.5 text-sm font-medium hover:text-primary flex-1 text-left truncate">
              <span className="truncate">{title}</span>
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
            </button>
          )}
          <Button size="sm" variant="outline" onClick={saveCurrentDiagram} disabled={saving} className="h-7 px-2 shrink-0 gap-1 text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? '' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={newDiagram} className="h-7 w-7 p-0 shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Row 2: type pills */}
        <div className="flex gap-1 flex-wrap">
          {DIAGRAM_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setDiagramType(t.id)}
              className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${diagramType === t.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setShowTemplates(v => !v)}
            className="ml-auto px-2 py-0.5 rounded text-[11px] border border-border hover:bg-accent text-muted-foreground flex items-center gap-1"
          >
            Templates <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="flex gap-1.5 flex-wrap">
            {(TEMPLATES[diagramType] ?? []).map(t => (
              <button
                key={t.label}
                onClick={() => { setCode(t.code); history.current = [t.code]; historyIdx.current = 0; setShowTemplates(false) }}
                className="text-[11px] px-2 py-1 rounded bg-muted/50 border border-border hover:border-primary hover:bg-primary/10 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Saved diagrams strip ──────────────────────────────────────────── */}
      {saved.length > 0 && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-1.5">
          <div className="overflow-x-auto">
            <div className="flex gap-1.5 pb-1">
              {saved.map(d => (
                <div
                  key={d.id}
                  onClick={() => loadDiagram(d)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer shrink-0 transition-colors ${activeDiagramId === d.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 hover:bg-accent'}`}
                >
                  <span className="text-[11px] max-w-[90px] truncate">{d.title}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 hidden group-hover:inline-flex">{d.type}</Badge>
                  <button
                    onClick={e => deleteDiagram(d.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Editor (Monaco) ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border" style={{ height: editorHeight }}>
        <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/20 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Mermaid</span>
          <div className="flex items-center gap-1.5">
            <button onClick={undo} className="text-muted-foreground hover:text-foreground text-[10px] px-1.5 py-0.5 rounded hover:bg-accent" title="Undo (⌘Z)">↩</button>
            <button onClick={redo} className="text-muted-foreground hover:text-foreground text-[10px] px-1.5 py-0.5 rounded hover:bg-accent" title="Redo (⌘Y)">↪</button>
            <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="text-muted-foreground hover:text-foreground">
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <MonacoEditor
          height={editorHeight - 28}
          language="mermaid"
          value={code}
          onChange={handleCodeChange}
          onMount={onMonacoMount}
          options={{
            fontSize: 12,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            tabSize: 2,
            renderLineHighlight: 'line',
            smoothScrolling: true,
            padding: { top: 8 },
          }}
        />
      </div>

      {/* ── Vertical drag handle ──────────────────────────────────────────── */}
      <div
        onMouseDown={onVDragStart}
        className="h-1 shrink-0 cursor-row-resize hover:bg-primary/50 active:bg-primary transition-colors"
      />

      {/* ── Preview ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/20 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Preview</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(1)))} className="text-muted-foreground hover:text-foreground p-0.5">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.2, +(z - 0.2).toFixed(1)))} className="text-muted-foreground hover:text-foreground p-0.5">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button onClick={fitPreview} className="text-muted-foreground hover:text-foreground p-0.5" title="Fit">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={copySvg} className="text-muted-foreground hover:text-foreground p-0.5" title="Copy SVG">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div
          className="relative flex-1 min-h-0 overflow-hidden bg-muted/5 cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
        >
          <div
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div ref={previewRef} className="w-full p-4" />
          </div>
          {renderError && (
            <div className="absolute inset-x-3 top-3 max-h-40 overflow-auto text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 font-mono whitespace-pre-wrap pointer-events-none">
              {renderError}
            </div>
          )}
        </div>
      </div>

      {/* ── AI prompt bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-muted/10 px-3 py-2 space-y-2">
        <div className="flex gap-1">
          <button
            onClick={() => setAiMode('generate')}
            className={`flex-1 py-1 rounded text-[11px] border transition-colors flex items-center justify-center gap-1 ${aiMode === 'generate' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
          >
            <Wand2 className="h-3 w-3" /> Generate new
          </button>
          <button
            onClick={() => setAiMode('refine')}
            className={`flex-1 py-1 rounded text-[11px] border transition-colors flex items-center justify-center gap-1 ${aiMode === 'refine' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent text-muted-foreground'}`}
          >
            <RefreshCw className="h-3 w-3" /> Refine existing
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAI() }}
            placeholder={aiMode === 'generate' ? 'Describe your diagram… (⌘Enter to generate)' : 'Describe what to change… (⌘Enter to refine)'}
            rows={2}
            className="flex-1 resize-none text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary transition-colors"
            style={{ fontFamily: 'inherit' }}
          />
          <Button size="sm" onClick={runAI} disabled={generating || !description.trim()} className="self-end h-8 w-8 p-0 shrink-0">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Export bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-3 py-2 space-y-1.5">
        <div className="flex gap-2">
          <input
            value={figLabel}
            onChange={e => setFigLabel(e.target.value)}
            className="w-28 h-7 text-[11px] bg-muted/30 border border-border rounded px-2 font-mono"
            placeholder="fig:label"
          />
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            className="flex-1 h-7 text-[11px] bg-muted/30 border border-border rounded px-2"
            placeholder="Figure caption…"
          />
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={exportSvg} className="flex-1 h-7 text-[11px] gap-1">
            <Download className="h-3 w-3" /> SVG
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportPng(3)} className="flex-1 h-7 text-[11px] gap-1">
            <Download className="h-3 w-3" /> PNG 3×
          </Button>
          <Button size="sm" onClick={insertLatex} className="flex-1 h-7 text-[11px] gap-1">
            <FileCode2 className="h-3 w-3" /> Insert LaTeX
          </Button>
        </div>
      </div>
    </div>
  )
}
