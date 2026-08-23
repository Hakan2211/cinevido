import { describe, expect, it } from 'vitest'
import {
  addClip,
  createEmptyManifest,
  migrateManifest,
  removeClip,
  sequenceEndFrame,
  splitClipAt,
  updateClip,
} from './types'

/** a manifest as projects stored it before v2 */
const V1 = {
  version: 1,
  tracks: {
    video: [
      {
        id: 'v1',
        assetId: 'a1',
        url: 'https://cdn/one.mp4',
        startFrame: 0,
        durationFrames: 90,
        layer: 0,
      },
      {
        id: 'v2',
        assetId: 'a2',
        url: 'https://cdn/two.mp4',
        startFrame: 90,
        durationFrames: 60,
        layer: 1,
      },
    ],
    audio: [
      {
        id: 'a-1',
        assetId: 'a3',
        url: 'https://cdn/vo.mp3',
        startFrame: 10,
        durationFrames: 120,
        volume: 0.8,
      },
    ],
    components: [
      {
        id: 't-1',
        component: 'BigTitle',
        props: { text: 'Hello' },
        startFrame: 0,
        durationFrames: 45,
        layer: 10,
      },
    ],
  },
  globalSettings: { backgroundColor: '#101010' },
}

describe('migrateManifest', () => {
  it('keeps every v1 clip, on a lane of the right kind', () => {
    const m = migrateManifest(V1)

    expect(m.version).toBe(2)
    const clips = m.tracks.flatMap((t) => t.clips)
    expect(clips).toHaveLength(4)

    const videoLanes = m.tracks.filter((t) => t.kind === 'video')
    // the two layers become two lanes, so compositing order survives
    expect(videoLanes).toHaveLength(2)
    expect(videoLanes[0].clips[0].id).toBe('v1')
    expect(videoLanes[1].clips[0].id).toBe('v2')

    const voice = m.tracks.find((t) => t.kind === 'voice')
    expect(voice?.clips[0].id).toBe('a-1')
    // v1's `volume` becomes the clip's gain
    expect(voice?.clips[0].gain).toBe(0.8)

    const overlay = m.tracks.find((t) => t.kind === 'component')
    expect(overlay?.clips[0].component).toBe('BigTitle')
    expect(overlay?.clips[0].props).toEqual({ text: 'Hello' })

    expect(m.globalSettings.backgroundColor).toBe('#101010')
  })

  it('gives every document the base lanes, including Music', () => {
    const m = migrateManifest(V1)
    expect(m.tracks.map((t) => t.kind)).toContain('music')
  })

  it('reads a JSON string, and survives junk', () => {
    expect(migrateManifest(JSON.stringify(V1)).tracks.length).toBeGreaterThan(0)
    expect(migrateManifest('not json').tracks).toHaveLength(4)
    expect(migrateManifest({}).tracks).toHaveLength(4)
    expect(migrateManifest(null).tracks).toHaveLength(4)
  })

  it('is idempotent — migrating a v2 document changes nothing that matters', () => {
    const once = migrateManifest(V1)
    const twice = migrateManifest(once)
    expect(twice.tracks.map((t) => t.clips.map((c) => c.id))).toEqual(
      once.tracks.map((t) => t.clips.map((c) => c.id)),
    )
  })
})

describe('editing', () => {
  const seed = () =>
    addClip(createEmptyManifest(), 'video', {
      id: 'c1',
      kind: 'video',
      url: 'https://cdn/one.mp4',
      label: 'one',
      startFrame: 0,
      durationFrames: 100,
      sourceInFrame: 0,
      transitionFrames: 0,
      gain: 1,
    }).manifest

  it('splits a clip so the tail keeps playing where the head stopped', () => {
    const { manifest, tailId } = splitClipAt(seed(), 'c1', 40)
    const clips = manifest.tracks.flatMap((t) => t.clips)

    expect(clips).toHaveLength(2)
    const head = clips.find((c) => c.id === 'c1')!
    const tail = clips.find((c) => c.id === tailId)!
    expect(head.durationFrames).toBe(40)
    expect(tail.startFrame).toBe(40)
    expect(tail.durationFrames).toBe(60)
    expect(tail.sourceInFrame).toBe(40)
  })

  it('refuses to split on a clip boundary', () => {
    const start = splitClipAt(seed(), 'c1', 0)
    expect(start.tailId).toBeUndefined()
    expect(start.manifest.tracks.flatMap((t) => t.clips)).toHaveLength(1)

    const end = splitClipAt(seed(), 'c1', 100)
    expect(end.tailId).toBeUndefined()
    expect(end.manifest.tracks.flatMap((t) => t.clips)).toHaveLength(1)
  })

  it('updates and removes clips', () => {
    const trimmed = updateClip(seed(), 'c1', { durationFrames: 25 })
    expect(sequenceEndFrame(trimmed)).toBe(25)
    expect(sequenceEndFrame(removeClip(trimmed, 'c1'))).toBe(0)
  })

  it('creates the next lane of a kind when asked for one past the end', () => {
    const m = addClip(
      seed(),
      'video',
      {
        id: 'c2',
        kind: 'video',
        url: 'https://cdn/two.mp4',
        label: 'two',
        startFrame: 0,
        durationFrames: 50,
        sourceInFrame: 0,
        transitionFrames: 0,
        gain: 1,
      },
      1,
    ).manifest
    expect(m.tracks.filter((t) => t.kind === 'video')).toHaveLength(2)
  })
})
