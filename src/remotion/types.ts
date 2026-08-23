/**
 * Remotion Types — Project Manifest v2
 *
 * The manifest is the DNA of a project: the sequence the Player previews and
 * the renderer renders. v2 replaces v1's three fixed buckets (video/audio/
 * components) with an ordered array of TRACKS, the way an NLE models a cut:
 *
 *   - a track has a kind (video | component | voice | music | sfx), a name,
 *     mute and gain — the mixer lives on the track head, so a sequence with no
 *     Music lane has nowhere to put a score and no way to say so
 *   - a clip carries its own trim into the source (sourceInFrame), the
 *     crossfade it fades in with (transitionFrames) and its own gain
 *
 * Times are FRAMES at the project's fps — Remotion counts in frames, so the
 * editor does too, and only the timecode formatter knows about seconds.
 *
 * Documents written as v1 are migrated on read by `migrateManifest`; nothing
 * else in the app is allowed to read a raw manifest.
 */

// =============================================================================
// Composition Props
// =============================================================================

export interface CompositionProps {
  manifest?: ProjectManifest
}

// =============================================================================
// Manifest v2
// =============================================================================

export const MANIFEST_VERSION = 2

/** Lanes, in the order they stack: later video/component tracks composite on top. */
export type TrackKind = 'video' | 'component' | 'voice' | 'music' | 'sfx'

/** What a clip actually plays. Mirrors (but is not identical to) its track kind. */
export type ClipKind = 'video' | 'image' | 'audio' | 'component'

export interface ManifestClip {
  id: string
  kind: ClipKind
  /** Asset row this clip points at (absent for component overlays) */
  assetId?: string
  /** Media URL (Bunny CDN); absent for component overlays */
  url?: string
  /** What the clip is called on the lane */
  label: string
  /** Where the clip starts on the timeline */
  startFrame: number
  /** How long the clip runs on the timeline */
  durationFrames: number
  /** Trim into the source media — frame 0 of the clip is `sourceInFrame` */
  sourceInFrame: number
  /** Crossfade INTO this clip from the previous clip on the same track */
  transitionFrames: number
  /** Clip volume multiplier, 0..2 (1 = unity) for anything carrying audio */
  gain: number
  /** Legacy outgoing transition style (video clips) */
  transition?: TransitionType
  effects?: Array<ClipEffectProps>
  /** Voice takes carry their word timings for karaoke overlays */
  wordTimestamps?: Array<WordTimestampProps>
  /** Component overlays only */
  component?: ComponentType

  props?: Record<string, any>
}

export interface ManifestTrack {
  id: string
  kind: TrackKind
  name: string
  muted: boolean
  /** Track volume, 0..2 (1 = unity) — applied in the preview and the render */
  gain: number
  locked: boolean
  clips: Array<ManifestClip>
}

export interface ProjectManifest {
  version: number
  tracks: Array<ManifestTrack>
  globalSettings: {
    backgroundColor: string
  }
}

/** Every sequence keeps a lane per base kind, even an empty one. */
export const BASE_TRACKS: Array<{ kind: TrackKind; name: string }> = [
  { kind: 'video', name: 'Video' },
  { kind: 'component', name: 'Overlays' },
  { kind: 'voice', name: 'Voice' },
  { kind: 'music', name: 'Music' },
]

const KIND_RANK: Record<TrackKind, number> = {
  video: 0,
  component: 1,
  voice: 2,
  music: 3,
  sfx: 4,
}

// =============================================================================
// Legacy (v1) shapes — kept so old documents can be migrated
// =============================================================================

export interface VideoClipProps {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  layer: number
  transition?: TransitionType
  effects?: Array<ClipEffectProps>
}

export interface AudioClipProps {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  volume: number
  wordTimestamps?: Array<WordTimestampProps>
}

export interface ComponentOverlayProps {
  id: string
  component: ComponentType

  props: Record<string, any>
  startFrame: number
  durationFrames: number
  layer: number
}

export interface LegacyProjectManifest {
  version: number
  tracks: {
    video: Array<VideoClipProps>
    audio: Array<AudioClipProps>
    components: Array<ComponentOverlayProps>
  }
  globalSettings: {
    backgroundColor: string
  }
}

export interface WordTimestampProps {
  word: string
  start: number
  end: number
}

export interface ClipEffectProps {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale'
  value: number
}

// =============================================================================
// Component Types
// =============================================================================

export type ComponentType =
  | 'KaraokeText'
  | 'BigTitle'
  | 'ImageOverlay'
  | 'LowerThird'

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'glitch'
  | 'zoom'

// =============================================================================
// Overlay Component Props
// =============================================================================

export interface KaraokeTextProps {
  text: string
  wordTimestamps: Array<WordTimestampProps>
  fontSize?: number
  fontFamily?: string
  color?: string
  highlightColor?: string
  backgroundColor?: string
  position?: 'top' | 'center' | 'bottom'
}

export interface BigTitleProps {
  text: string
  fontSize?: number
  fontFamily?: string
  color?: string
  animation?: 'fade' | 'slide-up' | 'scale' | 'typewriter'
  position?: 'top' | 'center' | 'bottom'
}

export interface ImageOverlayProps {
  src: string
  width?: number
  height?: number
  x?: number
  y?: number
  opacity?: number
}

export interface LowerThirdProps {
  title: string
  subtitle?: string
  backgroundColor?: string
  textColor?: string
  position?: 'left' | 'center' | 'right'
}

// =============================================================================
// Player State
// =============================================================================

export interface PlayerState {
  isPlaying: boolean
  currentFrame: number
  durationFrames: number
  fps: number
}

export interface TimelineSelection {
  clipId: string | null
  trackId: string | null
}

// =============================================================================
// Ids
// =============================================================================

export function newId(prefix = 'c'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

// =============================================================================
// Construction
// =============================================================================

export function createTrack(
  kind: TrackKind,
  name: string,
  clips: Array<ManifestClip> = [],
): ManifestTrack {
  return {
    id: newId('t'),
    kind,
    name,
    muted: false,
    gain: 1,
    locked: false,
    clips,
  }
}

export function createEmptyManifest(): ProjectManifest {
  return {
    version: MANIFEST_VERSION,
    tracks: BASE_TRACKS.map((t) => createTrack(t.kind, t.name)),
    globalSettings: {
      backgroundColor: '#000000',
    },
  }
}

/**
 * Restore any base lane the document is missing and keep lanes grouped by kind
 * (a document saved before a kind existed gets it back instead of staying
 * short forever). Extra lanes of a kind keep their own relative order.
 */
export function withBaseLanes(
  tracks: Array<ManifestTrack>,
): Array<ManifestTrack> {
  const out = [...tracks]
  for (const base of BASE_TRACKS) {
    if (out.some((t) => t.kind === base.kind)) continue
    out.push(createTrack(base.kind, base.name))
  }
  return out
    .map((track, i) => ({ track, i }))
    .sort(
      (a, b) => KIND_RANK[a.track.kind] - KIND_RANK[b.track.kind] || a.i - b.i,
    )
    .map(({ track }) => track)
}

// =============================================================================
// Migration — every read of a stored manifest goes through here
// =============================================================================

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeClip(raw: any): ManifestClip | null {
  if (!raw || typeof raw !== 'object') return null
  const kind: ClipKind = raw.component
    ? 'component'
    : raw.kind === 'image' || raw.kind === 'audio' || raw.kind === 'video'
      ? raw.kind
      : 'video'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    kind,
    assetId: typeof raw.assetId === 'string' ? raw.assetId : undefined,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    label: typeof raw.label === 'string' ? raw.label : '',
    startFrame: Math.max(0, Math.round(num(raw.startFrame, 0))),
    durationFrames: Math.max(1, Math.round(num(raw.durationFrames, 1))),
    sourceInFrame: Math.max(0, Math.round(num(raw.sourceInFrame, 0))),
    transitionFrames: Math.max(0, Math.round(num(raw.transitionFrames, 0))),
    gain: Math.min(2, Math.max(0, num(raw.gain, num(raw.volume, 1)))),
    transition: raw.transition,
    effects: Array.isArray(raw.effects) ? raw.effects : undefined,
    wordTimestamps: Array.isArray(raw.wordTimestamps)
      ? raw.wordTimestamps
      : undefined,
    component: raw.component,
    props: raw.props && typeof raw.props === 'object' ? raw.props : undefined,
  }
}

function normalizeTrack(raw: any): ManifestTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const kind: TrackKind =
    KIND_RANK[raw.kind as TrackKind] !== undefined ? raw.kind : 'video'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('t'),
    kind,
    name: typeof raw.name === 'string' && raw.name ? raw.name : kind,
    muted: raw.muted === true,
    gain: Math.min(2, Math.max(0, num(raw.gain, 1))),
    locked: raw.locked === true,
    clips: (Array.isArray(raw.clips) ? raw.clips : [])
      .map(normalizeClip)
      .filter((c: ManifestClip | null): c is ManifestClip => c !== null)
      .sort((a: ManifestClip, b: ManifestClip) => a.startFrame - b.startFrame),
  }
}

/**
 * v1 → v2. Clips are grouped into one lane per distinct `layer` so the
 * compositing order the old manifest expressed with numbers survives as lane
 * order (later lanes composite on top).
 */
function migrateV1(raw: any): ProjectManifest {
  const video: Array<VideoClipProps> = Array.isArray(raw?.tracks?.video)
    ? raw.tracks.video
    : []
  const audio: Array<AudioClipProps> = Array.isArray(raw?.tracks?.audio)
    ? raw.tracks.audio
    : []
  const components: Array<ComponentOverlayProps> = Array.isArray(
    raw?.tracks?.components,
  )
    ? raw.tracks.components
    : []

  const byLayer = <T extends { layer?: number }>(clips: Array<T>) => {
    const layers = [...new Set(clips.map((c) => num(c.layer, 0)))].sort(
      (a, b) => a - b,
    )
    return layers.map((layer) => clips.filter((c) => num(c.layer, 0) === layer))
  }

  const tracks: Array<ManifestTrack> = []

  byLayer(video).forEach((clips, i) => {
    tracks.push(
      createTrack(
        'video',
        i === 0 ? 'Video' : `Video ${i + 1}`,
        clips
          .map((c) => normalizeClip({ ...c, kind: 'video' }))
          .filter((c): c is ManifestClip => c !== null),
      ),
    )
  })

  byLayer(components).forEach((clips, i) => {
    tracks.push(
      createTrack(
        'component',
        i === 0 ? 'Overlays' : `Overlays ${i + 1}`,
        clips
          .map((c) => normalizeClip({ ...c, kind: 'component' }))
          .filter((c): c is ManifestClip => c !== null),
      ),
    )
  })

  if (audio.length > 0) {
    tracks.push(
      createTrack(
        'voice',
        'Voice',
        audio
          .map((c) => normalizeClip({ ...c, kind: 'audio' }))
          .filter((c): c is ManifestClip => c !== null),
      ),
    )
  }

  return {
    version: MANIFEST_VERSION,
    tracks: withBaseLanes(tracks),
    globalSettings: {
      backgroundColor:
        typeof raw?.globalSettings?.backgroundColor === 'string'
          ? raw.globalSettings.backgroundColor
          : '#000000',
    },
  }
}

/**
 * Read any stored manifest — v2, v1, `{}` or junk — as a valid v2 document.
 * Never throws: a project whose manifest cannot be parsed opens empty rather
 * than breaking the studio.
 */
export function migrateManifest(raw: unknown): ProjectManifest {
  let value: any = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return createEmptyManifest()
    }
  }
  if (!value || typeof value !== 'object') return createEmptyManifest()

  // v1: `tracks` is an object of buckets rather than an array of lanes
  if (value.tracks && !Array.isArray(value.tracks)) return migrateV1(value)
  if (!Array.isArray(value.tracks)) return createEmptyManifest()

  return {
    version: MANIFEST_VERSION,
    tracks: withBaseLanes(
      value.tracks
        .map(normalizeTrack)
        .filter((t: ManifestTrack | null): t is ManifestTrack => t !== null),
    ),
    globalSettings: {
      backgroundColor:
        typeof value.globalSettings?.backgroundColor === 'string'
          ? value.globalSettings.backgroundColor
          : '#000000',
    },
  }
}

// =============================================================================
// Reading a sequence
// =============================================================================

export function trackEndFrame(track: ManifestTrack): number {
  return track.clips.reduce(
    (max, c) => Math.max(max, c.startFrame + c.durationFrames),
    0,
  )
}

export function sequenceEndFrame(manifest: ProjectManifest): number {
  return manifest.tracks.reduce((max, t) => Math.max(max, trackEndFrame(t)), 0)
}

export function clipCount(manifest: ProjectManifest): number {
  return manifest.tracks.reduce((n, t) => n + t.clips.length, 0)
}

export function allClips(
  manifest: ProjectManifest,
): Array<{ track: ManifestTrack; clip: ManifestClip }> {
  return manifest.tracks.flatMap((track) =>
    track.clips.map((clip) => ({ track, clip })),
  )
}

export function tracksOfKind(
  manifest: ProjectManifest,
  kind: TrackKind,
): Array<ManifestTrack> {
  return manifest.tracks.filter((t) => t.kind === kind)
}

export function findClip(
  manifest: ProjectManifest,
  clipId: string,
): { track: ManifestTrack; clip: ManifestClip } | undefined {
  for (const track of manifest.tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (clip) return { track, clip }
  }
  return undefined
}

export const TRACK_CODE: Record<TrackKind, string> = {
  video: 'V',
  component: 'T',
  voice: 'A',
  music: 'M',
  sfx: 'S',
}

/** V1 / A2 / M1 — the lane's NLE short code, counted within its own kind */
export function trackCode(manifest: ProjectManifest, index: number): string {
  const track = manifest.tracks[index]
  if (!track) return ''
  const nth =
    manifest.tracks.slice(0, index).filter((t) => t.kind === track.kind)
      .length + 1
  return `${TRACK_CODE[track.kind]}${nth}`
}

/** Which lane an asset lands on when it is dropped into the cut */
export function trackKindForAsset(assetType: string): TrackKind {
  switch (assetType) {
    case 'audio':
      return 'voice'
    case 'music':
      return 'music'
    case 'sfx':
      return 'sfx'
    default:
      return 'video'
  }
}

export function clipKindForAsset(assetType: string): ClipKind {
  switch (assetType) {
    case 'audio':
    case 'music':
    case 'sfx':
      return 'audio'
    case 'image':
      return 'image'
    default:
      return 'video'
  }
}

/** Does this clip carry sound the mixer should touch? */
export function clipHasAudio(clip: ManifestClip): boolean {
  return clip.kind === 'audio' || clip.kind === 'video'
}

// =============================================================================
// Editing a sequence — pure, always returning a new manifest
// =============================================================================

export function mapTrack(
  manifest: ProjectManifest,
  trackId: string,
  fn: (track: ManifestTrack) => ManifestTrack,
): ProjectManifest {
  return {
    ...manifest,
    tracks: manifest.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
  }
}

export function updateClip(
  manifest: ProjectManifest,
  clipId: string,
  patch: Partial<ManifestClip>,
): ProjectManifest {
  return {
    ...manifest,
    tracks: manifest.tracks.map((track) =>
      track.clips.some((c) => c.id === clipId)
        ? {
            ...track,
            clips: track.clips.map((c) =>
              c.id === clipId ? { ...c, ...patch } : c,
            ),
          }
        : track,
    ),
  }
}

export function removeClip(
  manifest: ProjectManifest,
  clipId: string,
): ProjectManifest {
  return {
    ...manifest,
    tracks: manifest.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== clipId),
    })),
  }
}

/**
 * Place a clip on the nth lane of a kind, creating the lane when the index is
 * one past the end. Returns the new manifest and the clip that was placed.
 */
export function addClip(
  manifest: ProjectManifest,
  kind: TrackKind,
  clip: Omit<ManifestClip, 'id'> & { id?: string },
  trackIndex = 0,
): { manifest: ProjectManifest; clip: ManifestClip; trackId: string } {
  const placed: ManifestClip = {
    ...clip,
    id: clip.id ?? newId(),
    label: clip.label ?? '',
    sourceInFrame: clip.sourceInFrame ?? 0,
    transitionFrames: clip.transitionFrames ?? 0,
    gain: clip.gain ?? 1,
  }

  const kindTracks = manifest.tracks.filter((t) => t.kind === kind)
  const wanted = Math.min(Math.max(0, trackIndex), kindTracks.length)
  let track = kindTracks[wanted]
  let tracks = manifest.tracks

  if (!track) {
    const base = BASE_TRACKS.find((b) => b.kind === kind)?.name ?? kind
    track = createTrack(
      kind,
      kindTracks.length === 0 ? base : `${base} ${kindTracks.length + 1}`,
    )
    // keep lanes of a kind grouped; later lanes composite on top
    const last = tracks.reduce((m, t, i) => (t.kind === kind ? i : m), -1)
    tracks = [...tracks]
    tracks.splice(last === -1 ? tracks.length : last + 1, 0, track)
  }

  const target = track
  return {
    manifest: {
      ...manifest,
      tracks: tracks.map((t) =>
        t.id === target.id
          ? {
              ...t,
              clips: [...t.clips, placed].sort(
                (a, b) => a.startFrame - b.startFrame,
              ),
            }
          : t,
      ),
    },
    clip: placed,
    trackId: target.id,
  }
}

/** Append to the end of a lane — what "add to timeline" means by default */
export function appendClip(
  manifest: ProjectManifest,
  kind: TrackKind,
  clip: Omit<ManifestClip, 'id' | 'startFrame'> & {
    id?: string
    startFrame?: number
  },
  trackIndex = 0,
): { manifest: ProjectManifest; clip: ManifestClip; trackId: string } {
  const kindTracks = manifest.tracks.filter((t) => t.kind === kind)
  const track = kindTracks[Math.min(trackIndex, kindTracks.length - 1)]
  const startFrame = clip.startFrame ?? (track ? trackEndFrame(track) : 0)
  return addClip(manifest, kind, { ...clip, startFrame }, trackIndex)
}

/**
 * Razor: split a clip at an absolute timeline frame. The tail keeps playing
 * the source where the head stopped, which is the whole point of a cut.
 */
export function splitClipAt(
  manifest: ProjectManifest,
  clipId: string,
  frame: number,
): { manifest: ProjectManifest; tailId?: string } {
  const found = findClip(manifest, clipId)
  if (!found) return { manifest }
  const { track, clip } = found
  const offset = Math.round(frame - clip.startFrame)
  if (offset <= 0 || offset >= clip.durationFrames) return { manifest }

  const head: ManifestClip = { ...clip, durationFrames: offset }
  const tail: ManifestClip = {
    ...clip,
    id: newId(),
    startFrame: clip.startFrame + offset,
    durationFrames: clip.durationFrames - offset,
    sourceInFrame: clip.sourceInFrame + offset,
    transitionFrames: 0,
  }

  return {
    manifest: mapTrack(manifest, track.id, (t) => ({
      ...t,
      clips: t.clips
        .flatMap((c) => (c.id === clipId ? [head, tail] : [c]))
        .sort((a, b) => a.startFrame - b.startFrame),
    })),
    tailId: tail.id,
  }
}

// =============================================================================
// Timecode
// =============================================================================

const pad = (n: number) => String(n).padStart(2, '0')

/** Editorial timecode — mm:ss:ff, or hh:mm:ss:ff once the cut runs that long */
export function formatTimecode(
  frames: number,
  fps: number,
  withHours = false,
): string {
  const rate = Math.max(1, Math.round(fps))
  const f = Math.max(0, Math.round(frames))
  const totalSeconds = Math.floor(f / rate)
  const minutes = withHours
    ? Math.floor(totalSeconds / 60) % 60
    : Math.floor(totalSeconds / 60)
  const tail = `${pad(minutes)}:${pad(totalSeconds % 60)}:${pad(f % rate)}`
  return withHours ? `${pad(Math.floor(totalSeconds / 3600))}:${tail}` : tail
}

/**
 * Read a timecode back into frames — the inverse of formatTimecode, for fields
 * the user types into.
 *
 * Forgiving on purpose: accepts `HH:MM:SS:FF`, `MM:SS:FF`, `SS:FF` or a bare
 * frame count, and treats `.` and `;` as separators too, because that is what
 * people actually type. Returns null for anything it cannot read, so a caller
 * can leave the field alone rather than snapping it to zero mid-edit.
 */
export function parseTimecode(text: string, fps: number): number | null {
  const rate = Math.max(1, Math.round(fps))
  const trimmed = text.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/[:.;]/).map((p) => p.trim())
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null

  const nums = parts.map(Number)
  if (nums.length === 1) return nums[0]
  if (nums.length > 4) return null

  // right-align: the last field is always frames, then seconds, minutes, hours
  const [frames, seconds = 0, minutes = 0, hours = 0] = [...nums].reverse()
  if (frames >= rate) return null

  return ((hours * 60 + minutes) * 60 + seconds) * rate + frames
}

/** A duration for a chip — 4.2s / 1:04 */
export function formatDuration(frames: number, fps: number): string {
  const sec = frames / Math.max(1, fps)
  return sec < 60
    ? `${sec.toFixed(1)}s`
    : `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))}`
}
