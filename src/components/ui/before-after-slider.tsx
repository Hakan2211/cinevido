'use client'

import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from 'react-compare-slider'
import { cn } from '@/lib/utils'

interface BeforeAfterSliderProps {
  beforeSrc: string
  afterSrc: string
  beforeAlt?: string
  afterAlt?: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = 'Before',
  afterAlt = 'After',
  beforeLabel = 'Before',
  afterLabel = 'After',
  className,
}: BeforeAfterSliderProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage
            src={beforeSrc}
            alt={beforeAlt}
            style={{ objectFit: 'cover' }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={afterSrc}
            alt={afterAlt}
            style={{ objectFit: 'cover' }}
          />
        }
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: 'blur(4px)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '2px solid white',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              color: '#333',
              width: 40,
              height: 40,
            }}
            linesStyle={{
              width: 3,
              background: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          />
        }
        className="h-full w-full"
      />
      {/* Labels */}
      <div className="absolute bottom-4 left-4 z-10">
        <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
          {beforeLabel}
        </span>
      </div>
      <div className="absolute bottom-4 right-4 z-10">
        <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-black backdrop-blur-sm">
          {afterLabel}
        </span>
      </div>
    </div>
  )
}
