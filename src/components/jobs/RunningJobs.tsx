/**
 * Top-bar pill: "2 running" while lab jobs render in the background. Opens a
 * list of them; each row goes to its lab.
 */

import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useLabJobs } from './LabJobs'
import type { LabJobKind } from '@/lib/lab-jobs'
import { LAB_OF, LAB_PATH } from '@/lib/lab-jobs'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const KIND_LABEL: Record<LabJobKind, string> = {
  image: 'Image',
  edit: 'Edit',
  upscale: 'Upscale',
  layers: 'Layers',
  video: 'Video',
  'video-upscale': 'Video upscale',
  motion: 'Motion',
}

export function RunningJobs({ className }: { className?: string }) {
  const { jobs } = useLabJobs()
  if (jobs.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
            className,
          )}
          aria-label={`${jobs.length} running`}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          {jobs.length} running
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Rendering in the background — you can keep working
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {jobs.map((job) => (
          <DropdownMenuItem key={job.id} asChild>
            <Link
              to={LAB_PATH[LAB_OF[job.kind]]}
              className="flex items-center gap-3"
            >
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{KIND_LABEL[job.kind]}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {job.prompt || job.model.split('/').slice(-2).join(' ')}
                </span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {job.live?.status === 'processing' ? 'Rendering' : 'Queued'}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
