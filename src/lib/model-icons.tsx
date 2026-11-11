/**
 * Provider marks for model pickers — monochrome, like the design sheet
 * (docs/design/mockups/01-design-system.jpg): no brand colours, the mark
 * takes the surrounding text colour.
 *
 * Google, OpenAI and Black Forest Labs get their logo; every other provider
 * gets a lettermark rather than a guessed logo.
 */

import { cn } from '@/lib/utils'

export type ProviderKey =
  | 'google'
  | 'openai'
  | 'flux'
  | 'bytedance'
  | 'recraft'
  | 'krea'
  | 'ideogram'
  | 'minimax'
  | 'kling'
  | 'elevenlabs'
  | 'acestep'
  | 'topaz'
  | 'tencent'
  | 'meshy'
  | 'rodin'
  | 'meta'
  | 'anthropic'
  | 'default'

/** First match wins — order matters where ids overlap */
const MATCHERS: Array<[ProviderKey, RegExp]> = [
  ['google', /nano-banana|google|veo|lyria|gemini/],
  ['openai', /openai|gpt/],
  ['flux', /flux|blackforestlabs/],
  ['bytedance', /bytedance|seedream|seedance|seedvr/],
  ['recraft', /recraft/],
  ['krea', /krea/],
  ['ideogram', /ideogram/],
  ['minimax', /minimax|hailuo/],
  ['kling', /kling/],
  ['elevenlabs', /elevenlabs/],
  ['acestep', /ace-step/],
  ['topaz', /topaz/],
  ['tencent', /hunyuan/],
  ['meshy', /meshy/],
  ['rodin', /rodin|hyper3d/],
  ['meta', /sam3d|sam-3/],
  ['anthropic', /anthropic|claude/],
]

export function getProviderFromModelId(modelId: string): ProviderKey {
  const id = modelId.toLowerCase()
  return MATCHERS.find(([, re]) => re.test(id))?.[0] ?? 'default'
}

export const PROVIDER_NAMES: Record<ProviderKey, string> = {
  google: 'Google',
  openai: 'OpenAI',
  flux: 'Black Forest Labs',
  bytedance: 'ByteDance',
  recraft: 'Recraft',
  krea: 'Krea',
  ideogram: 'Ideogram',
  minimax: 'MiniMax',
  kling: 'Kuaishou',
  elevenlabs: 'ElevenLabs',
  acestep: 'ACE Studio',
  topaz: 'Topaz Labs',
  tencent: 'Tencent',
  meshy: 'Meshy',
  rodin: 'Hyper3D',
  meta: 'Meta',
  anthropic: 'Anthropic',
  default: 'fal',
}

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

/** One or two letters in a rounded square */
function lettermark(letters: string) {
  return function Lettermark({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={cn('size-4', className)}>
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <text
          x="12"
          y="12"
          dy="0.36em"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="inherit"
          fontWeight="700"
          fontSize={letters.length > 1 ? 9.5 : 12}
          letterSpacing="-0.3"
        >
          {letters}
        </text>
      </svg>
    )
  }
}

const PROVIDER_ICONS: Record<ProviderKey, React.FC<IconProps>> = {
  google: GoogleIcon,
  openai: OpenAIIcon,
  flux: FluxIcon,
  bytedance: lettermark('BD'),
  recraft: lettermark('Rc'),
  krea: lettermark('Kr'),
  ideogram: lettermark('Id'),
  minimax: lettermark('MM'),
  kling: lettermark('Kl'),
  elevenlabs: lettermark('11'),
  acestep: lettermark('AS'),
  topaz: lettermark('Tz'),
  tencent: lettermark('Hy'),
  meshy: lettermark('Me'),
  rodin: lettermark('Ro'),
  meta: lettermark('Mt'),
  anthropic: lettermark('A'),
  default: lettermark('f'),
}

/** The provider's mark, sized to sit beside a line of text */
export function ModelIcon({
  modelId,
  className,
}: {
  modelId: string
  className?: string
}) {
  const provider = getProviderFromModelId(modelId)
  const Icon = PROVIDER_ICONS[provider]
  return (
    <span
      role="img"
      aria-label={PROVIDER_NAMES[provider]}
      className="inline-flex shrink-0"
    >
      <Icon className={cn('size-4', className)} />
    </span>
  )
}
