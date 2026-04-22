'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewProjectDialog } from '@/components/dashboard/NewProjectDialog'

export function DashboardClient() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New project
      </Button>
      <NewProjectDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
