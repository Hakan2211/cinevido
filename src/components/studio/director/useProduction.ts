/**
 * The Studio's view of a production: reads the plan, and while anything is
 * in flight keeps the server runner ticking (poll fal → start the next step →
 * self-check → assemble). Ticking stops on its own when the plan is idle, so
 * an untouched project costs no requests.
 */

import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { planActive } from '@/lib/production'
import type { ProductionState } from '@/server/production.server'
import type { ShotEdit, FinalChoice } from '@/lib/production'

const TICK_MS = 4000

export const productionKey = (projectId: string) => ['production', projectId]

export function useProduction(
  projectId: string,
  opts: { onAssembled?: () => void; onAssetsChanged?: () => void } = {},
) {
  const queryClient = useQueryClient()
  const key = productionKey(projectId)
  const first = useRef(true)

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ProductionState> => {
      // the first load only reads; later polls advance the run
      if (first.current) {
        first.current = false
        const { getProductionFn } = await import('@/server/production.server')
        return getProductionFn({ data: { projectId } })
      }
      const { tickProductionFn } = await import('@/server/production.server')
      return tickProductionFn({ data: { projectId } })
    },
    refetchInterval: (q) => {
      const plan = q.state.data?.plan
      return plan && planActive(plan) ? TICK_MS : false
    },
    refetchIntervalInBackground: true,
  })

  // new stills/clips land in the asset library; the cut lands on the timeline
  const doneCount = countDone(query.data)
  const prevDone = useRef(doneCount)
  useEffect(() => {
    if (doneCount !== prevDone.current) {
      prevDone.current = doneCount
      opts.onAssetsChanged?.()
    }
  }, [doneCount, opts])

  const assembledAt = query.data?.plan?.assembly?.at
  const prevAssembled = useRef(assembledAt)
  useEffect(() => {
    if (assembledAt && assembledAt !== prevAssembled.current) {
      prevAssembled.current = assembledAt
      opts.onAssembled?.()
    }
  }, [assembledAt, opts])

  const setState = (state: ProductionState) =>
    queryClient.setQueryData(key, state)

  const render = useMutation({
    mutationFn: async (stage: 'drafts' | 'finals' | 'direct') => {
      const { renderProductionFn } = await import('@/server/production.server')
      return renderProductionFn({ data: { projectId, stage } })
    },
    onSuccess: (state) => {
      setState(state)
      toast.success(state.message)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const review = useMutation({
    mutationFn: async (input: {
      shotId: string
      action: 'keep' | 'promote' | 'clear' | 'retry' | 'retryFinal'
    }) => {
      const { reviewShotFn } = await import('@/server/production.server')
      return reviewShotFn({ data: { projectId, ...input } })
    },
    onSuccess: setState,
    onError: (err: Error) => toast.error(err.message),
  })

  const updatePlan = useMutation({
    mutationFn: async (input: {
      title?: string
      shots: Array<ShotEdit>
      final?: FinalChoice
    }) => {
      const { updatePlanFn } = await import('@/server/production.server')
      return updatePlanFn({ data: { projectId, ...input } })
    },
    onSuccess: (state) => {
      setState(state)
      toast.success('Plan updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const setBudget = useMutation({
    mutationFn: async (budgetUsd: number) => {
      const { setBudgetFn } = await import('@/server/production.server')
      return setBudgetFn({ data: { projectId, budgetUsd } })
    },
    onSuccess: ({ budgetUsd }) => {
      queryClient.setQueryData<ProductionState>(key, (prev) =>
        prev ? { ...prev, budgetUsd } : prev,
      )
      // a raised budget can lift a stop — let the runner look again
      void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return {
    projectId,
    plan: query.data?.plan ?? null,
    budgetUsd: query.data?.budgetUsd ?? 10,
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: key }),
    render,
    review,
    updatePlan,
    setBudget,
  }
}

function countDone(state: ProductionState | undefined): number {
  const plan = state?.plan
  if (!plan) return 0
  let n = 0
  for (const s of plan.shots) {
    for (const step of [s.still, s.draft, s.final]) {
      if (step?.status === 'done') n++
    }
  }
  if (plan.music?.step?.status === 'done') n++
  if (plan.voiceover?.step?.status === 'done') n++
  return n
}
