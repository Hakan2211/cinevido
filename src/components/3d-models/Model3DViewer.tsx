'use client'

import { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  useGLTF,
  Environment,
  Center,
  PresentationControls,
  ContactShadows,
} from '@react-three/drei'
import { cn } from '@/lib/utils'
import { Loader2, Box } from 'lucide-react'
import type { Group } from 'three'

/**
 * Convert Bunny CDN URLs to use our proxy to bypass CORS
 * This is needed because Bunny CDN doesn't properly handle CORS for GLB files
 */
function getProxiedUrl(url: string): string {
  if (!url) return url

  // Check if URL is from Bunny CDN
  if (url.includes('vidcin.b-cdn.net')) {
    // Route through our proxy API
    return `/api/proxy-glb?url=${encodeURIComponent(url)}`
  }

  // For other URLs (e.g., FAL.ai), use directly
  return url
}

interface Model3DViewerProps {
  url: string
  className?: string
  autoRotate?: boolean
  showControls?: boolean
}

function Model({ url }: { url: string }) {
  const proxiedUrl = useMemo(() => getProxiedUrl(url), [url])
  const { scene } = useGLTF(proxiedUrl)
  // Clone scene so each mount gets its own copy - prevents R3F errors on remount
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  return (
    <group>
      <primitive object={clonedScene} />
    </group>
  )
}

function AutoRotateModel({ url }: { url: string }) {
  const proxiedUrl = useMemo(() => getProxiedUrl(url), [url])
  const { scene } = useGLTF(proxiedUrl)
  // Clone scene so each mount gets its own copy - prevents R3F errors on remount
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  )
}

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">Loading model...</span>
      </div>
    </div>
  )
}

// ErrorFallback can be used with ErrorBoundary if needed
// function ErrorFallback() {
//   return (
//     <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
//       <div className="flex flex-col items-center gap-2 text-muted-foreground">
//         <Box className="h-12 w-12" />
//         <span className="text-sm">Failed to load model</span>
//       </div>
//     </div>
//   )
// }

export function Model3DViewer({
  url,
  className,
  autoRotate = false,
  showControls = true,
}: Model3DViewerProps) {
  if (!url) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center bg-muted/30 rounded-lg',
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Box className="h-12 w-12" />
          <span className="text-sm">No model</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ preserveDrawingBuffer: true }}
          className="rounded-lg"
        >
          <ambientLight intensity={0.5} />
          <spotLight
            position={[10, 10, 10]}
            angle={0.15}
            penumbra={1}
            intensity={1}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          <Center>
            {autoRotate ? <AutoRotateModel url={url} /> : <Model url={url} />}
          </Center>

          {showControls && (
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={1}
              maxDistance={20}
            />
          )}

          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.4}
            scale={10}
            blur={2.5}
          />

          <Environment preset="studio" />
        </Canvas>
      </Suspense>

      {/* Controls hint */}
      {showControls && (
        <div className="absolute bottom-2 left-2 text-xs text-muted-foreground/60 pointer-events-none">
          Drag to rotate | Scroll to zoom
        </div>
      )}
    </div>
  )
}

/**
 * Compact viewer for cards/thumbnails with auto-rotate
 */
export function Model3DViewerCompact({
  url,
  className,
}: {
  url: string
  className?: string
}) {
  if (!url) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/30 rounded',
          className,
        )}
      >
        <Box className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />

          <PresentationControls
            global
            rotation={[0, 0.3, 0]}
            polar={[-Math.PI / 3, Math.PI / 3]}
            azimuth={[-Math.PI / 1.4, Math.PI / 2]}
          >
            <Center>
              <AutoRotateModel url={url} />
            </Center>
          </PresentationControls>

          <Environment preset="city" />
        </Canvas>
      </Suspense>
    </div>
  )
}

// Pre-load GLB to avoid flash
export function preloadModel(url: string) {
  useGLTF.preload(getProxiedUrl(url))
}
