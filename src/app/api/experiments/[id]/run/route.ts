import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { spawn } from 'child_process'
import { writeFile, unlink, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const maxDuration = 120

// Parse "METRIC: key=val key2=val2" lines from stdout
function parseMetricLine(line: string): Record<string, number> | null {
  const m = line.match(/^METRIC[S]?:\s*(.+)/)
  if (!m) return null
  const result: Record<string, number> = {}
  // Try JSON first
  try {
    const parsed = JSON.parse(m[1])
    if (typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number') result[k] = v
      }
      return Object.keys(result).length > 0 ? result : null
    }
  } catch { /* not JSON */ }
  // Parse key=value pairs
  const pairs = m[1].matchAll(/(\w+)=([-\d.e+]+)/g)
  for (const [, k, v] of pairs) {
    const n = parseFloat(v)
    if (!isNaN(n)) result[k] = n
  }
  return Object.keys(result).length > 0 ? result : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const experiment = await prisma.experiment.findFirst({ where: { id, project: { userId: session.user.id } } })
  if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { params: runParams } = await req.json().catch(() => ({ params: {} }))

  // Write code to temp file
  const tmpId = randomUUID()
  const scriptPath = join(tmpdir(), `rm_exp_${tmpId}.py`)
  const figPath = join(tmpdir(), `rm_fig_${tmpId}.png`)

  // Only accept Python identifier names; values go via a JSON dict to avoid code injection
  const safeParams: Record<string, unknown> = {}
  const identRe = /^[A-Za-z_][A-Za-z0-9_]*$/
  for (const [k, v] of Object.entries(runParams ?? {})) {
    if (identRe.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null)) {
      safeParams[k] = v
    }
  }

  // Inject helpers into user code. Params are loaded from a JSON env var and
  // promoted to module-level names — no string interpolation into code.
  const preamble = `import sys, os, json
os.environ['__RM_FIG_PATH__'] = ${JSON.stringify(figPath)}
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as _plt_orig
_plt_savefig_orig = _plt_orig.savefig
def _rm_savefig(*a, **kw):
    _plt_savefig_orig(os.environ['__RM_FIG_PATH__'], **(dict(bbox_inches='tight', dpi=150) | kw))
_plt_orig.savefig = _rm_savefig
# Inject run params as module-level variables from JSON
for __rm_k, __rm_v in json.loads(os.environ.get('__RM_PARAMS__', '{}')).items():
    globals()[__rm_k] = __rm_v
`
  await writeFile(scriptPath, preamble + '\n' + experiment.code, 'utf-8')
  await prisma.experiment.update({ where: { id }, data: { status: 'running', logs: '', metrics: {} } })

  const encoder = new TextEncoder()
  const startTime = Date.now()
  const MAX_LOG_LINES = 5000
  const allLogs: string[] = []
  // metrics: { step_metrics: [{step, ...vals}], final: {key: val} }
  const stepMetrics: Record<string, number>[] = []
  let stepCounter = 0

  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...( typeof payload === 'object' ? payload : { value: payload }) })}\n\n`))

      send('status', { status: 'running' })

      const proc = spawn('python3', [scriptPath], {
        env: { ...process.env, PYTHONUNBUFFERED: '1', __RM_PARAMS__: JSON.stringify(safeParams) },
        timeout: 90_000,
      })

      const handleLine = (line: string, isErr = false) => {
        if (allLogs.length < MAX_LOG_LINES) allLogs.push(line)
        else if (allLogs.length === MAX_LOG_LINES) allLogs.push(`… output truncated after ${MAX_LOG_LINES} lines`)
        send('log', { line, isErr })
        const metrics = parseMetricLine(line)
        if (metrics) {
          stepMetrics.push({ step: stepCounter++, ...metrics })
          send('metrics', { metrics, step: stepCounter - 1 })
        }
      }

      // Line-buffered stdout/stderr: preserve partial lines across chunk boundaries
      const makeLineBuffered = (isErr: boolean) => {
        let buf = ''
        return (chunk: Buffer) => {
          buf += chunk.toString('utf8')
          let idx: number
          while ((idx = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, idx)
            buf = buf.slice(idx + 1)
            if (line.length > 0) handleLine(line, isErr)
          }
        }
      }
      const onStdout = makeLineBuffered(false)
      const onStderr = makeLineBuffered(true)
      proc.stdout.on('data', onStdout)
      proc.stderr.on('data', onStderr)

      proc.on('close', async (code) => {
        const duration = Date.now() - startTime
        const status = code === 0 ? 'completed' : 'failed'
        const logsStr = allLogs.join('\n')

        // Build final metrics summary
        const finalMetrics: Record<string, number[]> = {}
        for (const step of stepMetrics) {
          for (const [k, v] of Object.entries(step)) {
            if (k === 'step') continue
            if (!finalMetrics[k]) finalMetrics[k] = []
            finalMetrics[k].push(v)
          }
        }

        // Check for matplotlib figure
        let figureBase64: string | null = null
        try {
          const figBuf = await readFile(figPath)
          figureBase64 = figBuf.toString('base64')
          send('figure', { base64: figureBase64, mime: 'image/png' })
        } catch { /* no figure generated */ }

        const metricsPayload = { steps: stepMetrics, summary: finalMetrics }
        await prisma.experiment.update({
          where: { id },
          data: { status, logs: logsStr, metrics: metricsPayload, duration, updatedAt: new Date() },
        })
        await prisma.experimentRun.create({
          data: {
            experimentId: id,
            status,
            metrics: metricsPayload,
            logs: logsStr,
            figures: figureBase64 ? [{ base64: figureBase64 }] : [],
            duration,
          },
        })

        send('done', { status, duration, exitCode: code })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        // Cleanup
        unlink(scriptPath).catch(() => {})
        unlink(figPath).catch(() => {})
      })

      proc.on('error', (err) => {
        send('log', { line: `Process error: ${err.message}`, isErr: true })
        send('done', { status: 'failed', duration: Date.now() - startTime })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
        unlink(scriptPath).catch(() => {})
      })
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
