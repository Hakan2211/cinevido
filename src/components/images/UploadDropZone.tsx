/**
 * UploadDropZone - Drag and drop zone for uploading user images
 *
 * Features:
 * - Drag and drop support
 * - Click to browse files
 * - File type validation (JPG, PNG, WebP, GIF)
 * - File size validation (max 10MB)
 * - Upload progress indication
 * - Error handling with toast notifications
 */

import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { uploadUserImageFn } from '@/server/image.fn'
import { cn } from '@/lib/utils'

interface UploadDropZoneProps {
  onUploadComplete?: () => void
  className?: string
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

export function UploadDropZone({
  onUploadComplete,
  className,
}: UploadDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: uploadUserImageFn,
    onSuccess: () => {
      toast.success('Image uploaded successfully!')
      onUploadComplete?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload image')
    },
  })

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload JPG, PNG, WebP, or GIF.'
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`
    }
    return null
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }

      // Convert file to base64
      const reader = new FileReader()
      reader.onload = async () => {
        const result = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Data = result.split(',')[1]

        uploadMutation.mutate({
          data: {
            imageData: base64Data,
            filename: file.name,
            contentType: file.type as
              | 'image/jpeg'
              | 'image/png'
              | 'image/webp'
              | 'image/gif',
          },
        })
      }
      reader.onerror = () => {
        toast.error('Failed to read file')
      }
      reader.readAsDataURL(file)
    },
    [uploadMutation, validateFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        processFile(files[0])
      }
    },
    [processFile],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        processFile(files[0])
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [processFile],
  )

  const isUploading = uploadMutation.isPending

  return (
    <div
      className={cn(
        'relative mb-4 rounded-lg border-2 border-dashed transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        isUploading && 'pointer-events-none opacity-60',
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 p-4">
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="sr-only"
          disabled={isUploading}
        />

        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              {isDragging ? (
                <ImagePlus className="h-6 w-6 text-primary" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {isDragging ? 'Drop image here' : 'Upload your own image'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              JPG, PNG, WebP, GIF (max {MAX_SIZE_MB}MB)
            </span>
          </>
        )}
      </label>
    </div>
  )
}
