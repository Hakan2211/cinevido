/**
 * ImageCanvas - Canvas component for drawing masks on images
 *
 * Features:
 * - Load an image as background
 * - Draw masks with brush tool
 * - Erase parts of the mask
 * - Clear entire mask
 * - Export mask as data URL
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageCanvasProps {
  imageUrl: string | null
  brushSize: number
  brushMode: 'draw' | 'erase'
  onMaskChange?: (maskDataUrl: string | null) => void
  className?: string
}

export function ImageCanvas({
  imageUrl,
  brushSize,
  brushMode,
  onMaskChange,
  className,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  // Load and display the image
  useEffect(() => {
    if (!imageUrl || !canvasRef.current || !maskCanvasRef.current) return

    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')

    if (!ctx || !maskCtx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Calculate size to fit container while maintaining aspect ratio
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight
      const imgAspect = img.width / img.height
      const containerAspect = containerWidth / containerHeight

      let displayWidth, displayHeight

      if (imgAspect > containerAspect) {
        displayWidth = containerWidth
        displayHeight = containerWidth / imgAspect
      } else {
        displayHeight = containerHeight
        displayWidth = containerHeight * imgAspect
      }

      // Set canvas dimensions
      canvas.width = displayWidth
      canvas.height = displayHeight
      maskCanvas.width = displayWidth
      maskCanvas.height = displayHeight

      setCanvasSize({ width: displayWidth, height: displayHeight })

      // Draw image on main canvas
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight)

      // Clear mask canvas (transparent)
      maskCtx.clearRect(0, 0, displayWidth, displayHeight)

      setImageLoaded(true)
      onMaskChange?.(null)
    }

    img.onerror = () => {
      console.error('Failed to load image:', imageUrl)
      setImageLoaded(false)
    }

    img.src = imageUrl
  }, [imageUrl, onMaskChange])

  // Get position relative to canvas
  const getCanvasPosition = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = maskCanvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      let clientX, clientY

      if ('touches' in e) {
        clientX = e.touches[0].clientX
        clientY = e.touches[0].clientY
      } else {
        clientX = e.clientX
        clientY = e.clientY
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    },
    [],
  )

  // Draw on mask canvas
  const draw = useCallback(
    (x: number, y: number) => {
      const maskCanvas = maskCanvasRef.current
      if (!maskCanvas) return

      const ctx = maskCanvas.getContext('2d')
      if (!ctx) return

      ctx.globalCompositeOperation =
        brushMode === 'draw' ? 'source-over' : 'destination-out'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)' // Semi-transparent white for mask
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    },
    [brushSize, brushMode],
  )

  // Export mask as data URL
  const exportMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return null

    // Create a new canvas for the mask export (white mask on black background)
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = maskCanvas.width
    exportCanvas.height = maskCanvas.height
    const ctx = exportCanvas.getContext('2d')

    if (!ctx) return null

    // Black background (areas to keep)
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    // Draw mask (white areas = replace)
    ctx.drawImage(maskCanvas, 0, 0)

    // Convert semi-transparent white to solid white
    const imageData = ctx.getImageData(
      0,
      0,
      exportCanvas.width,
      exportCanvas.height,
    )
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      // If there's any white (mask), make it solid white
      if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
        data[i] = 255 // R
        data[i + 1] = 255 // G
        data[i + 2] = 255 // B
        data[i + 3] = 255 // A
      }
    }

    ctx.putImageData(imageData, 0, 0)

    return exportCanvas.toDataURL('image/png')
  }, [])

  // Mouse/touch event handlers
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!imageLoaded) return
      e.preventDefault()
      setIsDrawing(true)

      const pos = getCanvasPosition(e)
      if (pos) draw(pos.x, pos.y)
    },
    [imageLoaded, getCanvasPosition, draw],
  )

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !imageLoaded) return
      e.preventDefault()

      const pos = getCanvasPosition(e)
      if (pos) draw(pos.x, pos.y)
    },
    [isDrawing, imageLoaded, getCanvasPosition, draw],
  )

  const handleEnd = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false)
      // Export mask and notify parent
      const maskUrl = exportMask()
      onMaskChange?.(maskUrl)
    }
  }, [isDrawing, exportMask, onMaskChange])

  // Clear the mask
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return

    const ctx = maskCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    onMaskChange?.(null)
  }, [onMaskChange])

  // Expose clearMask via ref if needed
  useEffect(() => {
    // Attach clearMask to the container for external access
    const container = containerRef.current
    if (container) {
      ;(container as HTMLDivElement & { clearMask?: () => void }).clearMask =
        clearMask
    }
  }, [clearMask])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden',
        className,
      )}
    >
      {!imageUrl ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground">
            Select an image from your library to edit
          </p>
        </div>
      ) : (
        <div className="relative" style={{ width: canvasSize.width || 'auto' }}>
          {/* Base image canvas */}
          <canvas
            ref={canvasRef}
            className="block"
            style={{
              width: canvasSize.width || 'auto',
              height: canvasSize.height || 'auto',
            }}
          />

          {/* Mask overlay canvas */}
          <canvas
            ref={maskCanvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{
              width: canvasSize.width || 'auto',
              height: canvasSize.height || 'auto',
            }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />

          {/* Brush cursor preview */}
          {imageLoaded && (
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white mix-blend-difference"
              style={{
                width: brushSize,
                height: brushSize,
                transform: 'translate(-50%, -50%)',
                display: 'none', // Will be shown via CSS on hover
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Hook to access canvas controls
export function useImageCanvasControls(
  containerRef: React.RefObject<HTMLDivElement>,
) {
  const clearMask = useCallback(() => {
    const container = containerRef.current as HTMLDivElement & {
      clearMask?: () => void
    }
    container?.clearMask?.()
  }, [containerRef])

  return { clearMask }
}
