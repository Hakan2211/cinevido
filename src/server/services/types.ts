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
  supportsAudio?: boolean // Native audio generation
  supportsEndFrame?: boolean // For I2V models that support end frame (keyframes)
  // Field name mappings (models use different field names)
  fieldMappings?: {
    imageUrl?: string // 'image_url' | 'start_image_url' | 'first_frame_url'
    endImageUrl?: string // 'end_image_url' | 'last_frame_url' | 'tail_image_url'
  }
}

export const VIDEO_MODELS: Array<VideoModelConfig> = [
  // =============================================================================
  // Kling 2.6 Pro - Premium tier with audio
  // =============================================================================
  {
    id: 'fal-ai/kling-video/v2.6/pro/text-to-video',
    name: 'Kling 2.6 Pro',
    provider: 'fal',
    credits: 30,
    description: 'Top-tier text-to-video with native audio',
    capabilities: ['text-to-video'],
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
  },
  {
    id: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    name: 'Kling 2.6 Pro',
    provider: 'fal',
    credits: 25,
    description: 'Top-tier image-to-video with native audio',
    capabilities: ['image-to-video'],
    durations: [5, 10],
    supportsAudio: true,
    supportsEndFrame: true,
    fieldMappings: {
      imageUrl: 'start_image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // Sora 2 - OpenAI's video model
  // =============================================================================
  {
    id: 'fal-ai/sora-2/text-to-video/pro',
    name: 'Sora 2 Pro',
    provider: 'fal',
    credits: 35,
    description: 'OpenAI Sora 2 Pro - Premium quality',
    capabilities: ['text-to-video'],
    durations: [4, 8, 12],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
  },
  {
    id: 'fal-ai/sora-2/text-to-video',
    name: 'Sora 2',
    provider: 'fal',
    credits: 25,
    description: 'OpenAI Sora 2 - State-of-the-art video',
    capabilities: ['text-to-video'],
    durations: [4, 8, 12],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
  },
  {
    id: 'fal-ai/sora-2/image-to-video/pro',
    name: 'Sora 2 Pro',
    provider: 'fal',
    credits: 30,
    description: 'OpenAI Sora 2 Pro image-to-video',
    capabilities: ['image-to-video'],
    durations: [4, 8, 12],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },
  {
    id: 'fal-ai/sora-2/image-to-video',
    name: 'Sora 2',
    provider: 'fal',
    credits: 22,
    description: 'OpenAI Sora 2 image-to-video',
    capabilities: ['image-to-video'],
    durations: [4, 8, 12],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p'],
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },

  // =============================================================================
  // Veo 3.1 - Google's video model (Premium)
  // =============================================================================
  {
    id: 'fal-ai/veo3.1',
    name: 'Veo 3.1',
    provider: 'fal',
    credits: 40,
    description: 'Google Veo 3.1 - Most advanced, with audio',
    capabilities: ['text-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
  },
  {
    id: 'fal-ai/veo3.1/fast',
    name: 'Veo 3.1 Fast',
    provider: 'fal',
    credits: 25,
    description: 'Google Veo 3.1 Fast - Quicker generation',
    capabilities: ['text-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
  },
  {
    id: 'fal-ai/veo3.1/image-to-video',
    name: 'Veo 3.1',
    provider: 'fal',
    credits: 35,
    description: 'Google Veo 3.1 image-to-video with audio',
    capabilities: ['image-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },
  {
    id: 'fal-ai/veo3.1/fast/image-to-video',
    name: 'Veo 3.1 Fast',
    provider: 'fal',
    credits: 22,
    description: 'Google Veo 3.1 Fast image-to-video',
    capabilities: ['image-to-video'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },
  {
    id: 'fal-ai/veo3.1/first-last-frame-to-video',
    name: 'Veo 3.1 Keyframes',
    provider: 'fal',
    credits: 50,
    description: 'Google Veo 3.1 first+last frame to video',
    capabilities: ['keyframes'],
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    supportsAudio: true,
    fieldMappings: {
      imageUrl: 'first_frame_url',
      endImageUrl: 'last_frame_url',
    },
  },

  // =============================================================================
  // Wan 2.6 - Alibaba (Good value)
  // =============================================================================
  {
    id: 'wan/v2.6/text-to-video',
    name: 'Wan 2.6',
    provider: 'fal',
    credits: 18,
    description: 'Alibaba Wan 2.6 - Multi-shot support',
    capabilities: ['text-to-video'],
    durations: [5, 10, 15],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['720p', '1080p'],
  },
  {
    id: 'wan/v2.6/image-to-video',
    name: 'Wan 2.6',
    provider: 'fal',
    credits: 15,
    description: 'Alibaba Wan 2.6 image-to-video',
    capabilities: ['image-to-video'],
    durations: [5, 10, 15],
    resolutions: ['720p', '1080p'],
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },

  // =============================================================================
  // Seedance 1.5 Pro - ByteDance (with keyframes support)
  // =============================================================================
  {
    id: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
    name: 'Seedance 1.5 Pro',
    provider: 'fal',
    credits: 20,
    description: 'ByteDance Seedance with audio',
    capabilities: ['text-to-video'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['480p', '720p', '1080p'],
    supportsAudio: true,
  },
  {
    id: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
    name: 'Seedance 1.5 Pro',
    provider: 'fal',
    credits: 18,
    description: 'ByteDance Seedance I2V with keyframes',
    capabilities: ['image-to-video', 'keyframes'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['480p', '720p', '1080p'],
    supportsAudio: true,
    supportsEndFrame: true,
    fieldMappings: {
      imageUrl: 'image_url',
      endImageUrl: 'end_image_url',
    },
  },

  // =============================================================================
  // MiniMax Hailuo 2.3 - Pro and Standard tiers
  // =============================================================================
  {
    id: 'fal-ai/minimax/hailuo-2.3/pro/text-to-video',
    name: 'Hailuo 2.3 Pro',
    provider: 'fal',
    credits: 18,
    description: 'MiniMax Hailuo Pro - 1080p quality',
    capabilities: ['text-to-video'],
    durations: [5], // Fixed duration
  },
  {
    id: 'fal-ai/minimax/hailuo-2.3/standard/text-to-video',
    name: 'Hailuo 2.3 Standard',
    provider: 'fal',
    credits: 12,
    description: 'MiniMax Hailuo Standard - Affordable',
    capabilities: ['text-to-video'],
    durations: [5],
  },
  {
    id: 'fal-ai/minimax/hailuo-2.3/pro/image-to-video',
    name: 'Hailuo 2.3 Pro',
    provider: 'fal',
    credits: 15,
    description: 'MiniMax Hailuo Pro I2V - 1080p',
    capabilities: ['image-to-video'],
    durations: [5],
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },
  {
    id: 'fal-ai/minimax/hailuo-2.3/standard/image-to-video',
    name: 'Hailuo 2.3 Standard',
    provider: 'fal',
    credits: 10,
    description: 'MiniMax Hailuo Standard I2V',
    capabilities: ['image-to-video'],
    durations: [5],
    fieldMappings: {
      imageUrl: 'image_url',
    },
  },

  // =============================================================================
  // Pika 2.2 - Keyframes specialist
  // =============================================================================
  {
    id: 'fal-ai/pika/v2.2/pikaframes',
    name: 'Pika 2.2 Pikaframes',
    provider: 'fal',
    credits: 20, // Base cost for 2 frames
    description: 'Pika keyframes - 2-5 images with transitions',
    capabilities: ['keyframes'],
    durations: [5, 10], // Per transition, max 25s total
    resolutions: ['720p', '1080p'],
    // Pika uses image_urls array, handled specially
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
    credits: 10,
    description: 'Temporal consistency, flexible output formats',
    maxScale: 10,
    supportsTargetResolution: true,
    outputFormats: SEEDVR_VIDEO_OUTPUT_FORMATS.map((f) => f.id),
  },
  {
    id: 'fal-ai/topaz/upscale/video',
    name: 'Topaz',
    provider: 'fal',
    credits: 15,
    description: 'Professional-grade, frame interpolation support',
    maxScale: 8,
    supportsFrameInterpolation: true,
  },
  {
    id: 'fal-ai/bytedance-upscaler/upscale/video',
    name: 'Bytedance',
    provider: 'fal',
    credits: 8,
    description: 'Simple resolution targeting (1080p/2k/4k)',
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
