/**
 * Timeline internals shared by the editor's parts — the sequence's geometry,
 * the per-kind palette every lane/clip/header reads from, snapping, and the
 * tick plan the ruler draws at the current zoom.
 *
 * The sequence is measured in FRAMES (the manifest's unit); zoom is authored
 * in PIXELS PER SECOND so the same zoom feels the same at 24 or 30 fps.
 */

import type {
  ManifestClip,
  ManifestTrack,
  TrackKind,
} from '../../../remotion/types'

// =============================================================================
// Geometry — one place, so headers/lanes/playhead cannot drift
// =============================================================================

export const RULER_H = 28
export const TRACK_H = 64
export const HEADER_W = 176
/** height of a clip inside its lane (the rest is breathing room) */
export const CLIP_H = TRACK_H - 14
/** how close to a clip edge counts as "grab the edge to trim" */
export const TRIM_HANDLE_PX = 8

/** zoom range, in pixels per second of sequence */
export const ZOOM_MIN = 8
export const ZOOM_MAX = 400
export const ZOOM_DEFAULT = 48

export const clampZoom = (z: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))

/** how far (in px) a magnet snap reaches */
export const SNAP_PX = 8

// =============================================================================
// Palette — one per track kind: the header chip, the lane tint, the clip edge
// =============================================================================

export interface KindStyle {
  code: string
  label: string
  accent: string
  wave: string
  tint: string
}

export const KIND: Record<TrackKind, KindStyle> = {
  video: {
    code: 'V',
    label: 'Video',
    accent: '#c9a96e',
    wave: 'rgba(201,169,110,0.8)',
    tint: 'rgba(201,169,110,0.06)',
  },
  component: {
    code: 'T',
    label: 'Overlays',
    accent: '#e0995e',
    wave: 'rgba(224,153,94,0.75)',
    tint: 'rgba(224,153,94,0.06)',
  },
  voice: {
    code: 'A',
    label: 'Voice',
    accent: '#8fb4d8',
    wave: 'rgba(143,180,216,0.85)',
    tint: 'rgba(143,180,216,0.06)',
  },
  music: {
    code: 'M',
    label: 'Music',
    accent: '#7fbf9a',
    wave: 'rgba(127,191,154,0.85)',
    tint: 'rgba(127,191,154,0.06)',
  },
  sfx: {
    code: 'S',
    label: 'SFX',
    accent: '#a99bee',
    wave: 'rgba(169,155,238,0.8)',
    tint: 'rgba(169,155,238,0.06)',
  },
}

// =============================================================================
// Level — the mixer talks in decibels, the manifest stores a multiplier
// =============================================================================

/**
 * Gain is stored as a plain multiplier (1 = unity) because that is what the
 * renderer multiplies by, but nobody mixes in multipliers. These convert for
 * display only; the manifest never sees a dB value.
 *
 * The ceiling is +12 dB (a multiplier of ~3.98) — enough to rescue a quiet
 * source, and the same top of scale the fader draws.
 */
export const GAIN_MAX = 4
export const GAIN_MAX_DB = 12

export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain)
}

export function dbToGain(db: number): number {
  return db === -Infinity ? 0 : Math.pow(10, db / 20)
}

/** "+2.0 dB" / "-6.5 dB" / "0.0 dB" / "-inf" — always signed, always 1 decimal */
export function formatGainDb(gain: number): string {
  const db = gainToDb(gain)
  if (db === -Infinity) return '-∞'
  const rounded = Math.abs(db) < 0.05 ? 0 : db
  // unity reads "0.0 dB", not "+0.0 dB" — the sign is for departures from it
  if (rounded === 0) return '0.0 dB'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} dB`
}

// =============================================================================
// Snapping
// =============================================================================

/** every edit quantises to a whole frame, and never goes negative */
export const snapFrame = (frame: number) => Math.max(0, Math.round(frame))

/**
 * Magnet: pull `frame` onto the nearest interesting edge within SNAP_PX.
 * Candidates are the other clips' edges on any lane, the playhead and zero —
 * the things an editor actually wants to butt a cut against.
 */
export function snapToEdges(
  frame: number,
  candidates: Array<number>,
  pxPerFrame: number,
): number {
  const reach = SNAP_PX / Math.max(pxPerFrame, 0.0001)
  let best = frame
  let bestDist = reach
  for (const candidate of candidates) {
    const dist = Math.abs(candidate - frame)
    if (dist <= bestDist) {
      best = candidate
      bestDist = dist
    }
  }
  return snapFrame(best)
}

/** every clip edge in the sequence except the clip being dragged */
export function snapCandidates(
  tracks: Array<ManifestTrack>,
  exceptClipId: string | null,
  playhead: number,
): Array<number> {
  const out: Array<number> = [0, playhead]
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === exceptClipId) continue
      out.push(clip.startFrame, clip.startFrame + clip.durationFrames)
    }
  }
  return out
}

// =============================================================================
// The ruler's tick plan
// =============================================================================

/** ladder of tick intervals, in seconds */
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]

/** the smallest interval whose ticks are at least 64px apart at this zoom */
export function tickStepSeconds(pxPerSec: number): number {
  for (const step of STEPS) {
    if (step * pxPerSec >= 64) return step
  }
  return STEPS[STEPS.length - 1]
}

export function rulerLabel(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// =============================================================================
// Sequence queries the editor needs but the manifest module should not own
// =============================================================================

/** the cut points on a track, sorted — where "step to next cut" lands */
export function cutPoints(tracks: Array<ManifestTrack>): Array<number> {
  const points = new Set<number>([0])
  for (const track of tracks) {
    for (const clip of track.clips) {
      points.add(clip.startFrame)
      points.add(clip.startFrame + clip.durationFrames)
    }
  }
  return [...points].sort((a, b) => a - b)
}

/** the clip under a frame on a given lane, if any */
export function clipAt(
  track: ManifestTrack,
  frame: number,
): ManifestClip | undefined {
  return track.clips.find(
    (c) => frame >= c.startFrame && frame < c.startFrame + c.durationFrames,
  )
}

// =============================================================================
// Media probing
// =============================================================================

const durationCache = new Map<string, Promise<number>>()

/**
 * How long a piece of media runs, in seconds. Images have no duration of their
 * own, so they get the still's default 4s — the same number the media rail
 * shows, so a clip never changes length just by being added.
 */
export function probeDurationSeconds(
  url: string | undefined,
  kind: string,
): Promise<number> {
  if (!url || kind === 'image') return Promise.resolve(4)
  const cached = durationCache.get(url)
  if (cached) return cached

  const probe = new Promise<number>((resolve) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio')
    let settled = false
    const done = (d: number) => {
      if (settled) return
      settled = true
      el.src = ''
      resolve(Number.isFinite(d) && d > 0 ? d : 5)
    }
    el.preload = 'metadata'
    el.crossOrigin = 'anonymous'
    el.onloadedmetadata = () => done(el.duration)
    el.onerror = () => done(5)
    // never hang a drop on a CDN that will not answer
    setTimeout(() => done(5), 8000)
    el.src = url
  })

  durationCache.set(url, probe)
  return probe
}
