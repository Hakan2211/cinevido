'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Type augmentation for model-viewer custom element
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          alt?: string
          poster?: string
          'camera-controls'?: boolean
          'auto-rotate'?: boolean
          'shadow-intensity'?: string
          'environment-image'?: string
          exposure?: string
          'rotation-per-second'?: string
          'interaction-prompt'?: string
          loading?: 'auto' | 'lazy' | 'eager'
        },
        HTMLElement
      >
    }
  }
}

interface ModelViewerProps {
  src: string
  alt?: string
  poster?: string
  autoRotate?: boolean
  cameraControls?: boolean
  shadowIntensity?: number
  exposure?: number
  className?: string
}

export function ModelViewer({
  src,
  alt = '3D Model',
  poster,
  autoRotate = true,
  cameraControls = true,
  shadowIntensity = 1,
  exposure = 1,
  className,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Dynamically import model-viewer only on client side
    import('@google/model-viewer')
  }, [])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <model-viewer
        src={src}
        alt={alt}
        poster={poster}
        camera-controls={cameraControls}
        auto-rotate={autoRotate}
        shadow-intensity={String(shadowIntensity)}
        exposure={String(exposure)}
        rotation-per-second="30deg"
        interaction-prompt="auto"
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          backgroundColor: 'transparent',
        }}
      />
      {/* Interaction hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
          Drag to rotate, scroll to zoom
        </span>
      </div>
    </div>
  )
}
