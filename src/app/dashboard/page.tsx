import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const userId = session.user.id as string

  const projects = await prisma.researchProject.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true, citations: true, papers: true } },
    },
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ResearchMind AI</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {session.user.name ?? session.user.email}</p>
        </div>
        <DashboardClient />
      </header>

      <main className="px-6 py-8 max-w-6xl mx-auto">
        {projects.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-semibold">Start your first research project</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create a project to get a pre-scaffolded LaTeX paper, RAG-powered AI chat, and multi-paper analysis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: typeof projects[number]) => (
              <Link key={p.id} href={`/project/${p.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">{p.title}</CardTitle>
                      {p.noveltyScore && (
                        <Badge variant={p.noveltyScore >= 70 ? 'success' : 'secondary'} className="shrink-0 text-xs">
                          {p.noveltyScore.toFixed(0)}% novel
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">{p.topic}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="outline">{p.template.toUpperCase()}</Badge>
                      <span>{p._count.messages} messages</span>
                      <span>{p._count.citations} citations</span>
                      <span>{p._count.papers} papers</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
