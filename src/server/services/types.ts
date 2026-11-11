/**
 * Shared Types for Cinevido Services
 *
 * This file contains type definitions used across multiple services.
 */

import type { ModelTier, PriceRule } from '../../lib/pricing'

export type { ModelTier, PriceRule } from '../../lib/pricing'

// =============================================================================
// Model Configurations
// =============================================================================
//
// The catalog is curated: per category a Draft (cheap previews), a Workhorse
// (the default) and a Hero (best quality) tier, plus a few specialists.
// Endpoint input fields were checked against each model's OpenAPI schema on
// fal (2026-11-11) — only send what a model's schema declares.

export interface ModelConfig {
  id: string
  name: string
  provider: string
  description?: string
  supportsNumImages?: boolean // Whether model supports generating multiple images
  maxNumImages?: number // Maximum number of images (default 4 if supportsNumImages is true)
  tier?: ModelTier
  pricing?: PriceRule
  supportsSeed?: boolean
  supportsNegativePrompt?: boolean
}

// Extended config for edit models with image capacity info
export interface EditModelConfig extends ModelConfig {
  maxImages: number // Maximum number of reference images (1 = single image only)
}

// Extended config for upscale models with model-specific capabilities
export interface UpscaleModelConfig extends ModelConfig {
  maxScale: number
  supportsTargetResolution?: boolean // SeedVR supports target resolution mode
  topazModels?: Array<string> // Topaz has sub-models for different use cases
}

export const IMAGE_MODELS: Array<ModelConfig> = [
  // === Draft ===
  {
    id: 'blackforestlabs/flux-3/klein/text-to-image',
    name: 'FLUX.3 Klein',
    provider: 'fal',
    description:
      'Black Forest Labs - Fastest and cheapest, for exploring ideas',
    tier: 'draft',
    pricing: { kind: 'perMegapixel', usd: 0.009 },
    supportsNumImages: true,
    maxNumImages: 4,
    supportsSeed: true,
  },
  {
    id: 'minimax/h3-image/highspeed/text-to-image',
    name: 'MiniMax H3 Image Fast',
    provider: 'fal',
    description: 'MiniMax - Quick 2K drafts with prompt expansion',
    tier: 'draft',
    // token-billed by MiniMax; fal publishes no per-image figure
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === Workhorse ===
  {
    id: 'bytedance/seedream/v5/flash/text-to-image',
    name: 'Seedream 5 Flash',
    provider: 'fal',
    description: 'ByteDance - Sharp 2K images at a draft price. The default.',
    tier: 'standard',
    pricing: { kind: 'perImage', usd: 0.027 },
    supportsNumImages: true,
    maxNumImages: 4,
  },
  {
    id: 'minimax/h3-image/text-to-image',
    name: 'MiniMax H3 Image',
    provider: 'fal',
    description: 'MiniMax - Native 2K, strong on people and scenes',
    tier: 'standard',
    supportsNumImages: true,
    maxNumImages: 4,
  },
  {
    id: 'krea/v3/text-to-image',
    name: 'Krea 3',
    provider: 'fal',
    description: 'Krea - Photographic, natural-looking light and texture',
    tier: 'standard',
    pricing: { kind: 'perMegapixel', usd: 0.025 },
    supportsSeed: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'google/nano-banana-2.1',
    name: 'Nano Banana 2.1',
    provider: 'fal',
    description: 'Google - Follows complex prompts, excellent text',
    tier: 'standard',
    pricing: {
      kind: 'perImage',
      usd: 0.04,
      byResolution: { '1K': 0.04, '2K': 0.059, '4K': 0.134 },
    },
    supportsNumImages: true,
    maxNumImages: 4,
    supportsSeed: true,
  },

  // === Hero ===
  {
    id: 'bytedance/seedream/v5/pro/text-to-image',
    name: 'Seedream 5 Pro',
    provider: 'fal',
    description: 'ByteDance - Flagship detail and composition',
    tier: 'hero',
    pricing: { kind: 'perImage', usd: 0.0675 },
    supportsNumImages: true,
    maxNumImages: 4,
  },
  {
    id: 'blackforestlabs/flux-3/text-to-image',
    name: 'FLUX 3',
    provider: 'fal',
    description: 'Black Forest Labs - Photoreal flagship, wide aspect ratios',
    tier: 'hero',
    pricing: { kind: 'perMegapixel', usd: 0.048 },
  },
  {
    id: 'fal-ai/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'fal',
    description: 'Google Gemini 3 Pro - Best reasoning and text rendering',
    tier: 'hero',
    pricing: { kind: 'perImage', usd: 0.15 },
    supportsNumImages: true,
    maxNumImages: 4,
    supportsSeed: true,
  },
  {
    id: 'openai/gpt-image-2.6/sunburst/text-to-image',
    name: 'GPT Image 2.6 Sunburst',
    provider: 'fal',
    description: 'OpenAI - Fine typography and layout, up to "max" quality',
    tier: 'hero',
    // token-billed; low→max quality spans roughly this range per image
    pricing: { kind: 'range', min: 0.01, max: 0.25, per: 'image' },
    supportsNumImages: true,
    maxNumImages: 4,
  },
  {
    id: 'openai/gpt-image-2.6/flare/text-to-image',
    name: 'GPT Image 2.6 Flare',
    provider: 'fal',
    description: "OpenAI - OpenAI's default image model, up to max quality",
    tier: 'hero',
    pricing: { kind: 'range', min: 0.01, max: 0.25, per: 'image' },
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === Specialists ===
  {
    id: 'ideogram/v4.5',
    name: 'Ideogram 4.5',
    provider: 'fal',
    description: 'Posters, logos and anything with lettering',
    pricing: { kind: 'perImage', usd: 0.06 },
    supportsNumImages: true,
    maxNumImages: 4,
    supportsSeed: true,
  },
  {
    id: 'recraft/v4.1/flash/text-to-image',
    name: 'Recraft 4.1 Flash',
    provider: 'fal',
    description: 'Design work - icons, illustration, brand graphics',
    pricing: { kind: 'perImage', usd: 0.007 },
  },
]

// =============================================================================
// Model-specific Options
// =============================================================================

// GPT Image quality tiers
export const GPT_IMAGE_QUALITY_TIERS = [
  { id: 'low', name: 'Low', description: 'Fast drafts' },
  { id: 'medium', name: 'Medium', description: 'Balanced quality' },
  { id: 'high', name: 'High', description: 'Best quality' },
] as const

// GPT Image 2.5 (Flare + Sunburst) adds auto plus two tiers above high
export const GPT_IMAGE_25_QUALITY_TIERS = [
  { id: 'auto', name: 'Auto', description: 'Model decides' },
  ...GPT_IMAGE_QUALITY_TIERS,
  { id: 'xhigh', name: 'X-High', description: 'Extra detail, slower' },
  { id: 'max', name: 'Max', description: 'Maximum detail, slowest' },
] as const

export type GptImageQuality =
  | 'auto'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

export const GPT_IMAGE_QUALITY_VALUES = [
  'auto',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

// Any GPT Image text-to-image model (2.6 Flare, 2.6 Sunburst)
export function isGptImageModel(modelId: string): boolean {
  return (
    modelId === 'openai/gpt-image-2.6/flare/text-to-image' ||
    modelId === 'openai/gpt-image-2.6/sunburst/text-to-image'
  )
}

// Any GPT Image edit model (2.6 Flare, 2.6 Sunburst)
export function isGptImageEditModel(modelId: string): boolean {
  return (
    modelId === 'openai/gpt-image-2.6/flare/edit' ||
    modelId === 'openai/gpt-image-2.6/sunburst/edit'
  )
}

// Quality tiers offered by a given GPT Image model (create or edit).
// Every GPT Image model we offer (2.6) takes auto, low…high, xhigh and max.
export function gptImageQualityTiers(_modelId: string) {
  return GPT_IMAGE_25_QUALITY_TIERS
}

// Clamp a quality to one the model accepts (falls back to 'high')
export function clampGptImageQuality(
  modelId: string,
  quality: GptImageQuality | undefined,
): GptImageQuality {
  const tiers = gptImageQualityTiers(modelId)
  return quality && tiers.some((t) => t.id === quality) ? quality : 'high'
}

// GPT Image 2 output formats
export const GPT_IMAGE_OUTPUT_FORMATS = [
  { id: 'png', name: 'PNG', description: 'Lossless, larger file' },
  { id: 'jpeg', name: 'JPEG', description: 'Smaller file, lossy' },
  { id: 'webp', name: 'WebP', description: 'Modern, efficient' },
] as const

export type GptImageOutputFormat = 'png' | 'jpeg' | 'webp'

// GPT Image 2 size presets (matches fal.ai ImageSize enum)
export const GPT_IMAGE_SIZE_PRESETS = [
  { id: 'square_hd', name: 'Square HD', aspect: '1:1' },
  { id: 'square', name: 'Square', aspect: '1:1' },
  { id: 'landscape_4_3', name: 'Landscape 4:3', aspect: '4:3' },
  { id: 'landscape_16_9', name: 'Landscape 16:9', aspect: '16:9' },
  { id: 'portrait_4_3', name: 'Portrait 4:3', aspect: '3:4' },
  { id: 'portrait_16_9', name: 'Portrait 16:9', aspect: '9:16' },
] as const

export type GptImageSizePreset =
  | 'square_hd'
  | 'square'
  | 'landscape_4_3'
  | 'landscape_16_9'
  | 'portrait_4_3'
  | 'portrait_16_9'

// For edits, fal also accepts 'auto' which lets the model choose
export type GptImageEditSizePreset = GptImageSizePreset | 'auto'

// GPT Image 2 custom-dimension constraints (per fal.ai docs)
export const GPT_IMAGE_CUSTOM_SIZE_LIMITS = {
  multipleOf: 16,
  maxEdge: 3840,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  maxAspect: 3, // longest / shortest must be <= 3
} as const

// Snap a dimension to the nearest multiple of 16 within [16, maxEdge]
export function snapGptImageDim(value: number): number {
  const { multipleOf, maxEdge } = GPT_IMAGE_CUSTOM_SIZE_LIMITS
  const rounded = Math.round(value / multipleOf) * multipleOf
  return Math.max(multipleOf, Math.min(maxEdge, rounded))
}

// Validate a custom {width,height} pair against GPT Image 2 constraints.
// Returns null if valid, or a short human-readable error string.
export function validateGptImageCustomSize(
  width: number,
  height: number,
): string | null {
  const { multipleOf, maxEdge, minPixels, maxPixels, maxAspect } =
    GPT_IMAGE_CUSTOM_SIZE_LIMITS
  if (!Number.isFinite(width) || !Number.isFinite(height))
    return 'Width and height required'
  if (width % multipleOf !== 0 || height % multipleOf !== 0)
    return `Must be multiples of ${multipleOf}`
  if (width > maxEdge || height > maxEdge) return `Max ${maxEdge}px per side`
  const pixels = width * height
  if (pixels < minPixels) return 'Too small (min ~0.66MP)'
  if (pixels > maxPixels) return 'Too large (max ~8.3MP)'
  const ratio = Math.max(width, height) / Math.min(width, height)
  if (ratio > maxAspect) return `Aspect ratio must be ≤ ${maxAspect}:1`
  return null
}

// Map our aspect-ratio UI strings to gpt-image-2 size presets
export function aspectRatioToGptImageSize(aspect: string): GptImageSizePreset {
  switch (aspect) {
    case '1:1':
      return 'square_hd'
    case '4:3':
      return 'landscape_4_3'
    case '16:9':
      return 'landscape_16_9'
    case '3:4':
      return 'portrait_4_3'
    case '9:16':
      return 'portrait_16_9'
    default:
      return 'square_hd'
  }
}

// Recraft V3 style options
export const RECRAFT_STYLES = [
  {
    id: 'realistic_image',
    name: 'Realistic',
    description: 'Photorealistic images',
  },
  {
    id: 'digital_illustration',
    name: 'Digital Art',
    description: 'Digital illustrations',
  },
  {
    id: 'vector_illustration',
    name: 'Vector',
    description: 'Scalable vector graphics (2x cost)',
  },
] as const

export type RecraftStyle =
  | 'realistic_image'
  | 'digital_illustration'
  | 'vector_illustration'

// Image editing models (prompt-based AI editing)
// These models edit images via natural language prompts - no masks required
export const EDIT_MODELS: Array<EditModelConfig> = [
  // === Draft ===
  {
    id: 'bytedance/seedream/v5/flash/edit',
    name: 'Seedream 5 Flash',
    provider: 'fal',
    maxImages: 10,
    description: 'ByteDance - Fast, cheap multi-image edits',
    tier: 'draft',
    pricing: { kind: 'perImage', usd: 0.027 },
  },

  // === Workhorse ===
  {
    id: 'google/nano-banana-2.1/edit',
    name: 'Nano Banana 2.1',
    provider: 'fal',
    maxImages: 10,
    description:
      'Google - Precise edits that keep everything else intact. The default.',
    tier: 'standard',
    pricing: {
      kind: 'perImage',
      usd: 0.044,
      byResolution: { '1K': 0.044, '2K': 0.063, '4K': 0.138 },
    },
    supportsSeed: true,
  },
  {
    id: 'blackforestlabs/flux-3/edit-image',
    name: 'FLUX 3 Edit',
    provider: 'fal',
    maxImages: 10,
    description: 'Black Forest Labs - Photoreal edits, multi-reference',
    tier: 'standard',
    pricing: { kind: 'perMegapixel', usd: 0.048 },
  },
  {
    id: 'krea/v3/edit',
    name: 'Krea 3 Edit',
    provider: 'fal',
    maxImages: 8,
    description: 'Krea - Natural light and texture, keeps the photo look',
    tier: 'standard',
    pricing: { kind: 'perMegapixel', usd: 0.025 },
    supportsSeed: true,
  },
  {
    id: 'minimax/h3-image/edit',
    name: 'MiniMax H3 Image',
    provider: 'fal',
    maxImages: 16,
    description: 'MiniMax - Up to 16 references, strong on people',
    tier: 'standard',
  },

  // === Hero ===
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    provider: 'fal',
    maxImages: 14,
    description: 'Google Gemini 3 Pro - Best multi-image composition',
    tier: 'hero',
    pricing: { kind: 'perImage', usd: 0.15 },
    supportsSeed: true,
  },
  {
    id: 'bytedance/seedream/v5/pro/edit',
    name: 'Seedream 5 Pro',
    provider: 'fal',
    maxImages: 10,
    description: 'ByteDance - Flagship multi-source composition',
    tier: 'hero',
    pricing: { kind: 'perImage', usd: 0.0675 },
  },
  {
    id: 'openai/gpt-image-2.6/sunburst/edit',
    name: 'GPT Image 2.6 Sunburst',
    provider: 'fal',
    maxImages: 16,
    description: 'OpenAI - Up to 16 refs, fine typography, "max" quality',
    tier: 'hero',
    pricing: { kind: 'range', min: 0.01, max: 0.25, per: 'image' },
  },
  {
    id: 'openai/gpt-image-2.6/flare/edit',
    name: 'GPT Image 2.6 Flare',
    provider: 'fal',
    maxImages: 16,
    description: 'OpenAI - Up to 16 refs, "max" quality tier',
    tier: 'hero',
    pricing: { kind: 'range', min: 0.01, max: 0.25, per: 'image' },
  },
]

// Topaz model options for different enhancement types
export const TOPAZ_MODELS = [
  {
    id: 'Standard V2',
    name: 'Standard V2',
    description: 'General purpose enhancement',
  },
  {
    id: 'Low Resolution V2',
    name: 'Low Resolution V2',
    description: 'For very low quality sources',
  },
  {
    id: 'High Fidelity V2',
    name: 'High Fidelity V2',
    description: 'Maximum detail preservation',
  },
  { id: 'CGI', name: 'CGI', description: 'Optimized for CGI/3D renders' },
  {
    id: 'Text Refine',
    name: 'Text Refine',
    description: 'Best for images with text',
  },
  {
    id: 'Recovery',
    name: 'Recovery',
    description: 'For heavily degraded images',
  },
  {
    id: 'Recovery V2',
    name: 'Recovery V2',
    description: 'Improved recovery algorithm',
  },
  { id: 'Redefine', name: 'Redefine', description: 'Add AI-generated details' },
] as const

export type TopazModelType = (typeof TOPAZ_MODELS)[number]['id']

// SeedVR target resolution options
export const SEEDVR_TARGET_RESOLUTIONS = [
  { id: '720p', name: '720p', description: '1280x720' },
  { id: '1080p', name: '1080p', description: '1920x1080' },
  { id: '1440p', name: '1440p', description: '2560x1440' },
  { id: '2160p', name: '2160p (4K)', description: '3840x2160' },
] as const

export type SeedvrTargetResolution =
  (typeof SEEDVR_TARGET_RESOLUTIONS)[number]['id']

// SeedVR video output format options
export const SEEDVR_VIDEO_OUTPUT_FORMATS = [
  { id: 'X264 (.mp4)', name: 'MP4 (H.264)', description: 'Most compatible' },
  { id: 'VP9 (.webm)', name: 'WebM (VP9)', description: 'Web optimized' },
  {
    id: 'PRORES4444 (.mov)',
    name: 'ProRes 4444',
    description: 'Professional editing',
  },
  { id: 'GIF (.gif)', name: 'GIF', description: 'Animated image' },
] as const

export type SeedvrVideoOutputFormat =
  (typeof SEEDVR_VIDEO_OUTPUT_FORMATS)[number]['id']

// SeedVR video output quality options
export const SEEDVR_VIDEO_OUTPUT_QUALITIES = [
  { id: 'low', name: 'Low', description: 'Smallest file size' },
  { id: 'medium', name: 'Medium', description: 'Balanced' },
  { id: 'high', name: 'High', description: 'Good quality' },
  { id: 'maximum', name: 'Maximum', description: 'Best quality' },
] as const

export type SeedvrVideoOutputQuality =
  (typeof SEEDVR_VIDEO_OUTPUT_QUALITIES)[number]['id']

// Bytedance video target resolution options
export const BYTEDANCE_VIDEO_TARGET_RESOLUTIONS = [
  { id: '1080p', name: '1080p', description: '1920x1080' },
  { id: '2k', name: '2K', description: '2560x1440' },
  { id: '4k', name: '4K', description: '3840x2160' },
] as const

export type BytedanceVideoTargetResolution =
  (typeof BYTEDANCE_VIDEO_TARGET_RESOLUTIONS)[number]['id']

// Bytedance video target FPS options
export const BYTEDANCE_VIDEO_TARGET_FPS = [
  { id: '30fps', name: '30 FPS', description: 'Standard' },
  { id: '60fps', name: '60 FPS', description: 'Smooth motion' },
] as const

export type BytedanceVideoTargetFps =
  (typeof BYTEDANCE_VIDEO_TARGET_FPS)[number]['id']

// Upscaling models
export const UPSCALE_MODELS: Array<UpscaleModelConfig> = [
  {
    id: 'fal-ai/seedvr/upscale/image',
    name: 'SeedVR2',
    provider: 'fal',
    description: 'AI upscaling up to 10x with target resolution mode',
    tier: 'standard',
    // billed on output megapixels
    pricing: { kind: 'perMegapixel', usd: 0.001 },
    maxScale: 10,
    supportsTargetResolution: true,
  },
  {
    id: 'fal-ai/topaz/upscale/image',
    name: 'Topaz',
    provider: 'fal',
    description: 'Professional enhancement with face recovery',
    tier: 'hero',
    pricing: { kind: 'perMegapixel', usd: 0.01 },
    maxScale: 4,
    topazModels: TOPAZ_MODELS.map((m) => m.id),
  },
]

// =============================================================================
// Video Model Configuration
// =============================================================================

export type VideoCapability = 'text-to-video' | 'image-to-video' | 'keyframes'

export interface VideoModelConfig extends ModelConfig {
  capabilities: Array<VideoCapability>
  // Different endpoints for different modes (some models have separate endpoints)
  endpoints?: {
    textToVideo?: string
    imageToVideo?: string
    keyframes?: string
  }
  // Model-specific parameters
  durations: Array<number> // Available duration options in seconds
  aspectRatios?: Array<string> // e.g., ['16:9', '9:16', '1:1']
  resolutions?: Array<string> // e.g., ['720p', '1080p', '4k']
  /** the endpoint's own default (from its fal schema) — what `pricing.usd` is quoted at */
  defaultResolution?: string
  supportsAudio?: boolean // Native audio generation
  supportsEndFrame?: boolean // For I2V models that support end frame (keyframes)
  // Field name mappings (models use different field names)
  fieldMappings?: {
    imageUrl?: string // 'image_url' | 'start_image_url' | 'first_frame_url'
    endImageUrl?: string // 'end_image_url' | 'last_frame_url' | 'tail_image_url'
  }
}

export const VIDEO_MODELS: Array<VideoModelConfig> = [
  // Order matters: the first model offered for a mode is that mode's default,
  // so each mode leads with its Workhorse. Pickers group by tier for display.
  //
  // Prices are per second at the endpoint's DEFAULT resolution (we do not send
  // one unless the user picks it). MiniMax rates are fal's standard rates from
  // 2026-11-16; fal's API may show a temporary promotional rate before that.

  // =============================================================================
  // Kling 4.0 - Kuaishou
  // =============================================================================
  {
    id: 'kling/v4/flash/text-to-video',
    name: 'Kling 4.0 Flash',
    provider: 'fal',
    description:
      'Kling 4.0 Flash - Fast, reliable motion at 720p. The default.',
    tier: 'standard',
    pricing: { kind: 'perSecond', usd: 0.094 },
    capabilities: ['text-to-video'],
    durations: [5, 8, 10, 15, 20],
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['720p'],
    defaultResolution: '720p',
  },
  {
    id: 'kling/v4/flash/image-to-video',
    name: 'Kling 4.0 Flash',
    provider: 'fal',
    description:
      'Kling 4.0 Flash - Animate a still, fast and affordable. The default.',
    tier: 'standard',
    pricing: { kind: 'perSecond', usd: 0.094 },
    capabilities: ['image-to-video'],
    durations: [5, 8, 10, 15, 20],
    resolutions: ['720p'],
    defaultResolution: '720p',
    fieldMappings: { imageUrl: 'start_image_url' },
  },
  {
    id: 'kling/v4/text-to-video',
    name: 'Kling 4.0',
    provider: 'fal',
    description: 'Kling 4.0 - Flagship motion and physics, 1080p, up to 30s',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.235,
      byResolution: { '720p': 0.157, '1080p': 0.235 },
    },
    capabilities: ['text-to-video'],
    durations: [5, 8, 10, 15, 20, 30],
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
  },
  {
    id: 'kling/v4/image-to-video',
    name: 'Kling 4.0',
    provider: 'fal',
    description:
      'Kling 4.0 - Flagship image-to-video with an optional end frame',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.235,
      byResolution: { '720p': 0.157, '1080p': 0.235 },
    },
    capabilities: ['image-to-video', 'keyframes'],
    durations: [5, 8, 10, 15, 20, 30],
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsEndFrame: true,
    fieldMappings: {
      imageUrl: 'start_image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // Gemini Omni Flash 1.2 - Google (cheapest usable drafts)
  // =============================================================================
  {
    id: 'google/gemini-omni-flash/v1.2/text-to-video',
    name: 'Gemini Omni Flash',
    provider: 'fal',
    description:
      'Google - Cheap, quick drafts to check an idea before the real render',
    tier: 'draft',
    pricing: {
      kind: 'perSecond',
      usd: 0.0819,
      byResolution: {
        '360p': 0.0273,
        '720p': 0.0819,
        '1080p': 0.1229,
        '4k': 0.2457,
      },
    },
    capabilities: ['text-to-video'],
    durations: [4, 6, 8, 10, 15],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['360p', '720p', '1080p', '4k'],
    defaultResolution: '720p',
  },
  {
    id: 'google/gemini-omni-flash/v1.2/image-to-video',
    name: 'Gemini Omni Flash',
    provider: 'fal',
    description:
      'Google - Cheap image-to-video drafts with an optional end frame',
    tier: 'draft',
    pricing: {
      kind: 'perSecond',
      usd: 0.0819,
      byResolution: {
        '360p': 0.0273,
        '720p': 0.0819,
        '1080p': 0.1229,
        '4k': 0.2457,
      },
    },
    capabilities: ['image-to-video', 'keyframes'],
    durations: [4, 6, 8, 10, 15],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['360p', '720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsEndFrame: true,
    fieldMappings: {
      imageUrl: 'image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // MiniMax H3 - Max and Max Turbo
  // =============================================================================
  {
    id: 'minimax/h3-max-turbo/text-to-video',
    name: 'MiniMax H3 Turbo',
    provider: 'fal',
    description: 'MiniMax H3 Max Turbo - Very cheap, fast 768P drafts',
    tier: 'draft',
    pricing: {
      kind: 'perSecond',
      usd: 0.04,
      byResolution: { '480P': 0.025, '768P': 0.04, '1080P': 0.08 },
    },
    capabilities: ['text-to-video'],
    durations: [5, 6, 8, 10, 15],
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['480P', '768P', '1080P'],
    defaultResolution: '768P',
    supportsSeed: true,
  },
  {
    id: 'minimax/h3-max-turbo/image-to-video',
    name: 'MiniMax H3 Turbo',
    provider: 'fal',
    description: 'MiniMax H3 Max Turbo - Fast I2V with optional end frame',
    tier: 'draft',
    pricing: {
      kind: 'perSecond',
      usd: 0.04,
      byResolution: { '480P': 0.025, '768P': 0.04, '1080P': 0.08 },
    },
    capabilities: ['image-to-video', 'keyframes'],
    durations: [5, 6, 8, 10, 15],
    resolutions: ['480P', '768P', '1080P'],
    defaultResolution: '768P',
    supportsEndFrame: true,
    supportsSeed: true,
    fieldMappings: {
      imageUrl: 'image_url',
      endImageUrl: 'end_image_url',
    },
  },
  {
    id: 'minimax/h3-max/text-to-video',
    name: 'MiniMax H3 Max',
    provider: 'fal',
    description: 'MiniMax H3 Max - Expressive people and camera work',
    tier: 'standard',
    pricing: {
      kind: 'perSecond',
      usd: 0.08,
      byResolution: { '480P': 0.05, '768P': 0.08, '1080P': 0.16 },
    },
    capabilities: ['text-to-video'],
    durations: [5, 6, 8, 10, 15],
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['480P', '768P', '1080P'],
    defaultResolution: '768P',
    supportsSeed: true,
  },
  {
    id: 'minimax/h3-max/image-to-video',
    name: 'MiniMax H3 Max',
    provider: 'fal',
    description: 'MiniMax H3 Max - Expressive I2V with optional end frame',
    tier: 'standard',
    pricing: {
      kind: 'perSecond',
      usd: 0.08,
      byResolution: { '480P': 0.05, '768P': 0.08, '1080P': 0.16 },
    },
    capabilities: ['image-to-video', 'keyframes'],
    durations: [5, 6, 8, 10, 15],
    resolutions: ['480P', '768P', '1080P'],
    defaultResolution: '768P',
    supportsEndFrame: true,
    supportsSeed: true,
    fieldMappings: {
      imageUrl: 'image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // Seedance 2.5 - ByteDance (premium, native audio)
  // =============================================================================
  {
    id: 'bytedance/seedance-2.5/us/text-to-video',
    name: 'Seedance 2.5',
    provider: 'fal',
    description:
      'ByteDance - Cinematic multi-shot video with native audio, up to 30s',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.473,
      byResolution: { '480p': 0.2205, '720p': 0.473, '1080p': 1.164 },
    },
    capabilities: ['text-to-video'],
    durations: [5, 8, 10, 15, 20, 30],
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: true,
  },
  {
    id: 'bytedance/seedance-2.5/us/image-to-video',
    name: 'Seedance 2.5',
    provider: 'fal',
    description:
      'ByteDance - Cinematic I2V with native audio and an optional end frame',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.473,
      byResolution: { '480p': 0.2205, '720p': 0.473, '1080p': 1.164 },
    },
    capabilities: ['image-to-video', 'keyframes'],
    durations: [5, 8, 10, 15, 20, 30],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsEndFrame: true,
    fieldMappings: {
      imageUrl: 'image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // Veo 3.1 - Google (premium, native audio)
  // =============================================================================
  {
    id: 'fal-ai/veo3.1/fast',
    name: 'Veo 3.1 Fast',
    provider: 'fal',
    description: 'Google Veo 3.1 Fast - Quicker generation, with audio',
    tier: 'standard',
    pricing: {
      kind: 'perSecond',
      usd: 0.15,
      byResolution: { '4k': 0.35 },
      noAudio: { usd: 0.1, byResolution: { '4k': 0.3 } },
    },
    capabilities: ['text-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/veo3.1/fast/image-to-video',
    name: 'Veo 3.1 Fast',
    provider: 'fal',
    description: 'Google Veo 3.1 Fast image-to-video, with audio',
    tier: 'standard',
    pricing: {
      kind: 'perSecond',
      usd: 0.15,
      byResolution: { '4k': 0.35 },
      noAudio: { usd: 0.1, byResolution: { '4k': 0.3 } },
    },
    capabilities: ['image-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
    fieldMappings: { imageUrl: 'image_url' },
  },
  {
    id: 'fal-ai/veo3.1',
    name: 'Veo 3.1',
    provider: 'fal',
    description: 'Google Veo 3.1 - Most polished, with audio',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.4,
      byResolution: { '4k': 0.6 },
      noAudio: { usd: 0.2, byResolution: { '4k': 0.4 } },
    },
    capabilities: ['text-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
  },
  {
    id: 'fal-ai/veo3.1/image-to-video',
    name: 'Veo 3.1',
    provider: 'fal',
    description: 'Google Veo 3.1 image-to-video with audio',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.4,
      byResolution: { '4k': 0.6 },
      noAudio: { usd: 0.2, byResolution: { '4k': 0.4 } },
    },
    capabilities: ['image-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
    fieldMappings: { imageUrl: 'image_url' },
  },
  {
    id: 'fal-ai/veo3.1/first-last-frame-to-video',
    name: 'Veo 3.1 Keyframes',
    provider: 'fal',
    description: 'Google Veo 3.1 first+last frame to video, with audio',
    tier: 'hero',
    pricing: {
      kind: 'perSecond',
      usd: 0.4,
      byResolution: { '4k': 0.6 },
      noAudio: { usd: 0.2, byResolution: { '4k': 0.4 } },
    },
    capabilities: ['keyframes'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
    fieldMappings: {
      imageUrl: 'first_frame_url',
      endImageUrl: 'last_frame_url',
    },
  },
]

// Helper to get video models by capability
export function getVideoModelsByCapability(
  capability: VideoCapability,
): Array<VideoModelConfig> {
  return VIDEO_MODELS.filter((m) => m.capabilities.includes(capability))
}

// Helper to get a video model config by ID
export function getVideoModelById(
  modelId: string,
): VideoModelConfig | undefined {
  return VIDEO_MODELS.find((m) => m.id === modelId)
}

export const AUDIO_MODELS: Array<ModelConfig> = [
  {
    id: 'elevenlabs/tts/eleven-v4',
    name: 'Eleven v4',
    provider: 'fal',
    description: 'ElevenLabs v4 - Most expressive voices, word timestamps',
    tier: 'hero',
    pricing: { kind: 'perKChars', usd: 0.08 },
  },
  {
    id: 'elevenlabs/tts/eleven-v4-turbo',
    name: 'Eleven v4 Turbo',
    provider: 'fal',
    description: 'ElevenLabs v4 Turbo - Half the price, lower latency',
    tier: 'standard',
    pricing: { kind: 'perKChars', usd: 0.04 },
  },
]

/**
 * The voices the Voice tab offers. fal's ElevenLabs endpoints take a premade
 * voice by name; these are the names in eleven-v4's schema (`voice` examples)
 * plus Rachel (its default) and Adam (the Director's male narrator).
 */
export const TTS_VOICES: ReadonlyArray<{ name: string; description: string }> =
  [
    { name: 'Rachel', description: 'Female · default' },
    { name: 'Aria', description: 'Female' },
    { name: 'Sarah', description: 'Female' },
    { name: 'Laura', description: 'Female' },
    { name: 'Charlotte', description: 'Female' },
    { name: 'Alice', description: 'Female · British' },
    { name: 'Matilda', description: 'Female' },
    { name: 'Jessica', description: 'Female' },
    { name: 'Lily', description: 'Female · British' },
    { name: 'River', description: 'Neutral' },
    { name: 'Adam', description: 'Male' },
    { name: 'Roger', description: 'Male' },
    { name: 'Charlie', description: 'Male · Australian' },
    { name: 'George', description: 'Male · British' },
    { name: 'Callum', description: 'Male' },
    { name: 'Liam', description: 'Male' },
    { name: 'Will', description: 'Male' },
    { name: 'Eric', description: 'Male' },
    { name: 'Chris', description: 'Male' },
    { name: 'Brian', description: 'Male' },
    { name: 'Daniel', description: 'Male · British' },
    { name: 'Bill', description: 'Male' },
  ]

// =============================================================================
// Sound-effect Models (text-to-SFX via fal.ai)
// =============================================================================

export interface SfxModelConfig extends ModelConfig {
  /** the engine's length range; no duration = it picks one from the prompt */
  minDurationSec: number
  maxDurationSec: number
  /** the prompt's max length in characters */
  maxPromptChars: number
  supportsLoop: boolean
}

export const SFX_MODELS: Array<SfxModelConfig> = [
  {
    id: 'elevenlabs/sound-effects/v3',
    name: 'ElevenLabs Sound Effects v3',
    provider: 'fal',
    description:
      'Foley, ambience and trailer hits from a description, 0.5–30s, optionally seamless loops.',
    pricing: { kind: 'perSecond', usd: 0.002 },
    minDurationSec: 0.5,
    maxDurationSec: 30,
    maxPromptChars: 450,
    supportsLoop: true,
  },
]

export function getSfxModelById(modelId: string): SfxModelConfig | undefined {
  return SFX_MODELS.find((m) => m.id === modelId)
}

// =============================================================================
// Music Models (text-to-music via fal.ai)
// =============================================================================

/**
 * What a music engine actually takes. The lab reads these flags to decide
 * which controls to show, so a model that cannot sing never shows a lyrics
 * box and a model with a fixed length never shows a duration slider.
 */
export interface MusicModelConfig extends ModelConfig {
  /** 'tags' = comma-separated genre tags (ACE-Step), 'prompt' = prose */
  promptStyle: 'tags' | 'prompt'
  supportsLyrics: boolean
  /** the engine takes lyrics and will not run without them (MiniMax) */
  requiresLyrics?: boolean
  supportsInstrumental: boolean
  supportsSeed: boolean
  supportsNegativePrompt: boolean
  /**
   * How the output's length is chosen:
   *   'slider' — we send a duration and the engine honours it
   *   'cap'    — we send a duration the engine treats as an upper bound
   *   'model'  — the engine takes no duration at all; it decides
   */
  durationMode: 'slider' | 'cap' | 'model'
  minDurationSec?: number
  /** the engine's ceiling — for 'model' engines this is documentation only */
  maxDurationSec?: number
  defaultDurationSec: number
}

export const MUSIC_MODELS: Array<MusicModelConfig> = [
  {
    id: 'fal-ai/ace-step',
    name: 'ACE-Step',
    provider: 'fal',
    description:
      'Genre tags + lyrics, any length up to 4 minutes. The cheapest way to draft a track.',
    tier: 'draft',
    pricing: { kind: 'perSecond', usd: 0.0002 },
    promptStyle: 'tags',
    supportsLyrics: true,
    supportsInstrumental: true,
    supportsSeed: true,
    supportsNegativePrompt: false,
    durationMode: 'slider',
    minDurationSec: 10,
    maxDurationSec: 240,
    defaultDurationSec: 60,
  },
  {
    id: 'minimax/music-3',
    name: 'MiniMax Music 3',
    provider: 'fal',
    description:
      'Full songs up to 5 minutes from a description plus your lyrics. Needs words — it will not run instrumental.',
    tier: 'standard',
    pricing: { kind: 'perSecond', usd: 0.002 },
    promptStyle: 'prompt',
    supportsLyrics: true,
    requiresLyrics: true,
    supportsInstrumental: false,
    supportsSeed: true,
    supportsNegativePrompt: false,
    // `duration` is an upper bound: the model may resolve the song earlier
    durationMode: 'cap',
    minDurationSec: 10,
    maxDurationSec: 300,
    defaultDurationSec: 90,
  },
  {
    id: 'elevenlabs/music/v2.5',
    name: 'ElevenLabs Music v2.5',
    provider: 'fal',
    description:
      'Prose prompt, studio quality, 3s-10min, with a hard instrumental switch.',
    tier: 'hero',
    pricing: { kind: 'perMinute', usd: 0.6 },
    promptStyle: 'prompt',
    supportsLyrics: false,
    supportsInstrumental: true,
    supportsSeed: false,
    supportsNegativePrompt: false,
    durationMode: 'slider',
    minDurationSec: 3,
    maxDurationSec: 600,
    defaultDurationSec: 60,
  },
  {
    id: 'google/lyria-3.5',
    name: 'Lyria 3.5',
    provider: 'fal',
    description:
      "Google's model — one prose prompt, no knobs. Writes and sings its own words, up to 3 minutes of 44.1kHz MP3.",
    tier: 'standard',
    pricing: { kind: 'flat', usd: 0.1 },
    promptStyle: 'prompt',
    supportsLyrics: false,
    supportsInstrumental: false,
    supportsSeed: false,
    supportsNegativePrompt: false,
    // the endpoint takes no duration field at all
    durationMode: 'model',
    maxDurationSec: 180,
    defaultDurationSec: 180,
  },
]

export function getMusicModelById(
  modelId: string,
): MusicModelConfig | undefined {
  return MUSIC_MODELS.find((m) => m.id === modelId)
}

export function getDefaultMusicModel(): MusicModelConfig {
  return MUSIC_MODELS[0]
}

/**
 * The models the Director can run on, reached through fal's OpenRouter proxy
 * (`services/openrouter.server.ts`). Ids are OpenRouter slugs; every one below
 * was verified to resolve against the live endpoint. Ordered best-tool-use
 * first — MODELS[0] is what a caller with no preference gets.
 */
export const LLM_MODELS: Array<ModelConfig> = [
  {
    id: 'anthropic/claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'openrouter',
    description:
      'Best at multi-step tool use — the safest choice for driving the timeline.',
  },
  {
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'openrouter',
    description: 'Nearly as capable at a third of the price. The value pick.',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    provider: 'openrouter',
    description: "OpenAI's flagship, if you prefer its phrasing.",
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    description: 'Long context and strong reasoning.',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'openrouter',
    description: 'Fast and cheap; fine for chat, weaker at long tool chains.',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    description: 'The cheapest option — pennies per hundred messages.',
  },
]

// =============================================================================
// Generation Job Types
// =============================================================================

export type JobType =
  | 'image'
  | 'video'
  | 'audio'
  | 'render'
  | 'edit'
  | 'upscale'
  | 'video-upscale'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface GenerationJobInput {
  // Common fields
  prompt?: string

  // Image generation
  width?: number
  height?: number
  numImages?: number

  // Video generation
  imageUrl?: string
  duration?: number // seconds

  // Audio generation
  text?: string
  voiceId?: string

  // Render
  projectId?: string
  manifest?: string
}

export interface GenerationJobOutput {
  url?: string
  urls?: Array<string>
  assetId?: string
  metadata?: Record<string, unknown>
  error?: string
}

// =============================================================================
// Project Manifest Types (The DNA of a video)
// =============================================================================

/**
 * The manifest lives in `src/remotion/types.ts` — the composition renders it,
 * the timeline edits it and the server stores it, so there is exactly one
 * definition. This file re-exports it so server code can keep importing from
 * the services barrel. `VideoClip`/`AudioClip`/`ComponentOverlay` are the
 * legacy v1 clip shapes, kept only for reading documents written before v2.
 */
export type {
  ProjectManifest,
  ManifestTrack,
  ManifestClip,
  TrackKind,
  ClipKind,
  LegacyProjectManifest,
  WordTimestampProps as WordTimestamp,
  ClipEffectProps as ClipEffect,
  TransitionType,
  VideoClipProps as VideoClip,
  AudioClipProps as AudioClip,
  ComponentOverlayProps as ComponentOverlay,
} from '../../remotion/types'

export {
  MANIFEST_VERSION,
  BASE_TRACKS,
  TRACK_CODE,
  createEmptyManifest,
  createTrack,
  migrateManifest,
  withBaseLanes,
  newId,
  trackEndFrame,
  sequenceEndFrame,
  clipCount,
  allClips,
  tracksOfKind,
  findClip,
  trackCode,
  trackKindForAsset,
  clipKindForAsset,
  clipHasAudio,
  mapTrack,
  addClip,
  appendClip,
  updateClip,
  removeClip,
  splitClipAt,
  formatTimecode,
  formatDuration,
} from '../../remotion/types'

// =============================================================================
// Helper Functions
// =============================================================================

export function getModelById(
  modelId: string,
  modelList: Array<ModelConfig>,
): ModelConfig | undefined {
  return modelList.find((m) => m.id === modelId)
}

export function getDefaultImageModel(): ModelConfig {
  return (
    IMAGE_MODELS.find((m) => m.id === DEFAULT_MODELS.image) || IMAGE_MODELS[0]
  )
}

export function getDefaultVideoModel(): VideoModelConfig {
  return VIDEO_MODELS[0]
}

export function getDefaultTextToVideoModel(): VideoModelConfig {
  return getVideoModelsByCapability('text-to-video')[0] || VIDEO_MODELS[0]
}

export function getDefaultImageToVideoModel(): VideoModelConfig {
  return getVideoModelsByCapability('image-to-video')[0] || VIDEO_MODELS[0]
}

export function getDefaultKeyframesModel(): VideoModelConfig {
  return getVideoModelsByCapability('keyframes')[0] || VIDEO_MODELS[0]
}

export function getDefaultLlmModel(): ModelConfig {
  return LLM_MODELS[0]
}

export function getDefaultAudioModel(): ModelConfig {
  return AUDIO_MODELS[0]
}

export function getDefaultEditModel(): EditModelConfig {
  return EDIT_MODELS.find((m) => m.id === DEFAULT_MODELS.edit) || EDIT_MODELS[0]
}

export function getEditModelById(modelId: string): EditModelConfig | undefined {
  return EDIT_MODELS.find((m) => m.id === modelId)
}

export function getDefaultUpscaleModel(): UpscaleModelConfig {
  return UPSCALE_MODELS[0]
}

export function getUpscaleModelById(
  modelId: string,
): UpscaleModelConfig | undefined {
  return UPSCALE_MODELS.find((m) => m.id === modelId)
}

// =============================================================================
// Video Upscale Model Configuration
// =============================================================================

export interface VideoUpscaleModelConfig extends ModelConfig {
  maxScale?: number
  supportsTargetResolution?: boolean
  supportsFrameInterpolation?: boolean
  targetResolutions?: Array<string>
  outputFormats?: Array<string>
}

export const VIDEO_UPSCALE_MODELS: Array<VideoUpscaleModelConfig> = [
  {
    id: 'fal-ai/seedvr/upscale/video',
    name: 'SeedVR2',
    provider: 'fal',
    description: 'Temporal consistency, flexible output formats',
    tier: 'standard',
    // fal: $0.001 per megapixel of output, counted width × height × frames
    pricing: { kind: 'perMegapixel', usd: 0.001 },
    maxScale: 10,
    supportsTargetResolution: true,
    outputFormats: SEEDVR_VIDEO_OUTPUT_FORMATS.map((f) => f.id),
  },
  {
    id: 'fal-ai/topaz/upscale/video',
    name: 'Topaz',
    provider: 'fal',
    description: 'Professional-grade, frame interpolation support',
    tier: 'hero',
    // fal: per second by OUTPUT size (≤720p / ≤1080p / above); 60fps doubles
    pricing: {
      kind: 'perSecond',
      usd: 0.02,
      byResolution: { '720p': 0.01, '1080p': 0.02, '4k': 0.08 },
    },
    maxScale: 8,
    supportsFrameInterpolation: true,
  },
  {
    id: 'fal-ai/bytedance-upscaler/upscale/video',
    name: 'Bytedance',
    provider: 'fal',
    description: 'Simple resolution targeting (1080p/2k/4k)',
    tier: 'standard',
    // fal: per second by target size at 30fps; 60fps doubles
    pricing: {
      kind: 'perSecond',
      usd: 0.0072,
      byResolution: { '1080p': 0.0072, '2k': 0.0144, '4k': 0.0288 },
    },
    targetResolutions: BYTEDANCE_VIDEO_TARGET_RESOLUTIONS.map((r) => r.id),
  },
]

export function getVideoUpscaleModelById(
  modelId: string,
): VideoUpscaleModelConfig | undefined {
  return VIDEO_UPSCALE_MODELS.find((m) => m.id === modelId)
}

export function getDefaultVideoUpscaleModel(): VideoUpscaleModelConfig {
  return VIDEO_UPSCALE_MODELS[0]
}

// =============================================================================
// Video Upscale Input Types
// =============================================================================

export interface VideoUpscaleInput {
  videoUrl: string
  model?: string
  sourceAssetId?: string
  projectId?: string

  // Common
  upscaleFactor?: number

  // Topaz specific
  targetFps?: number // Enables frame interpolation when set
  h264Output?: boolean // Use H.264 instead of H.265

  // SeedVR specific
  upscaleMode?: 'factor' | 'target'
  seedvrTargetResolution?: '720p' | '1080p' | '1440p' | '2160p'
  noiseScale?: number // 0-1, default 0.1
  outputFormat?: SeedvrVideoOutputFormat
  outputQuality?: SeedvrVideoOutputQuality
  seed?: number

  // Bytedance specific
  bytedanceTargetResolution?: BytedanceVideoTargetResolution
  bytedanceTargetFps?: BytedanceVideoTargetFps
}

// =============================================================================
// 3D Model Configuration
// =============================================================================

export type Model3DMode = 'text-to-3d' | 'image-to-3d' | 'image-to-world'

export interface Model3DConfig extends ModelConfig {
  type: Model3DMode
  endpoint: string // Full fal.ai endpoint path
  supportsMultipleImages?: boolean
  maxImages?: number
  requiresPrompt?: boolean
  supportsPBR?: boolean
  outputFormats: Array<'glb' | 'obj' | 'fbx' | 'usdz' | 'stl' | 'blend'>
  dropdownDescription: string // Shown in model selector
}

// =============================================================================
// Text-to-3D Models
// =============================================================================

/** Hunyuan3D's own default; sending any other face count bills +$0.15 */
export const HUNYUAN_DEFAULT_FACE_COUNT = 500000

export const TEXT_TO_3D_MODELS: Array<Model3DConfig> = [
  {
    id: 'hunyuan3d-v3-text',
    name: 'Hunyuan3D V3',
    provider: 'hunyuan',
    description: 'Fast, high-quality textured models with PBR support',
    dropdownDescription: 'Fast, high-quality textured models with PBR support',
    type: 'text-to-3d',
    endpoint: 'fal-ai/hunyuan3d-v3/text-to-3d',
    tier: 'standard',
    pricing: {
      kind: 'flat',
      usd: 0.375,
      byQuality: { Normal: 0.375, LowPoly: 0.45, Geometry: 0.225 },
      addOns: { pbr: 0.15, faceCount: 0.15, multiView: 0.15 },
    },
    supportsPBR: true,
    outputFormats: ['glb', 'obj'],
  },
  {
    id: 'meshy-v7-text',
    name: 'Meshy 7.1',
    provider: 'meshy',
    description: 'Production-ready meshes with prompt expansion',
    dropdownDescription:
      'Production-ready meshes with prompt expansion, rigging and PBR',
    type: 'text-to-3d',
    endpoint: 'meshy/v7.1/text-to-3d',
    tier: 'hero',
    // $0.80 untextured, $1.20 textured — the endpoints texture by default
    pricing: {
      kind: 'flat',
      usd: 1.2,
      byQuality: { textured: 1.2, untextured: 0.8 },
    },
    supportsPBR: true,
    outputFormats: ['glb', 'fbx', 'obj', 'usdz'],
  },
]

// =============================================================================
// Image-to-3D Models
// =============================================================================

export const IMAGE_TO_3D_MODELS: Array<Model3DConfig> = [
  {
    id: 'hunyuan3d-v3-image',
    name: 'Hunyuan3D V3 Image',
    provider: 'hunyuan',
    description: 'General purpose image to 3D',
    dropdownDescription:
      'General purpose. Supports up to 4 views (front, back, left, right).',
    type: 'image-to-3d',
    endpoint: 'fal-ai/hunyuan3d-v3/image-to-3d',
    tier: 'standard',
    pricing: {
      kind: 'flat',
      usd: 0.375,
      byQuality: { Normal: 0.375, LowPoly: 0.45, Geometry: 0.225 },
      addOns: { pbr: 0.15, faceCount: 0.15, multiView: 0.15 },
    },
    supportsMultipleImages: true,
    maxImages: 4,
    supportsPBR: true,
    outputFormats: ['glb', 'obj'],
  },
  {
    id: 'meshy-v7-image',
    name: 'Meshy 7.1 Image',
    provider: 'meshy',
    description: 'Production-ready with extensive mesh controls',
    dropdownDescription:
      'Production-ready with extensive mesh controls and PBR.',
    type: 'image-to-3d',
    endpoint: 'meshy/v7.1/image-to-3d',
    tier: 'hero',
    // $0.80 untextured, $1.20 textured — the endpoints texture by default
    pricing: {
      kind: 'flat',
      usd: 1.2,
      byQuality: { textured: 1.2, untextured: 0.8 },
    },
    supportsPBR: true,
    outputFormats: ['glb', 'fbx', 'obj', 'usdz'],
  },
  {
    id: 'meshy-v7-multi',
    name: 'Meshy 7.1 Multi-Image',
    provider: 'meshy',
    description: 'Multi-angle reconstruction',
    dropdownDescription: 'Use 1-4 images of same object from different angles.',
    type: 'image-to-3d',
    endpoint: 'meshy/v7.1/multi-image-to-3d',
    tier: 'hero',
    // $0.80 untextured, $1.20 textured — the endpoints texture by default
    pricing: {
      kind: 'flat',
      usd: 1.2,
      byQuality: { textured: 1.2, untextured: 0.8 },
    },
    supportsMultipleImages: true,
    maxImages: 4,
    supportsPBR: true,
    outputFormats: ['glb', 'fbx', 'obj', 'usdz'],
  },
  {
    id: 'rodin-v2',
    name: 'Hyper3D Rodin V2',
    provider: 'hyper3d',
    description: 'High quality with material options',
    dropdownDescription:
      'High quality with material options. Supports up to 5 images.',
    type: 'image-to-3d',
    endpoint: 'fal-ai/hyper3d/rodin/v2',
    pricing: { kind: 'flat', usd: 0.4 },
    supportsMultipleImages: true,
    maxImages: 5,
    supportsPBR: true,
    outputFormats: ['glb', 'usdz', 'fbx', 'obj', 'stl'],
  },
  {
    id: 'sam3d-objects',
    name: 'SAM 3D Objects',
    provider: 'meta',
    description: 'Object segmentation and reconstruction',
    dropdownDescription:
      'Segment and reconstruct specific objects from photos. Use prompts or masks to select objects.',
    type: 'image-to-3d',
    endpoint: 'fal-ai/sam-3/3d-objects',
    pricing: { kind: 'flat', usd: 0.02 },
    outputFormats: ['glb'],
  },
  {
    id: 'sam3d-body',
    name: 'SAM 3D Body',
    provider: 'meta',
    description: 'Human body reconstruction',
    dropdownDescription:
      'Human body reconstruction from photos. Outputs mesh with 3D keypoints.',
    type: 'image-to-3d',
    endpoint: 'fal-ai/sam-3/3d-body',
    pricing: { kind: 'flat', usd: 0.02 },
    outputFormats: ['glb'],
  },
]

// =============================================================================
// Image-to-World Models
// =============================================================================

export const IMAGE_TO_WORLD_MODELS: Array<Model3DConfig> = [
  {
    id: 'hunyuan-world',
    name: 'Hunyuan World',
    provider: 'hunyuan',
    description: 'Transform images into 3D worlds',
    dropdownDescription:
      'Transform images into explorable 3D panoramas/worlds.',
    type: 'image-to-world',
    endpoint: 'fal-ai/hunyuan_world/image-to-world',
    pricing: { kind: 'flat', usd: 0.3 },
    requiresPrompt: true, // Requires labels
    outputFormats: [],
  },
]

// =============================================================================
// 3D Model Helper Functions
// =============================================================================

export function get3DModelsByMode(mode: Model3DMode): Array<Model3DConfig> {
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

export function get3DModelById(modelId: string): Model3DConfig | undefined {
  return [
    ...TEXT_TO_3D_MODELS,
    ...IMAGE_TO_3D_MODELS,
    ...IMAGE_TO_WORLD_MODELS,
  ].find((m) => m.id === modelId)
}

export function getDefault3DModel(mode: Model3DMode): Model3DConfig {
  switch (mode) {
    case 'text-to-3d':
      return TEXT_TO_3D_MODELS[0] // Hunyuan3D V3
    case 'image-to-3d':
      return (
        IMAGE_TO_3D_MODELS.find((m) => m.id === 'hunyuan3d-v3-image') ||
        IMAGE_TO_3D_MODELS[0]
      )
    case 'image-to-world':
      return IMAGE_TO_WORLD_MODELS[0]
  }
}

// =============================================================================
// Motion Control Configuration (Kling AI)
// =============================================================================

export type MotionControlQuality = 'standard' | 'pro'
export type CharacterOrientation = 'video' | 'image'

export interface MotionControlModelConfig extends ModelConfig {
  quality: MotionControlQuality
  endpoint: string
  maxDurationVideo: number // Max duration in seconds based on orientation
  maxDurationImage: number
  durations: Array<number> // Available duration options in seconds
}

export const MOTION_CONTROL_MODELS: Array<MotionControlModelConfig> = [
  {
    id: 'fal-ai/kling-video/v3/pro/motion-control',
    name: 'Kling v3 Pro',
    provider: 'fal',
    description: 'Professional quality motion transfer with facial consistency',
    quality: 'pro',
    tier: 'hero',
    pricing: { kind: 'perSecond', usd: 0.168 },
    endpoint: 'fal-ai/kling-video/v3/pro/motion-control',
    maxDurationVideo: 30,
    maxDurationImage: 10,
    durations: [5, 10, 15, 20, 30],
  },
  {
    id: 'fal-ai/kling-video/v3/standard/motion-control',
    name: 'Kling v3 Standard',
    provider: 'fal',
    description: 'Cost-effective motion transfer with facial consistency',
    quality: 'standard',
    tier: 'standard',
    pricing: { kind: 'perSecond', usd: 0.126 },
    endpoint: 'fal-ai/kling-video/v3/standard/motion-control',
    maxDurationVideo: 30,
    maxDurationImage: 10,
    durations: [5, 10, 15, 20, 30],
  },
]

export function getMotionControlModelById(
  modelId: string,
): MotionControlModelConfig | undefined {
  return MOTION_CONTROL_MODELS.find((m) => m.id === modelId)
}

export function getDefaultMotionControlModel(): MotionControlModelConfig {
  return (
    MOTION_CONTROL_MODELS.find((m) => m.id === DEFAULT_MODELS.motionControl) ??
    MOTION_CONTROL_MODELS[0]
  )
}

// =============================================================================
// Defaults
// =============================================================================

/**
 * One place for the model each feature falls back to. Every default must be
 * an id in its catalog above (a unit test checks this), so retiring a model
 * can never leave a feature pointing at an endpoint that no longer exists.
 */
export const DEFAULT_MODELS = {
  image: 'bytedance/seedream/v5/flash/text-to-image',
  edit: 'google/nano-banana-2.1/edit',
  upscale: 'fal-ai/seedvr/upscale/image',
  textToVideo: 'kling/v4/flash/text-to-video',
  imageToVideo: 'kling/v4/flash/image-to-video',
  keyframes: 'kling/v4/image-to-video',
  tts: 'elevenlabs/tts/eleven-v4',
  sfx: 'elevenlabs/sound-effects/v3',
  motionControl: 'fal-ai/kling-video/v3/pro/motion-control',
} as const

/**
 * The Director's production loop (src/lib/production.ts). A still sets each
 * shot's composition; the draft and the final both animate that same still,
 * so a final keeps the framing the user approved in review.
 *
 * `finals` is tried in order and the first that fits the budget wins: Hero
 * at 1080p, Hero at 720p, then the Workhorse. Every id is in a catalog above
 * (a unit test checks this).
 */
export const DIRECTOR_MODELS = {
  still: DEFAULT_MODELS.image,
  draft: 'minimax/h3-max-turbo/image-to-video',
  finals: [
    { model: 'kling/v4/image-to-video', resolution: '1080p' },
    { model: 'kling/v4/image-to-video', resolution: '720p' },
    { model: 'kling/v4/flash/image-to-video', resolution: '720p' },
  ],
  music: 'fal-ai/ace-step',
  voice: DEFAULT_MODELS.tts,
  /** fal utility: first/middle/last frame of a clip, $0.0002 per compute second */
  frameExtract: 'fal-ai/ffmpeg-api/extract-frame',
  /** vision model (OpenRouter via fal) that compares a draft frame to its shot */
  selfCheck: 'google/gemini-2.5-flash',
} as const

/**
 * Use `preferred` if the catalog still offers it, otherwise `fallback`.
 * Stored preferences (User.preferredImageModel, old job inputs) can name a
 * model we have since retired; this keeps them from failing at fal.
 */
export function resolveModelId(
  preferred: string | null | undefined,
  catalog: ReadonlyArray<{ id: string }>,
  fallback: string,
): string {
  return preferred && catalog.some((m) => m.id === preferred)
    ? preferred
    : fallback
}
