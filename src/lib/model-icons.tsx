/**
 * Model Icons - Premium icon components for AI model providers
 *
 * Maps model IDs to their respective provider icons and colors
 */

import { cn } from '@/lib/utils'

// Provider color schemes (blue/teal theme)
export const PROVIDER_COLORS = {
  google: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    gradient: 'from-blue-500 to-cyan-500',
  },
  openai: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    gradient: 'from-emerald-500 to-teal-500',
  },
  flux: {
    bg: 'bg-violet-500/20',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    gradient: 'from-violet-500 to-purple-500',
  },
  imagineart: {
    bg: 'bg-pink-500/20',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    gradient: 'from-pink-500 to-rose-500',
  },
  bytedance: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    gradient: 'from-red-500 to-orange-500',
  },
  recraft: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    gradient: 'from-amber-500 to-yellow-500',
  },
  bria: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    gradient: 'from-cyan-500 to-sky-500',
  },
  alibaba: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    gradient: 'from-orange-500 to-amber-500',
  },
  runway: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    gradient: 'from-indigo-500 to-blue-500',
  },
  luma: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    gradient: 'from-purple-500 to-fuchsia-500',
  },
  kling: {
    bg: 'bg-teal-500/20',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    gradient: 'from-teal-500 to-emerald-500',
  },
  minimax: {
    bg: 'bg-sky-500/20',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    gradient: 'from-sky-500 to-blue-500',
  },
  pika: {
    bg: 'bg-lime-500/20',
    border: 'border-lime-500/30',
    text: 'text-lime-400',
    gradient: 'from-lime-500 to-green-500',
  },
  xai: {
    bg: 'bg-neutral-500/20',
    border: 'border-neutral-500/30',
    text: 'text-neutral-300',
    gradient: 'from-neutral-400 to-slate-500',
  },
  default: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    gradient: 'from-slate-500 to-gray-500',
  },
} as const

export type ProviderKey = keyof typeof PROVIDER_COLORS

// Get provider from model ID
export function getProviderFromModelId(modelId: string): ProviderKey {
  const lowerModelId = modelId.toLowerCase()

  if (lowerModelId.includes('nano-banana') || lowerModelId.includes('google')) {
    return 'google'
  }
  if (lowerModelId.includes('gpt') || lowerModelId.includes('openai')) {
    return 'openai'
  }
  if (lowerModelId.includes('flux')) {
    return 'flux'
  }
  if (lowerModelId.includes('imagineart')) {
    return 'imagineart'
  }
  if (lowerModelId.includes('bytedance') || lowerModelId.includes('seedream')) {
    return 'bytedance'
  }
  if (lowerModelId.includes('recraft')) {
    return 'recraft'
  }
  if (lowerModelId.includes('bria')) {
    return 'bria'
  }
  if (lowerModelId.includes('wan') || lowerModelId.includes('alibaba')) {
    return 'alibaba'
  }
  if (lowerModelId.includes('runway')) {
    return 'runway'
  }
  if (lowerModelId.includes('luma') || lowerModelId.includes('ray')) {
    return 'luma'
  }
  if (lowerModelId.includes('kling')) {
    return 'kling'
  }
  if (lowerModelId.includes('minimax') || lowerModelId.includes('hailuo')) {
    return 'minimax'
  }
  if (lowerModelId.includes('pika')) {
    return 'pika'
  }
  if (lowerModelId.includes('xai') || lowerModelId.includes('grok')) {
    return 'xai'
  }

  return 'default'
}

// Provider display names
export const PROVIDER_NAMES: Record<ProviderKey, string> = {
  google: 'Google',
  openai: 'OpenAI',
  flux: 'Black Forest',
  imagineart: 'ImagineArt',
  bytedance: 'ByteDance',
  recraft: 'Recraft',
  bria: 'Bria',
  alibaba: 'Alibaba',
  runway: 'Runway',
  luma: 'Luma AI',
  kling: 'Kuaishou',
  minimax: 'MiniMax',
  pika: 'Pika',
  xai: 'xAI',
  default: 'AI',
}

// Simple icon components for each provider
interface IconProps {
  className?: string
}

function GoogleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function OpenAIIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4066-.6898zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

function FluxIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
    >
      <path d="M12 0L14.59 9.41 24 12l-9.41 2.59L12 24l-2.59-9.41L0 12l9.41-2.59L12 0z" />
    </svg>
  )
}

function WandIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M12.2 11.8L11 13M12.2 6.2L11 5M15 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="m2 22 10-10" />
    </svg>
  )
}

function FilmIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18M17 3v18M3 7h4M17 7h4M3 12h18M3 17h4M17 17h4" />
    </svg>
  )
}

function XaiIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
    >
      <path d="M2 3l8.5 9L2 21h2l7.5-8L19 21h3l-8.5-9L22 3h-2l-7.5 8L5 3H2z" />
    </svg>
  )
}

// Icon registry
const PROVIDER_ICONS: Record<ProviderKey, React.FC<IconProps>> = {
  google: GoogleIcon,
  openai: OpenAIIcon,
  flux: FluxIcon,
  imagineart: SparkleIcon,
  bytedance: FilmIcon,
  recraft: WandIcon,
  bria: SparkleIcon,
  alibaba: SparkleIcon,
  runway: FilmIcon,
  luma: FilmIcon,
  kling: FilmIcon,
  minimax: FilmIcon,
  pika: FilmIcon,
  xai: XaiIcon,
  default: SparkleIcon,
}

// Main ModelIcon component
interface ModelIconProps {
  modelId: string
  size?: 'sm' | 'md' | 'lg'
  showBackground?: boolean
  className?: string
}

export function ModelIcon({
  modelId,
  size = 'md',
  showBackground = true,
  className,
}: ModelIconProps) {
  const provider = getProviderFromModelId(modelId)
  const colors = PROVIDER_COLORS[provider]
  const Icon = PROVIDER_ICONS[provider]

  const sizeClasses = {
    sm: 'size-6',
    md: 'size-8',
    lg: 'size-10',
  }

  const iconSizeClasses = {
    sm: 'size-3',
    md: 'size-4',
    lg: 'size-5',
  }

  if (!showBackground) {
    return (
      <Icon className={cn(iconSizeClasses[size], colors.text, className)} />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg border',
        sizeClasses[size],
        colors.bg,
        colors.border,
        className,
      )}
    >
      <Icon className={cn(iconSizeClasses[size], colors.text)} />
    </div>
  )
}

// Credit badge component
interface CreditBadgeProps {
  credits: number
  className?: string
}

export function CreditBadge({ credits, className }: CreditBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        'bg-primary/10 text-primary border border-primary/20',
        className,
      )}
    >
      {credits} cr
    </span>
  )
}

// Provider badge component
interface ProviderBadgeProps {
  modelId: string
  className?: string
}

export function ProviderBadge({ modelId, className }: ProviderBadgeProps) {
  const provider = getProviderFromModelId(modelId)
  const colors = PROVIDER_COLORS[provider]
  const name = PROVIDER_NAMES[provider]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colors.bg,
        colors.text,
        `border ${colors.border}`,
        className,
      )}
    >
      {name}
    </span>
  )
}
