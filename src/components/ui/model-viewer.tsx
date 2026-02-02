'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
  const modelRef = useRef<HTMLElement>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Dynamically import model-viewer only on client side
    import('@google/model-viewer')
  }, [])

  useEffect(() => {
    const modelViewer = modelRef.current
    if (!modelViewer) return

    const handleLoad = () => setIsLoading(false)
    const handleError = () => setIsLoading(false) // Hide spinner on error too

    modelViewer.addEventListener('load', handleLoad)
    modelViewer.addEventListener('error', handleError)

    return () => {
      modelViewer.removeEventListener('load', handleLoad)
      modelViewer.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-3 text-sm text-muted-foreground">
            Loading 3D model...
          </span>
        </div>
      )}

      <model-viewer
        ref={modelRef as React.RefObject<HTMLElement>}
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
