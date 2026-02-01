import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Video, Volume2, VolumeX } from 'lucide-react'
import { showcaseVideos } from '@/lib/showcase-assets'
import { cn } from '@/lib/utils'

export function VideoShowcaseSection() {
  return (
    <section id="videos" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm mb-6">
            <Video className="h-4 w-4 text-primary" />
            AI Video Generation
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Bring Your Ideas to Life
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Generate cinematic videos from text or animate any image with Kling,
            Pika, Wan, and Luma. Full motion control at your fingertips.
          </p>
        </motion.div>

        {/* Video Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {showcaseVideos.map((video, index) => (
            <motion.div
              key={video.src}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <VideoCard video={video} />
            </motion.div>
          ))}
        </div>

        {/* Features callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-4"
        >
          {[
            'Text to Video',
            'Image Animation',
            'Motion Control',
            'Keyframe Transitions',
          ].map((feature) => (
            <span
              key={feature}
              className="inline-flex items-center gap-2 rounded-full bg-background border px-4 py-2 text-sm font-medium"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              {feature}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

interface VideoCardProps {
  video: {
    src: string
    title: string
    model: string
  }
}

function VideoCard({ video }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (videoRef.current && !isPlaying) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    // Pause video when mouse leaves
    if (videoRef.current) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div
      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border/50 bg-card cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={video.src}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Model badge */}
      <div className="absolute top-3 left-3 z-10">
        <span className="rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
          {video.model}
        </span>
      </div>

      {/* Play/Pause button */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-300',
          isPlaying && !isHovered ? 'opacity-0' : 'opacity-100',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform hover:scale-110">
          {isPlaying ? (
            <Pause className="h-6 w-6 text-white" />
          ) : (
            <Play className="h-6 w-6 text-white ml-1" />
          )}
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white transition-colors hover:bg-black/80"
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      {/* Title */}
      <div className="absolute bottom-3 left-3 z-10">
        <h4 className="font-semibold text-white text-sm">{video.title}</h4>
      </div>
    </div>
  )
}
