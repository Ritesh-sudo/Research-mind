import { auth, signIn } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function SignInPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">ResearchMind AI</h1>
          <p className="mt-2 text-muted-foreground">
            AI-powered research platform with RAG
          </p>
        </div>
        <div className="space-y-3">
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/dashboard' })
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: '/dashboard' })
            }}
          >
            <Button type="submit" variant="outline" className="w-full" size="lg">
              Continue with GitHub
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Your research stays private. All AI responses are RAG-grounded on your uploaded papers.
        </p>
      </div>
    </div>
  )
}
