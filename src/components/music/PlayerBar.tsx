/**
 * The transport, pinned across the bottom of the lab. One <audio> element for
 * the whole page — a second player would mean two tracks at once and no way to
 * tell which one the scrub bar belongs to.
 */

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { KIND } from '../studio/timeline/shared'
import type { MusicTrack } from './TrackList'

interface PlayerBarProps {
  track?: MusicTrack
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  onStep: (delta: -1 | 1) => void
}

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

export function PlayerBar({
  track,
  playing,
  onPlayingChange,
  onStep,
}: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  // follow the selected track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (audio.src !== track.url) {
      audio.src = track.url
      setPosition(0)
    }
    if (playing) {
      void audio.play().catch(() => onPlayingChange(false))
    } else {
      audio.pause()
    }
  }, [track, playing, onPlayingChange])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
  }, [volume])

  if (!track) return null

  return (
    <div className="flex h-16 shrink-0 items-center gap-4 border-t bg-muted/30 px-4">
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => onPlayingChange(false)}
        hidden
      />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Previous track"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPlayingChange(!playing)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Next track"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* title and clock sit together, so the bar itself gets the whole width */}
      <div className="w-44 shrink-0">
        <p className="truncate text-xs font-medium">{track.title}</p>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {fmt(position)} / {fmt(duration || track.durationSeconds || 0)}
        </p>
      </div>

      <input
        type="range"
        min={0}
        max={duration || track.durationSeconds || 1}
        step={0.1}
        value={position}
        onChange={(e) => {
          const next = Number(e.target.value)
          setPosition(next)
          if (audioRef.current) audioRef.current.currentTime = next
        }}
        // green, not the app accent: this bar belongs to the music, and it is
        // the same green the Music lane and every waveform here already use
        style={{ accentColor: KIND.music.accent }}
        className="h-1 min-w-0 flex-1"
        title="Seek"
      />

      <div className="hidden items-center gap-2 md:flex">
        <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ accentColor: KIND.music.accent }}
          className="h-1 w-20"
          title={`Volume ${Math.round(volume * 100)}%`}
        />
      </div>
    </div>
  )
}
