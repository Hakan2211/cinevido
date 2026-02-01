'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MasonryImage {
  src: string
  alt: string
  category?: string
}

interface MasonryGridProps {
  images: MasonryImage[]
  columns?: number
  gap?: number
  className?: string
  initialCount?: number
  showViewAll?: boolean
}

export function MasonryGrid({
  images,
  columns = 4,
  gap = 4,
  className,
  initialCount = 12,
  showViewAll = true,
}: MasonryGridProps) {
  const [showAll, setShowAll] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MasonryImage | null>(null)

  const displayedImages = showAll ? images : images.slice(0, initialCount)

  const handleImageClick = useCallback((image: MasonryImage) => {
    setSelectedImage(image)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedImage(null)
  }, [])

  // Distribute images into columns for masonry effect
  const getColumns = () => {
    const cols: MasonryImage[][] = Array.from({ length: columns }, () => [])
    displayedImages.forEach((image, index) => {
      cols[index % columns].push(image)
    })
    return cols
  }

  return (
    <>
      <div className={cn('w-full', className)}>
        {/* Masonry Grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: `${gap * 4}px`,
          }}
        >
          {getColumns().map((column, colIndex) => (
            <div
              key={colIndex}
              className="flex flex-col"
              style={{ gap: `${gap * 4}px` }}
            >
              {column.map((image, imgIndex) => (
                <motion.div
                  key={image.src}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: (colIndex * column.length + imgIndex) * 0.05,
                  }}
                  className="group relative cursor-pointer overflow-hidden rounded-xl"
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  {/* Category badge */}
                  {image.category && (
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm capitalize">
                        {image.category}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        {/* View All Button */}
        {showViewAll && images.length > initialCount && !showAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              View All {images.length} Images
            </button>
          </motion.div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={handleClose}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              onClick={handleClose}
            >
              <X className="h-6 w-6" />
            </motion.button>
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
