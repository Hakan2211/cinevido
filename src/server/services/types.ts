/**
 * Shared Types for DirectorAI Services
 *
 * This file contains type definitions used across multiple services.
 */

// =============================================================================
// Model Configurations
// =============================================================================

export interface ModelConfig {
  id: string
  name: string
  provider: string
  credits: number // Cost in credits (1 credit = $0.01)
  description?: string
  supportsNumImages?: boolean // Whether model supports generating multiple images
  maxNumImages?: number // Maximum number of images (default 4 if supportsNumImages is true)
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
  // === Google (Nano Banana) ===
  {
    id: 'fal-ai/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'fal',
    credits: 15,
    description: 'Google Gemini 3 Pro - Best quality, excellent text rendering',
    supportsNumImages: true,
    maxNumImages: 4,
  },
  {
    id: 'fal-ai/nano-banana',
    name: 'Nano Banana',
    provider: 'fal',
    credits: 4,
    description: 'Google Gemini 2.5 Flash - Fast and affordable',
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === OpenAI (GPT Image) ===
  {
    id: 'fal-ai/gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'fal',
    credits: 4, // Medium quality default, actual varies by quality tier
    description: 'OpenAI - Strong prompt adherence, variable quality tiers',
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === Black Forest Labs (Flux 2) ===
  {
    id: 'fal-ai/flux-2-pro',
    name: 'Flux 2 Pro',
    provider: 'fal',
    credits: 3,
    description: 'Production-optimized, zero-config professional quality',
    // Flux 2 Pro does NOT support num_images
  },
  {
    id: 'fal-ai/flux-2',
    name: 'Flux 2 Dev',
    provider: 'fal',
    credits: 1,
    description: 'Fast open-source, great for iteration',
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === ImagineArt ===
  {
    id: 'imagineart/imagineart-1.5-pro-preview/text-to-image',
    name: 'ImagineArt 1.5 Pro',
    provider: 'fal',
    credits: 5,
    description: 'Ultra-high-fidelity 4K, professional use',
    // ImagineArt does NOT support num_images
  },
  {
    id: 'imagineart/imagineart-1.5-preview/text-to-image',
    name: 'ImagineArt 1.5',
    provider: 'fal',
    credits: 3,
    description: 'Professional realism, good text rendering',
    // ImagineArt does NOT support num_images
  },

  // === ByteDance ===
  {
    id: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    name: 'Seedream 4.5',
    provider: 'fal',
    credits: 4,
    description: 'ByteDance - Up to 4MP, unified generation + editing',
    supportsNumImages: true,
    maxNumImages: 4,
  },

  // === Recraft ===
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    provider: 'fal',
    credits: 4,
    description: 'SOTA text rendering, vector art, brand styles',
    // Recraft does NOT support num_images in current API
  },

  // === Bria ===
  {
    id: 'bria/text-to-image/3.2',
    name: 'Bria 3.2',
    provider: 'fal',
    credits: 4,
    description: 'Licensed data, safe commercial use, good text',
    // Bria does NOT support num_images in current API
  },

  // === Alibaba (Wan) ===
  {
    id: 'wan/v2.6/text-to-image',
    name: 'Wan 2.6',
    provider: 'fal',
    credits: 3,
    description: 'Alibaba - High quality, good value',
    // Disabled: max_images causes downstream service errors on fal.ai
  },
]

// =============================================================================
// Model-specific Options
// =============================================================================

// GPT Image quality tiers with credit costs
export const GPT_IMAGE_QUALITY_TIERS = [
  { id: 'low', name: 'Low', credits: 1, description: 'Fast drafts' },
  { id: 'medium', name: 'Medium', credits: 4, description: 'Balanced quality' },
  { id: 'high', name: 'High', credits: 13, description: 'Best quality' },
] as const

export type GptImageQuality = 'low' | 'medium' | 'high'

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
  // === Single-image models ===
  {
    id: 'fal-ai/flux-pro/kontext',
    name: 'Kontext Pro',
    provider: 'fal',
    credits: 4,
    maxImages: 1,
    description: 'Character consistency, local edits',
  },
  // === Multi-image models ===
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Pro',
    provider: 'fal',
    credits: 15,
    maxImages: 14,
    description: 'Best quality, multi-image composition',
  },
  {
    id: 'fal-ai/nano-banana/edit',
    name: 'Nano Banana',
    provider: 'fal',
    credits: 4,
    maxImages: 10,
    description: 'Good quality, affordable',
  },
  {
    id: 'fal-ai/flux-2/edit',
    name: 'Flux 2 Edit',
    provider: 'fal',
    credits: 1,
    maxImages: 10,
    description: 'Multi-reference, HEX color control',
  },
  {
    id: 'fal-ai/gpt-image-1.5/edit',
    name: 'GPT Image 1.5',
    provider: 'fal',
    credits: 4,
    maxImages: 10,
    description: 'OpenAI, variable quality tiers',
  },
  {
    id: 'fal-ai/bytedance/seedream/v4.5/edit',
    name: 'Seedream 4.5',
    provider: 'fal',
    credits: 4,
    maxImages: 10,
    description: 'Multi-source composition',
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

// Upscaling models
export const UPSCALE_MODELS: Array<UpscaleModelConfig> = [
  {
    id: 'fal-ai/seedvr/upscale/image',
    name: 'SeedVR2',
    provider: 'fal',
    credits: 2,
    description: 'AI upscaling up to 10x with target resolution mode',
    maxScale: 10,
    supportsTargetResolution: true,
  },
  {
    id: 'fal-ai/topaz/upscale/image',
    name: 'Topaz',
    provider: 'fal',
    credits: 8,
    description: 'Professional enhancement with face recovery',
    maxScale: 4,
    topazModels: TOPAZ_MODELS.map((m) => m.id),
  },
]

export const VIDEO_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/kling-video/v1.5/pro/image-to-video',
    name: 'Kling 1.5 Pro',
    provider: 'fal',
    credits: 20,
    description: 'Best quality image-to-video, 5-10s clips',
  },
  {
    id: 'fal-ai/kling-video/v1/pro/image-to-video',
    name: 'Kling 1.0 Pro',
    provider: 'fal',
    credits: 15,
    description: 'Good quality, slightly cheaper',
  },
  {
    id: 'fal-ai/kling-video/v1/standard/image-to-video',
    name: 'Kling 1.0 Standard',
    provider: 'fal',
    credits: 8,
    description: 'Fast and affordable',
  },
  {
    id: 'fal-ai/minimax/video-01/image-to-video',
    name: 'MiniMax Video',
    provider: 'fal',
    credits: 12,
    description: 'Alternative video model',
  },
  {
    id: 'fal-ai/luma-dream-machine/image-to-video',
    name: 'Luma Dream Machine',
    provider: 'fal',
    credits: 15,
    description: 'Cinematic style',
  },
]

export const AUDIO_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/elevenlabs/tts/multilingual-v2',
    name: 'ElevenLabs Multilingual v2',
    provider: 'fal',
    credits: 3,
    description: 'High quality multilingual TTS with word timestamps',
  },
  {
    id: 'fal-ai/elevenlabs/tts/turbo-v2.5',
    name: 'ElevenLabs Turbo v2.5',
    provider: 'fal',
    credits: 2,
    description: 'Faster, lower latency TTS',
  },
]

export const LLM_MODELS: Array<ModelConfig> = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    credits: 1, // Per ~1000 tokens (rough estimate)
    description: 'Best for creative writing and tool use',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    credits: 1,
    description: 'Fast and capable',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openrouter',
    credits: 0,
    description: 'Cheapest option, good for simple tasks',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    provider: 'openrouter',
    credits: 1,
    description: 'Google Gemini with large context',
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'openrouter',
    credits: 3,
    description: 'Highest quality, most expensive',
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

export interface ProjectManifest {
  version: number
  tracks: {
    video: Array<VideoClip>
    audio: Array<AudioClip>
    components: Array<ComponentOverlay>
  }
  globalSettings: {
    backgroundColor: string
  }
}

export interface VideoClip {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  layer: number
  transition?: TransitionType
  effects?: Array<ClipEffect>
}

export interface AudioClip {
  id: string
  assetId: string
  url: string
  startFrame: number
  durationFrames: number
  volume: number
  // Word timestamps for karaoke sync
  wordTimestamps?: Array<WordTimestamp>
}

export interface ComponentOverlay {
  id: string
  component: 'KaraokeText' | 'BigTitle' | 'ImageOverlay' | 'LowerThird'

  props: Record<string, any>
  startFrame: number
  durationFrames: number
  layer: number
}

export interface WordTimestamp {
  word: string
  start: number // seconds
  end: number // seconds
}

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'glitch'
  | 'zoom'

export interface ClipEffect {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale'
  value: number
}

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
  // Return ImagineArt 1.5 as the default
  return (
    IMAGE_MODELS.find(
      (m) => m.id === 'imagineart/imagineart-1.5-preview/text-to-image',
    ) || IMAGE_MODELS[0]
  )
}

export function getDefaultVideoModel(): ModelConfig {
  return VIDEO_MODELS[0]
}

export function getDefaultLlmModel(): ModelConfig {
  return LLM_MODELS[0]
}

export function getDefaultAudioModel(): ModelConfig {
  return AUDIO_MODELS[0]
}

export function getDefaultEditModel(): EditModelConfig {
  return EDIT_MODELS[0]
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

export function createEmptyManifest(): ProjectManifest {
  return {
    version: 1,
    tracks: {
      video: [],
      audio: [],
      components: [],
    },
    globalSettings: {
      backgroundColor: '#000000',
    },
  }
}
