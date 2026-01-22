'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Model3DConfig, Model3DMode } from '@/server/services/types'
import {
  TEXT_TO_3D_MODELS,
  IMAGE_TO_3D_MODELS,
  IMAGE_TO_WORLD_MODELS,
} from '@/server/services/types'

interface Model3DModelSelectProps {
  mode: Model3DMode
  value: string
  onChange: (modelId: string) => void
  className?: string
}

function getModelsForMode(mode: Model3DMode): Model3DConfig[] {
  switch (mode) {
    case 'text-to-3d':
      return TEXT_TO_3D_MODELS
    case 'image-to-3d':
      return IMAGE_TO_3D_MODELS
    case 'image-to-world':
      return IMAGE_TO_WORLD_MODELS
    default:
      return []
  }
}

function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    hunyuan: 'bg-blue-500/20 text-blue-400',
    meshy: 'bg-purple-500/20 text-purple-400',
    hyper3d: 'bg-green-500/20 text-green-400',
    bytedance: 'bg-cyan-500/20 text-cyan-400',
    meta: 'bg-orange-500/20 text-orange-400',
  }
  return colors[provider] || 'bg-gray-500/20 text-gray-400'
}

export function Model3DModelSelect({
  mode,
  value,
  onChange,
  className,
}: Model3DModelSelectProps) {
  const models = getModelsForMode(mode)
  const selectedModel = models.find((m) => m.id === value)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="Select a model">
          {selectedModel && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0',
                  getProviderColor(selectedModel.provider),
                )}
              >
                {selectedModel.provider}
              </Badge>
              <span className="truncate">{selectedModel.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="py-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    getProviderColor(model.provider),
                  )}
                >
                  {model.provider}
                </Badge>
                <span className="font-medium">{model.name}</span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {model.credits} credits
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground pl-0.5">
                {model.dropdownDescription}
              </p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
