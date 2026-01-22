/**
 * Premium Model Select Component
 *
 * A rich dropdown for selecting AI models with:
 * - Provider icons with colored backgrounds
 * - Model descriptions
 * - Credit cost badges
 * - Grouped by provider (optional)
 */

import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CreditBadge,
  ModelIcon,
  PROVIDER_NAMES,
  getProviderFromModelId,
} from '@/lib/model-icons'

interface ModelOption {
  id: string
  name: string
  credits: number
  description?: string
  maxImages?: number
  supportsNumImages?: boolean
  maxNumImages?: number
}

interface ModelSelectProps {
  value: string
  onValueChange: (value: string) => void
  models: Array<ModelOption>
  placeholder?: string
  className?: string
  triggerClassName?: string
  showDescription?: boolean
  showProvider?: boolean
}

export function ModelSelect({
  value,
  onValueChange,
  models,
  placeholder = 'Select model',
  className,
  triggerClassName,
  showDescription = true,
  showProvider = true,
}: ModelSelectProps) {
  const selectedModel = models.find((m) => m.id === value)
  const provider = selectedModel
    ? getProviderFromModelId(selectedModel.id)
    : null

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          // Base styles
          'group flex items-center gap-3 rounded-xl border bg-card/50 px-3 py-2.5',
          'text-sm font-medium transition-all duration-200',
          // Border and shadow
          'border-border/50 hover:border-primary/30',
          'shadow-sm hover:shadow-md',
          // Focus styles
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50',
          // Min width for consistent sizing
          'min-w-[200px]',
          triggerClassName,
        )}
      >
        {selectedModel ? (
          <>
            <ModelIcon modelId={selectedModel.id} size="sm" />
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="truncate font-medium">{selectedModel.name}</span>
              {showProvider && provider && (
                <span className="text-xs text-muted-foreground">
                  {PROVIDER_NAMES[provider]}
                </span>
              )}
            </div>
            <CreditBadge credits={selectedModel.credits} />
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            // Base styles
            'relative z-50 overflow-hidden rounded-xl border bg-popover shadow-xl',
            // Size constraints
            'min-w-[280px] max-h-[400px]',
            // Animation
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
          position="popper"
          sideOffset={8}
        >
          <SelectPrimitive.Viewport className="p-2 space-y-1">
            {models.map((model) => {
              const modelProvider = getProviderFromModelId(model.id)
              return (
                <SelectPrimitive.Item
                  key={model.id}
                  value={model.id}
                  className={cn(
                    // Base styles
                    'relative flex items-start gap-3 rounded-lg px-3 py-3 cursor-pointer',
                    'outline-none select-none transition-colors duration-150',
                    // Hover/focus styles
                    'focus:bg-accent/50 hover:bg-accent/50',
                    'data-[state=checked]:bg-primary/10',
                  )}
                >
                  <ModelIcon modelId={model.id} size="md" />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {model.name}
                      </span>
                      {showProvider && (
                        <span className="text-xs text-muted-foreground">
                          {PROVIDER_NAMES[modelProvider]}
                        </span>
                      )}
                    </div>

                    {showDescription && model.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {model.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <CreditBadge credits={model.credits} />
                      {model.maxImages && model.maxImages > 1 && (
                        <span className="text-xs text-muted-foreground">
                          Up to {model.maxImages} images
                        </span>
                      )}
                      {model.supportsNumImages && (
                        <span className="text-xs text-muted-foreground">
                          Batch: 1-{model.maxNumImages || 4}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon className="size-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

// Compact variant for inline use
interface ModelSelectCompactProps {
  value: string
  onValueChange: (value: string) => void
  models: Array<ModelOption>
  className?: string
}

export function ModelSelectCompact({
  value,
  onValueChange,
  models,
  className,
}: ModelSelectCompactProps) {
  const selectedModel = models.find((m) => m.id === value)

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'group inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/50',
          'px-2.5 py-1.5 text-sm font-medium',
          'hover:border-primary/30 hover:bg-card',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          'transition-all duration-200',
          className,
        )}
      >
        {selectedModel && (
          <ModelIcon
            modelId={selectedModel.id}
            size="sm"
            showBackground={false}
          />
        )}
        <SelectPrimitive.Value placeholder="Model">
          {selectedModel?.name}
        </SelectPrimitive.Value>
        <span className="text-xs text-muted-foreground">
          {selectedModel?.credits}cr
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-3.5 opacity-50 group-data-[state=open]:rotate-180 transition-transform" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            'relative z-50 overflow-hidden rounded-xl border bg-popover shadow-xl',
            'min-w-[260px] max-h-[350px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          )}
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {models.map((model) => (
              <SelectPrimitive.Item
                key={model.id}
                value={model.id}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 cursor-pointer',
                  'outline-none select-none transition-colors',
                  'focus:bg-accent/50 hover:bg-accent/50',
                  'data-[state=checked]:bg-primary/10',
                )}
              >
                <ModelIcon modelId={model.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{model.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {model.credits}cr
                </span>
                <span className="flex size-4 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-3.5 text-primary" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
