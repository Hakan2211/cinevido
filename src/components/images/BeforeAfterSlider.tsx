/**
 * Before/After Image Comparison Slider
 *
 * An interactive slider component that allows users to compare
 * the original (before) image with the processed (after) image
 * by dragging a handle left/right.
 */

import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
  ReactCompareSliderImage,
} from 'react-compare-slider'
import { cn } from '@/lib/utils'

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  className,
}: BeforeAfterSliderProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage
            src={beforeImage}
            alt={beforeLabel}
            className="h-full w-full object-cover"
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={afterImage}
            alt={afterLabel}
            className="h-full w-full object-cover"
          />
        }
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '2px solid hsl(var(--primary))',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              color: 'hsl(var(--primary))',
              width: 40,
              height: 40,
            }}
            linesStyle={{
              width: 3,
              background:
                'linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.5))',
            }}
          />
        }
        position={50}
        className="aspect-square"
      />

      {/* Labels */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between p-3">
        <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {beforeLabel}
        </span>
        <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {afterLabel}
        </span>
      </div>
    </div>
  )
}
