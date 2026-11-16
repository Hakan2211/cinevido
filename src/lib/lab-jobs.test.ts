import { describe, expect, it } from 'vitest'
import {
  labJobCostLabel,
  labJobKind,
  normaliseStatus,
  toLabJob,
} from './lab-jobs'
import type { JobRow } from './lab-jobs'

const row = (over: Partial<JobRow> = {}): JobRow => ({
  id: 'j1',
  type: 'image',
  model: 'fal-ai/some-model',
  status: 'pending',
  progress: 0,
  createdAt: new Date('2026-11-16T10:00:00Z'),
  input: JSON.stringify({ prompt: 'a red fox', numImages: 2 }),
  estimatedCostUsd: 0.08,
  projectId: null,
  ...over,
})

describe('labJobKind', () => {
  it('maps job types to lab jobs', () => {
    expect(labJobKind('image', {})).toBe('image')
    expect(labJobKind('edit', {})).toBe('edit')
    expect(labJobKind('upscale', {})).toBe('upscale')
    expect(labJobKind('layerize', {})).toBe('layers')
    expect(labJobKind('video', {})).toBe('video')
    expect(labJobKind('video', { generationType: 'motion-control' })).toBe(
      'motion',
    )
    expect(labJobKind('video-upscale', {})).toBe('video-upscale')
  })

  it('leaves layer edits and non-lab types alone', () => {
    expect(labJobKind('edit', { purpose: 'layer' })).toBeNull()
    expect(labJobKind('music', {})).toBeNull()
    expect(labJobKind('audio', {})).toBeNull()
    expect(labJobKind('render', {})).toBeNull()
  })
})

describe('toLabJob', () => {
  it('reads prompt, batch size and cost', () => {
    expect(toLabJob(row())).toEqual({
      id: 'j1',
      kind: 'image',
      model: 'fal-ai/some-model',
      status: 'pending',
      progress: 0,
      createdAt: '2026-11-16T10:00:00.000Z',
      prompt: 'a red fox',
      count: 2,
      sourceAssetId: null,
      costUsd: 0.08,
    })
  })

  it('skips Director jobs and finished jobs', () => {
    expect(toLabJob(row({ projectId: 'p1' }))).toBeNull()
    expect(toLabJob(row({ status: 'completed' }))).toBeNull()
    expect(toLabJob(row({ status: 'failed' }))).toBeNull()
  })

  it('takes the source of an edit or upscale', () => {
    const edit = toLabJob(
      row({
        type: 'edit',
        input: JSON.stringify({ prompt: 'x', sourceAssetIds: ['a1', 'a2'] }),
      }),
    )
    expect(edit?.sourceAssetId).toBe('a1')
    expect(edit?.count).toBe(1)
    const upscale = toLabJob(
      row({ type: 'upscale', input: JSON.stringify({ sourceAssetId: 'a3' }) }),
    )
    expect(upscale?.sourceAssetId).toBe('a3')
    expect(upscale?.prompt).toBeNull()
  })

  it('survives broken input JSON', () => {
    expect(toLabJob(row({ input: 'not json' }))?.count).toBe(1)
  })
})

describe('labJobCostLabel', () => {
  it('prices one card of a batch, and Layerize at its ceiling', () => {
    const job = toLabJob(row())!
    expect(labJobCostLabel(job)).toBe('≈ $0.04')
    expect(labJobCostLabel({ ...job, kind: 'layers', count: 1 })).toBe(
      '≤ $0.08',
    )
    expect(labJobCostLabel({ ...job, costUsd: null })).toBeNull()
  })
})

describe('normaliseStatus', () => {
  it('reads every status function shape', () => {
    // image / edit / video
    expect(
      normaliseStatus({
        status: 'completed',
        progress: 100,
        output: { url: 'u', assetId: 'a' },
      }),
    ).toMatchObject({ status: 'completed', assetId: 'a', url: 'u' })
    // layerize
    expect(
      normaliseStatus({ status: 'completed', assetId: 'set', error: null }),
    ).toMatchObject({ status: 'completed', assetId: 'set' })
    // in flight, with a queue position
    expect(
      normaliseStatus({ status: 'pending', progress: 10, queuePosition: 4 }),
    ).toMatchObject({ status: 'pending', progress: 10, queuePosition: 4 })
    // failed
    expect(
      normaliseStatus({ status: 'failed', error: 'boom' }),
    ).toMatchObject({ status: 'failed', error: 'boom' })
    // anything unexpected counts as still pending
    expect(normaliseStatus(undefined).status).toBe('pending')
  })
})
