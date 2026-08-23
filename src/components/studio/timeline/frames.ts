/**
 * What makes a timeline read like picture rather than coloured boxes: real
 * frames inside video clips and a real waveform inside audio ones, taken off
 * the media the clip points at.
 *
 * Both are expensive, so both are cached per URL for the session and degrade
 * quietly: a CDN without CORS headers taints the canvas, and a clip that
 * cannot be sampled simply keeps its flat tint instead of breaking the editor.
 */

// =============================================================================
// Concurrency — decoding media is not free, so only a few run at a time
// =============================================================================

/**
 * A tiny counting semaphore. Without one, a library of fifty tracks would
 * fetch and decode fifty files the moment the list mounts.
 */
function limiter(max: number) {
  let inFlight = 0
  const waiting: Array<() => void> = []

  const acquire = (): Promise<void> => {
    if (inFlight < max) {
      inFlight++
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      waiting.push(() => {
        inFlight++
        resolve()
      })
    })
  }

  const release = () => {
    inFlight--
    waiting.shift()?.()
  }

  return { acquire, release }
}

// =============================================================================
// Waveform peaks
// =============================================================================

const PEAKS_PER_SEC = 24
const peaksCache = new Map<string, Promise<Float32Array>>()
const peaksGate = limiter(3)

export function loadPeaks(url: string): Promise<Float32Array> {
  const cached = peaksCache.get(url)
  if (cached) return cached

  const job = (async () => {
    await peaksGate.acquire()
    try {
      const buf = await (await fetch(url, { mode: 'cors' })).arrayBuffer()
      // OfflineAudioContext decodes without an audio device or autoplay policy
      const ctx = new OfflineAudioContext(1, 8, 8000)
      const audio = await ctx.decodeAudioData(buf)
      const ch = audio.getChannelData(0)
      const n = Math.max(1, Math.ceil(audio.duration * PEAKS_PER_SEC))
      const per = Math.max(1, Math.floor(ch.length / n))
      const peaks = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        let max = 0
        const end = Math.min(ch.length, (i + 1) * per)
        for (let j = i * per; j < end; j += 4) {
          const v = Math.abs(ch[j])
          if (v > max) max = v
        }
        peaks[i] = max
      }
      return peaks
    } catch {
      return new Float32Array(0)
    } finally {
      peaksGate.release()
    }
  })()

  peaksCache.set(url, job)
  return job
}

export { PEAKS_PER_SEC }

// =============================================================================
// Filmstrip
// =============================================================================

/** one decoded still, as a data URL */
const posterCache = new Map<string, Promise<string | null>>()

/** at most this many videos are sampled at once — decoding is not free */
const posterGate = limiter(2)

/** grab a single frame of a video as a data URL (null if it cannot be read) */
export function posterAt(url: string, timeSec: number): Promise<string | null> {
  const key = `${url}@${timeSec.toFixed(2)}`
  const cached = posterCache.get(key)
  if (cached) return cached

  const job = (async () => {
    await posterGate.acquire()
    try {
      return await new Promise<string | null>((resolve) => {
        const video = document.createElement('video')
        let settled = false
        const done = (value: string | null) => {
          if (settled) return
          settled = true
          video.removeAttribute('src')
          video.load()
          resolve(value)
        }

        video.crossOrigin = 'anonymous'
        video.muted = true
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(
            Math.max(0, timeSec),
            Math.max(0, video.duration - 0.05),
          )
        }
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas')
            const scale = 96 / Math.max(1, video.videoHeight)
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
            canvas.height = 96
            const ctx = canvas.getContext('2d')
            if (!ctx) return done(null)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            done(canvas.toDataURL('image/jpeg', 0.6))
          } catch {
            // tainted canvas (no CORS headers on the CDN) — fall back quietly
            done(null)
          }
        }
        video.onerror = () => done(null)
        setTimeout(() => done(null), 12000)
        video.src = url
      })
    } finally {
      posterGate.release()
    }
  })()

  posterCache.set(key, job)
  return job
}

/**
 * A strip of stills across a clip's own slice of its source. `count` is what
 * fits at the current zoom, so a long clip gets more pictures than a short one.
 */
export async function filmstrip(
  url: string,
  startSec: number,
  lengthSec: number,
  count: number,
): Promise<Array<string | null>> {
  const n = Math.max(1, Math.min(count, 12))
  const out: Array<string | null> = []
  for (let i = 0; i < n; i++) {
    const t = startSec + (lengthSec * (i + 0.5)) / n
    out.push(await posterAt(url, t))
  }
  return out
}
