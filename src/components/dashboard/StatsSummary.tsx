/**
 * StatsSummary Component
 *
 * Shows count of images, videos, and 3D models
 */

import { Image, Video, Box } from 'lucide-react'

interface StatsSummaryProps {
  counts: {
    images: number
    videos: number
    model3ds: number
  }
}

export function StatsSummary({ counts }: StatsSummaryProps) {
  const stats = [
    {
      label: 'Images',
      count: counts.images,
      icon: Image,
      color: 'text-blue-500',
    },
    {
      label: 'Videos',
      count: counts.videos,
      icon: Video,
      color: 'text-purple-500',
    },
    {
      label: '3D Models',
      count: counts.model3ds,
      icon: Box,
      color: 'text-orange-500',
    },
  ]

  const total = counts.images + counts.videos + counts.model3ds

  return (
    <div className="flex items-center gap-6 text-sm">
      <span className="text-muted-foreground">
        {total} creation{total !== 1 ? 's' : ''} total
      </span>
      <div className="flex items-center gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-muted-foreground">{stat.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
