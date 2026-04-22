'use client'
import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/store/useProjectStore'
import type { Node, Edge } from 'reactflow'

const ReactFlow = dynamic(
  () => import('reactflow').then((mod) => mod.default),
  { ssr: false }
)

const MiniMap = dynamic(() => import('reactflow').then((mod) => mod.MiniMap), { ssr: false })
const Controls = dynamic(() => import('reactflow').then((mod) => mod.Controls), { ssr: false })
const Background = dynamic(() => import('reactflow').then((mod) => mod.Background), { ssr: false })

interface KnowledgeGraphProps {
  projectId: string
}

const nodeColors: Record<string, string> = {
  concept: '#6366f1',
  method: '#10b981',
  dataset: '#f59e0b',
  model: '#ef4444',
  result: '#3b82f6',
}

export function KnowledgeGraph({ projectId }: KnowledgeGraphProps) {
  const { nodes: storeNodes, edges: storeEdges, setNodes, setEdges } = useProjectStore()
  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [loading, setLoading] = useState(false)

  const loadGraph = useCallback(async () => {
    const res = await fetch(`/api/graph/nodes?projectId=${projectId}`)
    const data = await res.json()
    setNodes(data.nodes)
    setEdges(data.edges)
  }, [projectId, setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  useEffect(() => {
    setRfNodes(
      storeNodes.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label: n.label, summary: n.summary },
        style: {
          background: nodeColors[n.type] ?? '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontSize: 12,
          padding: '6px 12px',
        },
      }))
    )
    setRfEdges(
      storeEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.relationship,
        style: { stroke: '#6366f1' },
        labelStyle: { fontSize: 10, fill: '#888' },
      }))
    )
  }, [storeNodes, storeEdges])

  const addNode = useCallback(async () => {
    if (!newLabel.trim()) return
    setLoading(true)
    const res = await fetch('/api/graph/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, label: newLabel.trim(), type: 'concept' }),
    })
    const data = await res.json()
    if (!data.duplicate) {
      setNodes([...storeNodes, data.node])
    }
    setNewLabel('')
    setLoading(false)
  }, [newLabel, projectId, storeNodes, setNodes])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Add concept node..."
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && addNode()}
        />
        <Button size="sm" onClick={addNode} disabled={loading} className="h-7 shrink-0">
          <Plus className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={loadGraph} className="h-7 shrink-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-background/50">
        {typeof window !== 'undefined' && (
          <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        )}
        {storeNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            <p>Add concepts to build your knowledge graph</p>
          </div>
        )}
      </div>
    </div>
  )
}
