/**
 * AgingPanel - Premium bottom panel for AI Baby & Aging Generator
 *
 * Contains:
 * - Sub-mode toggle: Single Person vs Two Parents
 * - Premium age group selector with icons
 * - Premium gender selector with icons
 * - Optional prompt input
 * - Number of images slider
 * - Father weight slider (multi mode only)
 */

import * as SelectPrimitive from '@radix-ui/react-select'
import {
  Baby,
  Briefcase,
  CheckIcon,
  ChevronDownIcon,
  GraduationCap,
  Heart,
  Loader2,
  Smile,
  Sparkles,
  User,
  UserCircle,
  Users,
} from 'lucide-react'
import type {AgeGroup, AgingGender, AgingSubMode} from '@/server/services/types';
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  AGE_GROUPS,
  AGING_MODELS
  
  
  
} from '@/server/services/types'
import { cn } from '@/lib/utils'

// Icon mapping for age groups
const AGE_GROUP_ICONS: Record<AgeGroup, typeof Baby> = {
  baby: Baby,
  toddler: Baby,
  preschool: Smile,
  gradeschooler: GraduationCap,
  teen: User,
  adult: UserCircle,
  mid: Briefcase,
  senior: Heart,
}

// Color mapping for age group icons (gradient backgrounds)
const AGE_GROUP_COLORS: Record<AgeGroup, string> = {
  baby: 'from-pink-500/20 to-pink-600/20 text-pink-500',
  toddler: 'from-rose-500/20 to-rose-600/20 text-rose-500',
  preschool: 'from-amber-500/20 to-amber-600/20 text-amber-500',
  gradeschooler: 'from-emerald-500/20 to-emerald-600/20 text-emerald-500',
  teen: 'from-blue-500/20 to-blue-600/20 text-blue-500',
  adult: 'from-violet-500/20 to-violet-600/20 text-violet-500',
  mid: 'from-slate-500/20 to-slate-600/20 text-slate-500',
  senior: 'from-red-500/20 to-red-600/20 text-red-500',
}

interface AgingPanelProps {
  subMode: AgingSubMode
  onSubModeChange: (mode: AgingSubMode) => void
  ageGroup: AgeGroup
  onAgeGroupChange: (group: AgeGroup) => void
  gender: AgingGender
  onGenderChange: (gender: AgingGender) => void
  prompt: string
  onPromptChange: (prompt: string) => void
  numImages: number
  onNumImagesChange: (n: number) => void
  // Multi-mode specific
  fatherWeight: number
  onFatherWeightChange: (weight: number) => void
  // Actions
  onGenerate: () => void
  isGenerating: boolean
  // Validation state
  singleImageSelected: boolean // For single mode
  motherSelected: boolean // For multi mode
  fatherSelected: boolean // For multi mode
  error?: string | null
  className?: string
}

export function AgingPanel({
  subMode,
  onSubModeChange,
  ageGroup,
  onAgeGroupChange,
  gender,
  onGenderChange,
  prompt,
  onPromptChange,
  numImages,
  onNumImagesChange,
  fatherWeight,
  onFatherWeightChange,
  onGenerate,
  isGenerating,
  singleImageSelected,
  motherSelected,
  fatherSelected,
  error,
  className,
}: AgingPanelProps) {
  // Get the model config for credits
  const modelConfig = AGING_MODELS.find((m) => m.type === subMode)
  const credits = (modelConfig?.credits || 8) * numImages

  // Get selected age group info
  const selectedAgeGroup = AGE_GROUPS.find((g) => g.id === ageGroup)
  const AgeGroupIcon = AGE_GROUP_ICONS[ageGroup]

  // Validation
  const canGenerate =
    !isGenerating &&
    (subMode === 'single'
      ? singleImageSelected
      : motherSelected && fatherSelected)

  // Status message
  const getStatusMessage = () => {
    if (subMode === 'single') {
      return singleImageSelected
        ? '1 image selected'
        : 'Select an image to transform'
    }
    const parts: Array<string> = []
    if (motherSelected) parts.push('Mother')
    if (fatherSelected) parts.push('Father')
    if (parts.length === 0) return 'Select parent photos'
    if (parts.length === 1) return `${parts[0]} selected - need both parents`
    return 'Both parents selected'
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Sub-mode Toggle - Premium Pills */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl border border-border/50 bg-background/50 p-1">
          <button
            onClick={() => onSubModeChange('single')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
              subMode === 'single'
                ? 'bg-primary text-primary-foreground active-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Single Person</span>
            <span className="sm:hidden">Single</span>
          </button>
          <button
            onClick={() => onSubModeChange('multi')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg',
              subMode === 'multi'
                ? 'bg-primary text-primary-foreground active-glow'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Two Parents</span>
            <span className="sm:hidden">Parents</span>
          </button>
        </div>

        {/* Generate Button */}
        <Button
          size="default"
          className="rounded-xl bg-primary hover:bg-primary/90 btn-primary-glow transition-all duration-200 disabled:opacity-50 disabled:shadow-none"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Baby className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Settings Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Premium Age Group Selector */}
        <SelectPrimitive.Root
          value={ageGroup}
          onValueChange={(v) => onAgeGroupChange(v as AgeGroup)}
        >
          <SelectPrimitive.Trigger
            className={cn(
              'group flex items-center gap-3 rounded-xl border bg-card/50 px-3 py-2.5',
              'text-sm font-medium transition-all duration-200',
              'border-border/50 hover:border-primary/30',
              'shadow-sm hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50',
              'min-w-[180px]',
            )}
          >
            {/* Age Group Icon */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br',
                AGE_GROUP_COLORS[ageGroup],
              )}
            >
              <AgeGroupIcon className="h-4 w-4" />
            </div>

            {/* Age Group Info */}
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="truncate font-medium">
                {selectedAgeGroup?.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedAgeGroup?.description}
              </span>
            </div>

            <SelectPrimitive.Icon asChild>
              <ChevronDownIcon className="size-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 overflow-hidden rounded-xl border bg-popover shadow-xl',
                'min-w-[220px] max-h-[400px]',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
              )}
              position="popper"
              sideOffset={8}
            >
              <SelectPrimitive.Viewport className="p-2 space-y-1">
                {AGE_GROUPS.map((group) => {
                  const Icon = AGE_GROUP_ICONS[group.id]
                  return (
                    <SelectPrimitive.Item
                      key={group.id}
                      value={group.id}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
                        'outline-none select-none transition-colors duration-150',
                        'focus:bg-accent/50 hover:bg-accent/50',
                        'data-[state=checked]:bg-primary/10',
                      )}
                    >
                      {/* Icon with colored background */}
                      <div
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br',
                          AGE_GROUP_COLORS[group.id],
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">
                          {group.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.description}
                        </div>
                      </div>

                      {/* Check icon */}
                      <span className="flex size-5 items-center justify-center">
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

        {/* Premium Gender Selector */}
        <SelectPrimitive.Root
          value={gender}
          onValueChange={(v) => onGenderChange(v as AgingGender)}
        >
          <SelectPrimitive.Trigger
            className={cn(
              'group flex items-center gap-3 rounded-xl border bg-card/50 px-3 py-2.5',
              'text-sm font-medium transition-all duration-200',
              'border-border/50 hover:border-primary/30',
              'shadow-sm hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50',
              'min-w-[120px]',
            )}
          >
            {/* Gender Icon */}
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br',
                gender === 'male'
                  ? 'from-blue-500/20 to-blue-600/20 text-blue-500'
                  : 'from-pink-500/20 to-pink-600/20 text-pink-500',
              )}
            >
              <User className="h-4 w-4" />
            </div>

            {/* Gender Text */}
            <span className="font-medium capitalize">{gender}</span>

            <SelectPrimitive.Icon asChild>
              <ChevronDownIcon className="size-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 overflow-hidden rounded-xl border bg-popover shadow-xl',
                'min-w-[140px]',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
              )}
              position="popper"
              sideOffset={8}
            >
              <SelectPrimitive.Viewport className="p-2 space-y-1">
                {/* Male Option */}
                <SelectPrimitive.Item
                  value="male"
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
                    'outline-none select-none transition-colors duration-150',
                    'focus:bg-accent/50 hover:bg-accent/50',
                    'data-[state=checked]:bg-primary/10',
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-500">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-medium">Male</span>
                  <span className="flex size-5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon className="size-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>

                {/* Female Option */}
                <SelectPrimitive.Item
                  value="female"
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
                    'outline-none select-none transition-colors duration-150',
                    'focus:bg-accent/50 hover:bg-accent/50',
                    'data-[state=checked]:bg-primary/10',
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-pink-600/20 text-pink-500">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-medium">Female</span>
                  <span className="flex size-5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon className="size-4 text-primary" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                </SelectPrimitive.Item>
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {/* Number of Images Slider */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 shadow-sm">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Images
          </span>
          <Slider
            value={[numImages]}
            onValueChange={([value]) => onNumImagesChange(value)}
            min={1}
            max={4}
            step={1}
            className="w-20"
          />
          <span className="text-sm font-medium w-4 text-primary">
            {numImages}
          </span>
        </div>

        {/* Father Weight Slider (Multi mode only) */}
        {subMode === 'multi' && (
          <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 shadow-sm">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Father
            </span>
            <Slider
              value={[fatherWeight * 100]}
              onValueChange={([value]) => onFatherWeightChange(value / 100)}
              min={0}
              max={100}
              step={5}
              className="w-24"
            />
            <span className="text-xs font-medium w-8 text-primary">
              {Math.round(fatherWeight * 100)}%
            </span>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 shadow-sm">
          <span
            className={cn(
              'text-xs font-medium',
              canGenerate ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {getStatusMessage()}
          </span>
        </div>

        {/* Credits Display */}
        <div className="ml-auto flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium text-primary">
            {credits} credits
          </span>
        </div>
      </div>

      {/* Optional Prompt Input */}
      <div className="relative">
        <Textarea
          placeholder={
            subMode === 'single'
              ? 'Optional: Describe style or setting (e.g., "professional portrait, studio lighting")'
              : 'Optional: Describe the baby (e.g., "well dressed, smiling")'
          }
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          className="min-h-[60px] resize-none text-sm rounded-xl border-border/50 bg-background/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          rows={2}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
