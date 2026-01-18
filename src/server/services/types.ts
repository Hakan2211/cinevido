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
}

export const IMAGE_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/flux-pro/v1.1',
    name: 'Flux Pro 1.1',
    provider: 'fal',
    credits: 5,
    description: 'Best quality, great text rendering',
  },
  {
    id: 'fal-ai/flux/schnell',
    name: 'Flux Schnell',
    provider: 'fal',
    credits: 1,
    description: 'Fast and cheap, good for iteration',
  },
  {
    id: 'fal-ai/flux/dev',
    name: 'Flux Dev',
    provider: 'fal',
    credits: 3,
    description: 'Good balance of quality and speed',
  },
  {
    id: 'fal-ai/stable-diffusion-v3-medium',
    name: 'SD3 Medium',
    provider: 'fal',
    credits: 2,
    description: 'Stable Diffusion 3 Medium',
  },
]

// Image editing models (inpainting, outpainting)
export const EDIT_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/flux-pro/v1/fill',
    name: 'Flux Pro Fill',
    provider: 'fal',
    credits: 6,
    description: 'Best quality inpainting and outpainting',
  },
  {
    id: 'fal-ai/flux/dev/image-to-image',
    name: 'Flux Dev Edit',
    provider: 'fal',
    credits: 3,
    description: 'Good balance for image editing',
  },
  {
    id: 'fal-ai/nano-banana-pro/edit',
    name: 'Nano Banana Edit',
    provider: 'fal',
    credits: 4,
    description: 'Multi-purpose AI editing (Google)',
  },
]

// Upscaling models
export const UPSCALE_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/creative-upscaler',
    name: 'Creative Upscaler',
    provider: 'fal',
    credits: 4,
    description: 'AI-enhanced upscaling with added detail',
  },
  {
    id: 'fal-ai/clarity-upscaler',
    name: 'Clarity Upscaler',
    provider: 'fal',
    credits: 3,
    description: 'Clean upscaling, preserves original details',
  },
]

// Variation models (create variations from reference image)
export const VARIATION_MODELS: Array<ModelConfig> = [
  {
    id: 'fal-ai/flux-pro/v1.1/redux',
    name: 'Flux Pro Redux',
    provider: 'fal',
    credits: 5,
    description: 'Create variations from reference image',
  },
  {
    id: 'fal-ai/flux/dev/redux',
    name: 'Flux Dev Redux',
    provider: 'fal',
    credits: 3,
    description: 'Faster variations, good quality',
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
  | 'variation'
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
  return IMAGE_MODELS[0]
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

export function getDefaultEditModel(): ModelConfig {
  return EDIT_MODELS[0]
}

export function getDefaultUpscaleModel(): ModelConfig {
  return UPSCALE_MODELS[0]
}

export function getDefaultVariationModel(): ModelConfig {
  return VARIATION_MODELS[0]
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
