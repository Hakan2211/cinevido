import type { useProduction } from './useProduction'

/** Everything the Director views need: the plan plus its actions */
export type Production = ReturnType<typeof useProduction>
