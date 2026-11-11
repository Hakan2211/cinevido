/**
 * The Studio's view of the Project Bible: read it, save it, generate a
 * reference portrait for an entry, and poll while one is generating.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ProjectBible } from '@/lib/bible'
import type { BibleInput } from '@/lib/bible'

const POLL_MS = 4000

export const bibleKey = (projectId: string) => ['bible', projectId]

const generating = (bible: ProjectBible | undefined) =>
  !!bible?.entries.some((e) => e.pending?.status === 'running')

/** Client-side input for a save: the Bible minus server-owned fields */
export function bibleToInput(bible: ProjectBible): BibleInput {
  return {
    style: bible.style,
    voice: bible.voice,
    entries: bible.entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      assetId: e.assetId,
    })),
  }
}

export function useBible(
  projectId: string,
  opts: { onAssetsChanged?: () => void } = {},
) {
  const queryClient = useQueryClient()
  const key = bibleKey(projectId)

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<ProjectBible> => {
      const prev = queryClient.getQueryData<ProjectBible>(key)
      if (generating(prev)) {
        const { pollBibleFn } = await import('@/server/bible.server')
        const { bible } = await pollBibleFn({ data: { projectId } })
        // a reference landed: it is a new image in the library too
        const before = prev!.entries.filter(
          (e) => e.pending?.status === 'running',
        ).length
        const after = bible.entries.filter(
          (e) => e.pending?.status === 'running',
        ).length
        if (after < before) opts.onAssetsChanged?.()
        return bible
      }
      const { getBibleFn } = await import('@/server/bible.server')
      return (await getBibleFn({ data: { projectId } })).bible
    },
    refetchInterval: (q) => (generating(q.state.data) ? POLL_MS : false),
    refetchIntervalInBackground: true,
  })

  const save = useMutation({
    mutationFn: async (input: BibleInput) => {
      const { saveBibleFn } = await import('@/server/bible.server')
      return saveBibleFn({ data: { projectId, ...input } })
    },
    onSuccess: ({ bible }) => queryClient.setQueryData(key, bible),
    onError: (err: Error) => toast.error(err.message),
  })

  const generate = useMutation({
    mutationFn: async (entryId: string) => {
      const { generateReferenceFn } = await import('@/server/bible.server')
      return generateReferenceFn({ data: { projectId, entryId } })
    },
    onSuccess: ({ bible }) => queryClient.setQueryData(key, bible),
    onError: (err: Error) => toast.error(err.message),
  })

  /** Set one entry's reference image (from the library or a shot's still) */
  const setReference = (
    entryId: string,
    image: { url: string; assetId?: string },
  ) => {
    const bible = query.data
    if (!bible) return
    const next: ProjectBible = {
      ...bible,
      entries: bible.entries.map((e) =>
        e.id === entryId
          ? { ...e, imageUrl: image.url, assetId: image.assetId }
          : e,
      ),
    }
    save.mutate(bibleToInput(next), {
      onSuccess: () => {
        const name = bible.entries.find((e) => e.id === entryId)?.name
        toast.success(`Reference set for ${name ?? 'the entry'}`)
      },
    })
  }

  return {
    bible: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    save,
    generate,
    setReference,
  }
}

export type BibleState = ReturnType<typeof useBible>
