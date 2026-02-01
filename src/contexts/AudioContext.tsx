'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

const AUDIO_SRC = '/audio/Where the Water Meets the Land.mp3'
const STORAGE_KEY = 'vidcin-audio-enabled'

interface AudioContextType {
  isPlaying: boolean
  isLoaded: boolean
  toggle: () => void
}

const AudioContext = createContext<AudioContextType | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize audio element
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const audio = new Audio(AUDIO_SRC)
    audio.loop = true
    audio.volume = 0.3
    audio.preload = 'auto'
    audioRef.current = audio

    const handleCanPlay = () => setIsLoaded(true)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    // Check localStorage for saved preference
    const savedPreference = localStorage.getItem(STORAGE_KEY)
    if (savedPreference === 'true') {
      // Attempt to auto-play (may be blocked by browser)
      audio.play().catch(() => {
        // Autoplay blocked - user will need to click toggle
      })
    }

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      audio.play().catch((error) => {
        console.warn('Audio playback failed:', error)
      })
      localStorage.setItem(STORAGE_KEY, 'true')
    } else {
      audio.pause()
      localStorage.setItem(STORAGE_KEY, 'false')
    }
  }, [])

  return (
    <AudioContext.Provider value={{ isPlaying, isLoaded, toggle }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
