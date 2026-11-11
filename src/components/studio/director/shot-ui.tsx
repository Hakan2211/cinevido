/**
 * Small shared pieces for Director v2 views: a shot's thumbnail and a
 * plain-words status for where it is in its pipeline.
 */

import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { modelName, shotPreview } from '@/lib/production'
import type { PlanShot, ProductionPlan } from '@/lib/production'

export function ShotThumb({
  shot,
  index,
  className,
  play = false,
}: {
  shot: PlanShot
  index: number
  className?: string
  /** autoplay the clip muted (Storyboard) instead of a poster frame */
  play?: boolean
}) {
  const preview = shotPreview(shot)
  const poster = shot.still?.status === 'done' ? shot.still.url : undefined
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        className,
      )}
    >
      {preview?.kind === 'video' ? (
        <video
          src={preview.url}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={play}
          preload="metadata"
          className="h-full w-full object-cover"
          onMouseEnter={(e) => !play && void e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => !play && e.currentTarget.pause()}
        />
      ) : preview?.kind === 'image' ? (
        <img src={preview.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Film className="h-4 w-4" />
          <span className="sr-only">Shot {index + 1}</span>
        </div>
      )}
    </div>
  )
}

export interface ShotStatus {
  label: string
  /** 0..1 through the steps asked of this shot, for the progress bar */
  progress: number
  running: boolean
  failed: boolean
  /** ISO time the current step started, for "1m 20s" */
  since?: string
}

/**
 * Where a shot is, in words. fal reports no real percentage, so progress is
 * by step (still → draft → check → final), never a made-up number.
 */
export function shotStatus(shot: PlanShot, plan: ProductionPlan): ShotStatus {
  const steps: Array<'still' | 'draft' | 'check' | 'final'> = ['still']
  if (shot.wantDraft) steps.push('draft', 'check')
  if (shot.wantFinal) steps.push('final')
  const doneSteps = steps.filter((s) => shot[s]?.status === 'done').length
  const progress = steps.length ? doneSteps / steps.length : 0

  const failed = (['still', 'draft', 'final'] as const).find(
    (s) => shot[s]?.status === 'failed',
  )
  if (failed) {
    return {
      label: `${failed === 'still' ? 'Still' : failed === 'draft' ? 'Draft' : 'Final'} failed${shot[failed]?.error ? `: ${shot[failed]!.error}` : ''}`,
      progress,
      running: false,
      failed: true,
    }
  }
  if (shot.still?.status === 'running') {
    return { label: 'Painting the first frame…', progress, running: true, failed: false, since: shot.still.startedAt }
  }
  if (shot.draft?.status === 'running') {
    return { label: `Drafting on ${modelName(plan.models.draft)}…`, progress, running: true, failed: false, since: shot.draft.startedAt }
  }
  if (shot.check?.status === 'running') {
    return { label: 'Checking the draft…', progress, running: true, failed: false }
  }
  if (shot.final?.status === 'running') {
    return { label: `Final on ${modelName(plan.models.final.model)}…`, progress, running: true, failed: false, since: shot.final.startedAt }
  }
  if (shot.wantFinal && shot.final?.status === 'done') {
    return { label: shot.decision === 'promote' ? 'Draft promoted to final' : 'Final ready', progress: 1, running: false, failed: false }
  }
  if (shot.wantFinal && !shot.final) {
    return { label: plan.stopped ? 'Stopped at budget' : 'Queued', progress, running: false, failed: false }
  }
  if (
    shot.wantDraft &&
    (shot.check?.status === 'done' || shot.check?.status === 'failed')
  ) {
    return { label: 'Draft ready for review', progress: 1, running: false, failed: false }
  }
  if (shot.wantDraft) {
    return { label: plan.stopped ? 'Stopped at budget' : 'Queued', progress, running: false, failed: false }
  }
  return { label: 'Planned', progress: 0, running: false, failed: false }
}

export function elapsed(since: string | undefined, now: number): string | null {
  if (!since) return null
  const sec = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000))
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`
}

export function clock(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
