'use client'
import React, {
  useState, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react'
import dynamic from 'next/dynamic'
import {
  Play, Square, Loader2, Plus, Trash2, Wand2, Save,
  Pencil, ChevronRight, BarChart2, FileCode2, Copy, CheckCheck,
  FlaskConical, AlertCircle, CheckCircle2, Clock, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { applyToEditor, editorRef } from '@/lib/editorRef'
import { parseSSE } from '@/lib/sse'
import { useProjectStore } from '@/store/useProjectStore'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then(m => m.default),
  { ssr: false, loading: () => <div className="flex-1 bg-[#0a0a0f] flex items-center justify-center text-xs text-muted-foreground">Loading editor…</div> }
)

// ─── Types ────────────────────────────────────────────────────────────────────
interface MetricStep {
  step: number
  [key: string]: number
}

interface MetricSummary {
  [key: string]: number[]
}

interface ExperimentRun {
  id: string
  status: string
  metrics: { steps: MetricStep[]; summary: MetricSummary } | null
  figures: { base64: string }[] | null
  duration: number | null
  createdAt: string
}

interface Experiment {
  id: string
  name: string
  description: string
  code: string
  status: string
  metrics: { steps: MetricStep[]; summary: MetricSummary } | null
  logs: string
  duration: number | null
  runs: ExperimentRun[]
  updatedAt: string
}

// ─── Mini SVG Chart ───────────────────────────────────────────────────────────
function LineChart({ data, keys, height = 120 }: { data: MetricStep[]; keys: string[]; height?: number }) {
  if (!data.length || !keys.length) return null
  const W = 280, H = height, PAD = { t: 10, r: 10, b: 28, l: 40 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b

  const COLORS = ['#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa', '#facc15']

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'inherit' }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ch * (1 - t)} y2={PAD.t + ch * (1 - t)}
          stroke="#1e293b" strokeWidth="1" />
      ))}
      {keys.map((key, ki) => {
        const vals = data.map(d => d[key] ?? NaN).filter(v => !isNaN(v))
        if (!vals.length) return null
        const min = Math.min(...vals), max = Math.max(...vals)
        const range = max - min || 1
        const pts = data
          .map((d, i) => {
            const v = d[key] ?? NaN
            if (isNaN(v)) return null
            const x = PAD.l + (i / Math.max(data.length - 1, 1)) * cw
            const y = PAD.t + ch - ((v - min) / range) * ch
            return `${x},${y}`
          })
          .filter(Boolean)
          .join(' ')
        const color = COLORS[ki % COLORS.length]
        // Y-axis labels for first key
        const yLabels = ki === 0 ? [0, 0.5, 1].map(t => ({
          y: PAD.t + ch * (1 - t),
          label: (min + t * range).toPrecision(3),
        })) : []
        return (
          <g key={key}>
            {yLabels.map(({ y, label }, li) => (
              <text key={li} x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#64748b">{label}</text>
            ))}
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
            {/* Legend dot */}
            <circle cx={PAD.l + ki * 65} cy={H - 8} r="3" fill={color} />
            <text x={PAD.l + ki * 65 + 6} y={H - 4} fontSize="8" fill={color}>{key}</text>
          </g>
        )
      })}
      {/* X-axis labels */}
      {[0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
        <text key={i} x={PAD.l + (i / Math.max(data.length - 1, 1)) * cw} y={H - PAD.b + 14}
          textAnchor="middle" fontSize="8" fill="#64748b">{data[i]?.step ?? i}</text>
      ))}
      <text x={PAD.l + cw / 2} y={H - PAD.b + 24} textAnchor="middle" fontSize="8" fill="#475569">step</text>
    </svg>
  )
}

function BarChart({ summary }: { summary: MetricSummary }) {
  const entries = Object.entries(summary).map(([k, vals]) => ({
    key: k,
    last: vals[vals.length - 1],
    best: Math.max(...vals),
  })).slice(0, 8)
  if (!entries.length) return null
  const W = 280, H = 100, PAD = { t: 8, r: 10, b: 20, l: 60 }
  const cw = W - PAD.l - PAD.r
  const bh = (H - PAD.t - PAD.b - (entries.length - 1) * 3) / entries.length
  const max = Math.max(...entries.map(e => e.last))
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'inherit' }}>
      {entries.map((e, i) => {
        const y = PAD.t + i * (bh + 3)
        const bw = max ? (e.last / max) * cw : 0
        return (
          <g key={e.key}>
            <text x={PAD.l - 4} y={y + bh / 2 + 4} textAnchor="end" fontSize="8" fill="#94a3b8">{e.key}</text>
            <rect x={PAD.l} y={y} width={bw} height={bh} rx="2" fill="#6366f1" opacity="0.8" />
            <text x={PAD.l + bw + 3} y={y + bh / 2 + 4} fontSize="8" fill="#94a3b8">
              {e.last.toPrecision(4)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Boilerplate templates ─────────────────────────────────────────────────────
const TEMPLATES: { label: string; code: string }[] = [
  {
    label: 'Classification',
    code: `import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

np.random.seed(42)
X, y = make_classification(n_samples=1000, n_features=20, n_informative=10, random_state=42)
scaler = StandardScaler()
X = scaler.fit_transform(X)

models = {
    'Logistic Regression': LogisticRegression(max_iter=1000),
    'Random Forest':       RandomForestClassifier(n_estimators=100, random_state=42),
    'Gradient Boosting':   GradientBoostingClassifier(n_estimators=100, random_state=42),
}

print("=== Model Comparison ===")
results = {}
for name, model in models.items():
    scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
    mean, std = scores.mean(), scores.std()
    results[name] = mean
    print(f"METRIC: accuracy={mean:.4f} std={std:.4f}")
    print(f"  {name}: {mean:.4f} ± {std:.4f}")

# Bar chart
fig, ax = plt.subplots(figsize=(8, 4))
names, vals = zip(*results.items())
bars = ax.bar(names, vals, color=['#6366f1','#34d399','#fb923c'], edgecolor='white', linewidth=0.5)
ax.set_ylim(0.8, 1.0)
ax.set_ylabel('Accuracy (5-fold CV)')
ax.set_title('Model Comparison on Synthetic Dataset')
for bar, v in zip(bars, vals):
    ax.text(bar.get_x() + bar.get_width()/2, v + 0.002, f'{v:.3f}', ha='center', fontsize=9)
plt.tight_layout()
plt.savefig()
print("\\n=== Best Model ===")
best = max(results, key=results.get)
print(f"METRIC: best_accuracy={results[best]:.4f}")
print(f"Winner: {best} ({results[best]:.4f})")`,
  },
  {
    label: 'Training Curve',
    code: `import numpy as np
import matplotlib.pyplot as plt

np.random.seed(42)
epochs = 50
lr, momentum = 0.01, 0.9

# Simulate SGD with momentum training
train_loss = []; val_loss = []; train_acc = []; val_acc = []
w = 1.0; v = 0.0

for epoch in range(1, epochs + 1):
    # Simulated metrics with realistic decay + noise
    tl = 2.0 * np.exp(-0.08 * epoch) + 0.05 * np.random.randn()
    vl = tl + 0.1 + 0.03 * np.random.randn() + (0.02 if epoch > 35 else 0)
    ta = 1 - 0.5 * np.exp(-0.1 * epoch) + 0.005 * np.random.randn()
    va = ta - 0.05 + 0.005 * np.random.randn()
    train_loss.append(max(0.01, tl)); val_loss.append(max(0.01, vl))
    train_acc.append(min(1, ta)); val_acc.append(min(1, va))
    print(f"METRIC: epoch={epoch} train_loss={tl:.4f} val_loss={vl:.4f} train_acc={ta:.4f} val_acc={va:.4f}")

# Plot
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))
ax1.plot(train_loss, label='Train', color='#6366f1'); ax1.plot(val_loss, label='Val', color='#fb923c')
ax1.set_title('Loss'); ax1.set_xlabel('Epoch'); ax1.legend(); ax1.grid(alpha=0.3)
ax2.plot(train_acc, label='Train', color='#6366f1'); ax2.plot(val_acc, label='Val', color='#fb923c')
ax2.set_title('Accuracy'); ax2.set_xlabel('Epoch'); ax2.legend(); ax2.grid(alpha=0.3)
plt.suptitle('Training Curves', fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig()
print(f"\\nFinal — train_loss={train_loss[-1]:.4f} val_loss={val_loss[-1]:.4f}")
print(f"METRIC: final_train_acc={train_acc[-1]:.4f} final_val_acc={val_acc[-1]:.4f}")`,
  },
  {
    label: 'Hyperparameter Search',
    code: `import numpy as np
from sklearn.datasets import make_regression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt

np.random.seed(42)
X, y = make_regression(n_samples=500, n_features=15, noise=0.1, random_state=42)

param_grid = [10, 25, 50, 75, 100, 150, 200]
results = []
print("=== Hyperparameter Search: n_estimators ===")
for n in param_grid:
    model = RandomForestRegressor(n_estimators=n, random_state=42)
    scores = cross_val_score(model, X, y, cv=5, scoring='r2')
    r2 = scores.mean()
    results.append(r2)
    print(f"METRIC: n_estimators={n} r2={r2:.4f}")

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(param_grid, results, 'o-', color='#6366f1', linewidth=2, markersize=6)
ax.fill_between(param_grid, [r - 0.01 for r in results], [r + 0.01 for r in results], alpha=0.15, color='#6366f1')
ax.set_xlabel('n_estimators'); ax.set_ylabel('R² Score (5-fold CV)')
ax.set_title('Hyperparameter Sensitivity: Random Forest'); ax.grid(alpha=0.3)
best_n = param_grid[int(np.argmax(results))]
ax.axvline(best_n, color='#fb923c', linestyle='--', label=f'Best: {best_n}')
ax.legend(); plt.tight_layout(); plt.savefig()
print(f"\\nBest n_estimators={best_n}, R²={max(results):.4f}")
print(f"METRIC: best_r2={max(results):.4f} best_n={best_n}")`,
  },
  {
    label: 'Ablation Study',
    code: `import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

np.random.seed(42)
X, y = make_classification(n_samples=800, n_features=20, random_state=42)

# Full model baseline
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
base_model = GradientBoostingClassifier(n_estimators=100, random_state=42)
base_score = cross_val_score(base_model, X_scaled, y, cv=5).mean()
print(f"METRIC: full_model={base_score:.4f}")

ablations = {
    'Full Model':         (X_scaled, GradientBoostingClassifier(n_estimators=100, random_state=42)),
    'No Scaling':         (X,        GradientBoostingClassifier(n_estimators=100, random_state=42)),
    'Fewer Estimators':   (X_scaled, GradientBoostingClassifier(n_estimators=20,  random_state=42)),
    'Shallow Trees':      (X_scaled, GradientBoostingClassifier(n_estimators=100, max_depth=1, random_state=42)),
    'High LR':            (X_scaled, GradientBoostingClassifier(n_estimators=100, learning_rate=0.5, random_state=42)),
}

print("\\n=== Ablation Study ===")
scores = {}
for name, (Xv, model) in ablations.items():
    s = cross_val_score(model, Xv, y, cv=5).mean()
    scores[name] = s
    delta = s - base_score
    print(f"METRIC: {name.replace(' ','_')}={s:.4f} delta={delta:.4f}")
    print(f"  {name:25s}: {s:.4f}  (Δ{delta:+.4f})")

fig, ax = plt.subplots(figsize=(9, 4))
names, vals = zip(*scores.items())
colors = ['#6366f1' if n == 'Full Model' else ('#ef4444' if v < base_score else '#34d399') for n, v in zip(names, vals)]
bars = ax.barh(names, vals, color=colors, edgecolor='none', height=0.6)
ax.axvline(base_score, color='#6366f1', linestyle='--', linewidth=1.5)
ax.set_xlabel('Accuracy (5-fold CV)'); ax.set_title('Ablation Study')
for bar, v in zip(bars, vals):
    ax.text(v + 0.001, bar.get_y() + bar.get_height()/2, f'{v:.3f}', va='center', fontsize=9)
plt.tight_layout(); plt.savefig()`,
  },
]

// ─── Smart auto-insert into LaTeX ─────────────────────────────────────────────
function buildResultsLatex(expName: string, metrics: { key: string; last: number; best: number }[], figSlug: string | null, hasFigure: boolean): string {
  const slug = expName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const parts: string[] = []

  if (metrics.length > 0) {
    const rows = metrics.map(m => `    ${m.key} & ${m.last.toPrecision(4)} & ${m.best.toPrecision(4)} \\\\`)
    parts.push(
      `\\begin{table}[htbp]\n  \\centering\n  \\caption{Results: ${expName}}\n  \\label{tab:${slug}}\n  \\begin{tabular}{lcc}\n    \\hline\n    Metric & Final & Best \\\\\n    \\hline\n${rows.join('\n')}\n    \\hline\n  \\end{tabular}\n\\end{table}`
    )
  }

  if (hasFigure && figSlug) {
    parts.push(
      `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.9\\linewidth]{figures/${figSlug}_results.png}\n  \\caption{Experimental results for ${expName}.}\n  \\label{fig:${figSlug}_results}\n\\end{figure}`
    )
  }

  return parts.join('\n\n')
}

function smartInsertIntoLatex(latex: string, block: string, expName: string): string {
  // Candidate section headings (case-insensitive)
  const sectionPatterns = [
    /\\section\{[Ee]xperiments?\}/,
    /\\section\{[Rr]esults?\}/,
    /\\section\{[Ee]valuation\}/,
    /\\section\{[Ee]xperimental [Rr]esults?\}/,
  ]

  for (const pattern of sectionPatterns) {
    const match = latex.match(pattern)
    if (!match || match.index === undefined) continue

    // Find next \section or \end{document} after this one
    const after = latex.indexOf(match[0]) + match[0].length
    const nextSection = latex.slice(after).search(/\\section\{|\\end\{document\}/)
    const insertAt = nextSection === -1 ? latex.length : after + nextSection

    // Avoid duplicating results for the same experiment
    const marker = `% experiment:${expName.replace(/\s+/g, '_')}`
    if (latex.includes(marker)) {
      // Replace existing block
      const start = latex.indexOf(marker)
      const end = latex.indexOf('% /experiment', start)
      if (end !== -1) {
        return latex.slice(0, start) + `${marker}\n${block}\n% /experiment` + latex.slice(end + '% /experiment'.length)
      }
    }

    return (
      latex.slice(0, insertAt) +
      `\n\n${marker}\n${block}\n% /experiment\n` +
      latex.slice(insertAt)
    )
  }

  // No experiments section — create one before \end{document}
  const endDoc = latex.lastIndexOf('\\end{document}')
  const marker = `% experiment:${expName.replace(/\s+/g, '_')}`

  if (latex.includes(marker)) {
    const start = latex.indexOf(marker)
    const end = latex.indexOf('% /experiment', start)
    if (end !== -1) {
      return latex.slice(0, start) + `${marker}\n${block}\n% /experiment` + latex.slice(end + '% /experiment'.length)
    }
  }

  const newSection = `\n\\section{Experiments}\n\n${marker}\n${block}\n% /experiment\n`
  if (endDoc !== -1) {
    return latex.slice(0, endDoc) + newSection + latex.slice(endDoc)
  }
  return latex + newSection
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface ExperimentLabProps { projectId: string }

export function ExperimentLab({ projectId }: ExperimentLabProps) {
  const { latexContent, setLatexContent } = useProjectStore()
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('Untitled Experiment')
  const [editingName, setEditingName] = useState(false)
  const [code, setCode] = useState(TEMPLATES[0].code)
  const [description, setDescription] = useState('')
  const [params, setParams] = useState('')
  const [running, setRunning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<{ line: string; isErr: boolean }[]>([])
  const [liveMetrics, setLiveMetrics] = useState<MetricStep[]>([])
  const [liveFigure, setLiveFigure] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [duration, setDuration] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showRuns, setShowRuns] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [activeTab, setActiveTab] = useState<'terminal' | 'metrics' | 'figure'>('terminal')

  const abortRef = useRef<AbortController | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const liveMetricsRef = useRef<MetricStep[]>([])
  const liveFigureRef = useRef<string | null>(null)

  // ── Vertical resize: editor / output split ──────────────────────────────
  const [editorH, setEditorH] = useState(220)
  const vDragging = useRef(false)
  const vY0 = useRef(0); const vH0 = useRef(0)

  const onVDrag = (e: React.MouseEvent) => {
    e.preventDefault(); vDragging.current = true; vY0.current = e.clientY; vH0.current = editorH
    document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none'
  }
  useLayoutEffect(() => {
    const mv = (e: MouseEvent) => { if (!vDragging.current) return; setEditorH(Math.max(80, Math.min(480, vH0.current + e.clientY - vY0.current))) }
    const up = () => { vDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = '' }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [])

  // ── Load experiments ────────────────────────────────────────────────────
  const loadExperiments = useCallback(async () => {
    const res = await fetch(`/api/experiments?projectId=${projectId}`)
    if (res.ok) { const d = await res.json(); setExperiments(d.experiments ?? []) }
  }, [projectId])

  useEffect(() => { loadExperiments() }, [loadExperiments])

  // ── Auto-scroll terminal ────────────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [logs])

  // ── Activate experiment ─────────────────────────────────────────────────
  const activateExperiment = useCallback((exp: Experiment) => {
    setActiveId(exp.id); setName(exp.name); setCode(exp.code)
    setLogs(exp.logs ? exp.logs.split('\n').map(l => ({ line: l, isErr: false })) : [])
    setLiveMetrics(exp.metrics?.steps ?? [])
    setRunStatus(exp.status as typeof runStatus)
    setDuration(exp.duration)
    const runs = exp.runs ?? []
    setLiveFigure((runs[0]?.figures as { base64: string }[] | null)?.[0]?.base64 ?? null)
    if ((runs[0]?.figures as { base64: string }[] | null)?.[0]) setActiveTab('figure')
    else if (exp.metrics?.steps?.length) setActiveTab('metrics')
    else setActiveTab('terminal')
  }, [])

  const newExperiment = useCallback(() => {
    setActiveId(null); setName('Untitled Experiment'); setCode(TEMPLATES[0].code)
    setLogs([]); setLiveMetrics([]); setLiveFigure(null)
    setRunStatus('idle'); setDuration(null)
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────
  const saveExperiment = useCallback(async () => {
    setSaving(true)
    try {
      if (activeId) {
        await fetch(`/api/experiments/${activeId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code }),
        })
        setExperiments(prev => prev.map(e => e.id === activeId ? { ...e, name, code } : e))
      } else {
        const res = await fetch('/api/experiments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, name, code }),
        })
        const d = await res.json()
        setActiveId(d.experiment.id)
        setExperiments(prev => [d.experiment, ...prev])
      }
    } finally { setSaving(false) }
  }, [activeId, name, code, projectId])

  const deleteExperiment = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/experiments/${id}`, { method: 'DELETE' })
    setExperiments(prev => prev.filter(ex => ex.id !== id))
    if (activeId === id) newExperiment()
  }, [activeId, newExperiment])

  // ── Auto-insert results into LaTeX paper ────────────────────────────────
  const autoInsertResults = useCallback((expName: string, steps: MetricStep[], figure: string | null) => {
    const slug = expName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    // Build final metrics summary from steps
    const summary: Record<string, number[]> = {}
    for (const step of steps) {
      for (const [k, v] of Object.entries(step)) {
        if (k === 'step') continue
        if (!summary[k]) summary[k] = []
        summary[k].push(v)
      }
    }
    const metrics = Object.entries(summary)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => ({ key: k, last: v[v.length - 1] ?? 0, best: Math.max(...v) }))

    if (metrics.length === 0 && !figure) return  // nothing to insert

    const block = buildResultsLatex(expName, metrics, slug, !!figure)
    const currentLatex = editorRef.current?.getModel()?.getValue() ?? latexContent
    if (!currentLatex.trim()) return

    const updated = smartInsertIntoLatex(currentLatex, block, expName)

    // Push to Monaco editor
    const model = editorRef.current?.getModel()
    if (model) {
      editorRef.current?.executeEdits('experiment-auto-insert', [{
        range: model.getFullModelRange(),
        text: updated,
      }])
    }
    // Also sync Zustand store so autosave picks it up
    setLatexContent(updated)

    // Save to DB
    fetch('/api/paper/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, content: updated }),
    }).catch(() => {})

  }, [latexContent, setLatexContent, projectId])

  // ── Run ─────────────────────────────────────────────────────────────────
  const runExperiment = useCallback(async () => {
    if (running) return
    // Save first to get an ID
    let expId = activeId
    if (!expId) {
      const res = await fetch('/api/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name, code }),
      })
      const d = await res.json()
      expId = d.experiment.id
      setActiveId(expId)
      setExperiments(prev => [d.experiment, ...prev])
    } else {
      await fetch(`/api/experiments/${expId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      })
    }

    // Parse params
    let parsedParams: Record<string, unknown> = {}
    try {
      if (params.trim()) {
        if (params.trim().startsWith('{')) parsedParams = JSON.parse(params)
        else {
          for (const pair of params.split(',')) {
            const [k, v] = pair.split('=').map(s => s.trim())
            if (k && v) parsedParams[k] = isNaN(Number(v)) ? v : Number(v)
          }
        }
      }
    } catch { /* ignore bad params */ }

    setRunning(true); setRunStatus('running')
    setLogs([]); setLiveMetrics([]); setLiveFigure(null)
    liveMetricsRef.current = []; liveFigureRef.current = null
    setActiveTab('terminal')
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`/api/experiments/${expId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: parsedParams }),
        signal: abortRef.current.signal,
      })
      if (!res.body) return
      type RunStatus = 'running' | 'completed' | 'failed' | 'idle'
      type RunEvent =
        | { type: 'log'; line: string; isErr?: boolean }
        | { type: 'metrics'; step: number; metrics: Record<string, number> }
        | { type: 'figure'; base64: string }
        | { type: 'done'; status: RunStatus; duration: number }
        | { type: 'status'; status: RunStatus }
      for await (const p of parseSSE<RunEvent>(res.body)) {
        if (p.type === 'log') setLogs(prev => [...prev, { line: p.line, isErr: !!p.isErr }])
        else if (p.type === 'metrics') {
          const next = { step: p.step, ...p.metrics }
          liveMetricsRef.current = [...liveMetricsRef.current, next]
          setLiveMetrics(liveMetricsRef.current)
        }
        else if (p.type === 'figure') {
          liveFigureRef.current = p.base64
          setLiveFigure(p.base64); setActiveTab('figure')
        }
        else if (p.type === 'done') {
          setRunStatus(p.status); setDuration(p.duration)
          const finalSteps = liveMetricsRef.current
          if (finalSteps.length > 0 && !liveFigureRef.current) setActiveTab('metrics')
          await loadExperiments()
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setRunStatus('failed')
    } finally {
      setRunning(false)
    }
  }, [running, activeId, projectId, name, code, params, liveMetrics.length, liveFigure, loadExperiments])

  const stopExperiment = () => { abortRef.current?.abort(); setRunning(false); setRunStatus('failed') }

  // ── AI code generation ──────────────────────────────────────────────────
  const generateCode = useCallback(async () => {
    if (!description.trim() || generating) return
    let expId = activeId
    if (!expId) {
      const res = await fetch('/api/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, name, code: '' }),
      })
      const d = await res.json(); expId = d.experiment.id
      setActiveId(expId); setExperiments(prev => [d.experiment, ...prev])
    }
    setGenerating(true); setCode('')
    let acc = ''
    try {
      const res = await fetch(`/api/experiments/${expId}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, existingCode: code }),
      })
      if (!res.body) return
      for await (const p of parseSSE<{ text?: string }>(res.body)) {
        if (p.text) { acc += p.text; setCode(acc) }
      }
      // Strip markdown fences if AI added them
      acc = acc.replace(/^```python\n?/, '').replace(/\n?```$/, '').trim()
      setCode(acc)
    } finally { setGenerating(false) }
  }, [description, generating, activeId, projectId, name, code])

  // ── Export helpers ──────────────────────────────────────────────────────
  const summary = liveMetrics.length > 0 && liveMetrics[0]
    ? Object.keys(liveMetrics[0]).filter(k => k !== 'step').reduce<MetricSummary>((acc, k) => {
        acc[k] = liveMetrics.map(s => s[k]).filter((v): v is number => v !== undefined)
        return acc
      }, {})
    : {}

  const metricKeys = Object.keys(summary)
  const finalMetrics = Object.entries(summary)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => ({ key: k, last: v[v.length - 1] ?? 0, best: v.length > 0 ? Math.max(...v) : 0 }))

  const insertResultsTable = () => {
    if (!finalMetrics.length) return
    const rows = finalMetrics.map(m => `  ${m.key} & ${m.last?.toPrecision(4) ?? '-'} & ${m.best?.toPrecision(4) ?? '-'} \\\\`)
    const latex = `\\begin{table}[htbp]\n  \\centering\n  \\caption{Experimental Results: ${name}}\n  \\label{tab:${name.toLowerCase().replace(/\s+/g, '_')}}\n  \\begin{tabular}{lcc}\n    \\hline\n    Metric & Final & Best \\\\\n    \\hline\n${rows.join('\n')}\n    \\hline\n  \\end{tabular}\n\\end{table}`
    applyToEditor(latex, 'insert')
  }

  const insertFigure = () => {
    if (!liveFigure) return
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const filename = `${slug}_results`
    const latexLabel = `fig:${filename}`
    const latex = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.9\\linewidth]{figures/${filename}.png}\n  \\caption{Experimental results for ${name}.}\n  \\label{${latexLabel}}\n\\end{figure}`
    applyToEditor(latex, 'insert')
  }

  const downloadFigure = () => {
    if (!liveFigure) return
    const a = document.createElement('a')
    a.href = `data:image/png;base64,${liveFigure}`
    a.download = `${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_results.png`
    a.click()
  }

  // ── Status badge ────────────────────────────────────────────────────────
  const StatusIcon = () => {
    if (runStatus === 'running') return <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
    if (runStatus === 'completed') return <CheckCircle2 className="h-3 w-3 text-green-400" />
    if (runStatus === 'failed') return <AlertCircle className="h-3 w-3 text-red-400" />
    return <FlaskConical className="h-3 w-3 text-muted-foreground" />
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">


      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 border-b border-border bg-muted/20 space-y-2">
        {/* Title row */}
        <div className="flex items-center gap-2">
          {editingName
            ? <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onBlur={() => setEditingName(false)} onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                className="flex-1 h-7 text-sm bg-background border border-primary rounded px-2 font-medium" />
            : <button onClick={() => setEditingName(true)} className="flex-1 text-sm font-medium flex items-center gap-1.5 hover:text-primary text-left truncate">
                <StatusIcon /><span className="truncate">{name}</span><Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
          }
          <Button size="sm" variant="outline" onClick={saveExperiment} disabled={saving} className="h-7 px-2 gap-1 text-xs shrink-0">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="outline" onClick={newExperiment} className="h-7 w-7 p-0 shrink-0"><Plus className="h-3.5 w-3.5" /></Button>
        </div>

        {/* Run controls */}
        <div className="flex gap-1.5">
          {running
            ? <Button size="sm" variant="destructive" onClick={stopExperiment} className="flex-1 h-7 text-xs gap-1">
                <Square className="h-3 w-3" /> Stop
              </Button>
            : <Button size="sm" onClick={runExperiment} className="flex-1 h-7 text-xs gap-1 bg-green-600 hover:bg-green-700">
                <Play className="h-3 w-3" /> Run
              </Button>
          }
          <Button size="sm" variant="outline" onClick={() => setShowTemplates(v => !v)} className="h-7 px-2 text-xs">Templates</Button>
          <Button size="sm" variant="outline" onClick={() => setShowRuns(v => !v)} className="h-7 px-2 text-xs gap-1">
            <Clock className="h-3 w-3" />{experiments.find(e => e.id === activeId)?.runs?.length ?? 0}
          </Button>
        </div>

        {/* Duration */}
        {duration !== null && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {(duration / 1000).toFixed(2)}s
            {runStatus === 'completed' && <span className="text-green-400 ml-1">✓ completed</span>}
            {runStatus === 'failed' && <span className="text-red-400 ml-1">✗ failed</span>}
          </div>
        )}

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="flex flex-col gap-1">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => { setCode(t.code); setShowTemplates(false) }}
                className="text-left text-xs px-2 py-1.5 rounded bg-muted/50 hover:bg-primary/10 hover:border-primary border border-border transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Saved experiments strip ──────────────────────────────────────── */}
      {experiments.length > 0 && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-3 py-1.5 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {experiments.map(exp => (
              <div key={exp.id} onClick={() => activateExperiment(exp)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer shrink-0 transition-colors text-[11px] ${activeId === exp.id ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-border hover:border-green-500/50'}`}>
                <span className="max-w-[80px] truncate">{exp.name}</span>
                <button onClick={e => deleteExperiment(exp.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Run history (collapsible) ────────────────────────────────────── */}
      {showRuns && activeId && (
        <div className="shrink-0 border-b border-border px-3 py-2 bg-muted/5">
          <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1.5">Run History</p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {(experiments.find(e => e.id === activeId)?.runs ?? []).map(run => (
              <div key={run.id} className="flex items-center gap-2 text-[11px] p-1.5 bg-muted/30 rounded">
                {run.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" /> : <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />}
                <span className="text-muted-foreground">{new Date(run.createdAt).toLocaleTimeString()}</span>
                {run.duration && <span className="text-muted-foreground">{(run.duration / 1000).toFixed(1)}s</span>}
                {run.metrics && Object.entries((run.metrics.summary ?? {})).slice(0, 2).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[9px] px-1">{k}: {(v as number[]).slice(-1)[0]?.toPrecision(3)}</Badge>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Params ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border">
        <input value={params} onChange={e => setParams(e.target.value)}
          placeholder="Params: lr=0.01, epochs=50  or  {&quot;lr&quot;: 0.01}"
          className="w-full h-7 text-[11px] bg-muted/30 border border-border rounded px-2 font-mono focus:outline-none focus:border-primary" />
      </div>

      {/* ── Monaco editor ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border" style={{ height: editorH }}>
        <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/20 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">Python</span>
          <button onClick={() => { navigator.clipboard.writeText(code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000) }}
            className="text-muted-foreground hover:text-foreground">
            {copiedCode ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <MonacoEditor
          height={editorH - 28}
          language="python"
          theme="vs-dark"
          value={code}
          onChange={v => setCode(v ?? '')}
          options={{ fontSize: 12, fontFamily: 'JetBrains Mono, Fira Code, monospace', minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false, tabSize: 4, padding: { top: 6 } }}
        />
      </div>

      {/* ── Vertical drag handle ─────────────────────────────────────────── */}
      <div onMouseDown={onVDrag} className="h-1 shrink-0 cursor-row-resize hover:bg-primary/50 active:bg-primary transition-colors" />

      {/* ── Output tabs ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b border-border">
        {(['terminal', 'metrics', 'figure'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[11px] border-b-2 transition-colors capitalize flex items-center justify-center gap-1 ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tab === 'terminal' && <ChevronRight className="h-3 w-3" />}
            {tab === 'metrics' && <BarChart2 className="h-3 w-3" />}
            {tab === 'figure' && <Sparkles className="h-3 w-3" />}
            {tab}
            {tab === 'metrics' && liveMetrics.length > 0 && <Badge variant="outline" className="text-[9px] px-1 h-4">{liveMetrics.length}</Badge>}
            {tab === 'figure' && liveFigure && <span className="text-green-400 text-[9px]">●</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Terminal */}
        {activeTab === 'terminal' && (
          <div ref={terminalRef} className="h-full overflow-y-auto p-2 bg-[#0a0a0f] font-mono text-xs space-y-0.5">
            {logs.length === 0 && runStatus === 'idle' && (
              <p className="text-muted-foreground text-center py-4">Click Run to execute your experiment</p>
            )}
            {logs.map((l, i) => (
              <div key={i} className={`leading-relaxed ${l.isErr ? 'text-red-400' : l.line.startsWith('METRIC') ? 'text-green-400' : 'text-slate-300'}`}>
                {l.line.startsWith('===') ? <span className="text-yellow-400 font-semibold">{l.line}</span> : l.line}
              </div>
            ))}
            {running && <div className="text-yellow-400 animate-pulse">▌</div>}
          </div>
        )}

        {/* Metrics */}
        {activeTab === 'metrics' && (
          <div className="h-full overflow-y-auto p-3 space-y-3">
            {liveMetrics.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No metrics yet. Use <code className="bg-muted px-1 rounded">print("METRIC: key=value")</code> in your code.</p>
            ) : (
              <>
                {/* Final metrics chips */}
                <div className="flex flex-wrap gap-1.5">
                  {finalMetrics.map(m => (
                    <div key={m.key} className="text-[11px] px-2 py-1 rounded bg-muted/40 border border-border">
                      <span className="text-muted-foreground">{m.key}</span>
                      <span className="ml-1.5 font-mono font-semibold">{m.last?.toPrecision(4)}</span>
                      {m.best !== m.last && <span className="ml-1 text-green-400 text-[9px]">best {m.best.toPrecision(3)}</span>}
                    </div>
                  ))}
                </div>
                {/* Line chart (step series) */}
                {liveMetrics.length > 1 && metricKeys.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Training Curves</p>
                    <LineChart data={liveMetrics} keys={metricKeys.slice(0, 4)} height={130} />
                  </div>
                )}
                {/* Bar chart (final values) */}
                {liveMetrics.length === 1 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Final Metrics</p>
                    <BarChart summary={summary} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Figure */}
        {activeTab === 'figure' && (
          <div className="h-full overflow-auto p-3">
            {liveFigure ? (
              <img src={`data:image/png;base64,${liveFigure}`} alt="Experiment figure" className="w-full rounded border border-border" />
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                No figure yet. Call <code className="bg-muted px-1 rounded">plt.savefig()</code> in your code.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── AI generate bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-muted/10 px-3 py-2 space-y-1.5">
        <div className="flex gap-2">
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateCode() }}
            placeholder="Describe experiment… (⌘Enter to generate code)"
            rows={2}
            className="flex-1 resize-none text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary"
          />
          <Button size="sm" onClick={generateCode} disabled={generating || !description.trim()} className="self-end h-8 w-8 p-0 shrink-0">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Insert into paper bar ───────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-3 py-2 flex gap-1.5">
        <Button size="sm" variant="outline" onClick={insertResultsTable} disabled={!finalMetrics.length} className="flex-1 h-7 text-[11px] gap-1">
          <FileCode2 className="h-3 w-3" /> Results Table
        </Button>
        <Button size="sm" variant="outline" onClick={downloadFigure} disabled={!liveFigure} className="h-7 w-7 p-0 shrink-0" title="Download figure PNG">
          ↓
        </Button>
        <Button size="sm" onClick={insertFigure} disabled={!liveFigure} className="flex-1 h-7 text-[11px] gap-1">
          <FileCode2 className="h-3 w-3" /> Insert Figure
        </Button>
      </div>
    </div>
  )
}
