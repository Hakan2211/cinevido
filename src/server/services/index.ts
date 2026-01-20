/**
 * Service Layer Barrel Export
 *
 * All external service integrations are exported from here.
 * Each service follows the mock mode pattern for easy development.
 *
 * Mock Mode:
 * Set MOCK_GENERATION=true in .env.local to use mock responses
 * for all generation services (Fal.ai, ElevenLabs, Bunny.net, OpenRouter)
 */

// =============================================================================
// Shared Types & Configuration
// =============================================================================

export {
  // Model configs
  IMAGE_MODELS,
  VIDEO_MODELS,
  LLM_MODELS,
  AUDIO_MODELS,
  EDIT_MODELS,
  UPSCALE_MODELS,
  VARIATION_MODELS,
  // Types
  type ModelConfig,
  type JobType,
  type JobStatus,
  type GenerationJobInput,
  type GenerationJobOutput,
  type ProjectManifest,
  type VideoClip,
  type AudioClip,
  type ComponentOverlay,
  type WordTimestamp,
  type TransitionType,
  type ClipEffect,
  // Helpers
  getModelById,
  getDefaultImageModel,
  getDefaultVideoModel,
  getDefaultLlmModel,
  getDefaultAudioModel,
  getDefaultEditModel,
  getDefaultUpscaleModel,
  getDefaultVariationModel,
  createEmptyManifest,
} from './types'

// =============================================================================
// Bunny.net Storage Service
// =============================================================================

export {
  uploadFromUrl,
  uploadBuffer,
  deleteFile,
  getPublicUrl,
  isBunnyConfigured,
  type UploadResult,
  type UploadOptions,
} from './bunny.service'

// =============================================================================
// Fal.ai Generation Service (Image & Video)
// =============================================================================

export {
  generateImage,
  generateVideo,
  getJobStatus as getFalJobStatus,
  cancelJob as cancelFalJob,
  isFalConfigured,
  getImageModels,
  getVideoModels,
  type ImageGenerationInput,
  type VideoGenerationInput,
  type FalImageResult,
  type FalVideoResult,
  type GenerationJob as FalGenerationJob,
} from './fal.service'

// =============================================================================
// Image Edit Service (Edit, Upscale, Variations)
// =============================================================================

export {
  editImage,
  upscaleImage,
  createVariation,
  getEditJobStatus,
  getEditModels,
  getUpscaleModels,
  getVariationModels,
  type EditInput,
  type UpscaleInput,
  type VariationInput,
  type EditJob,
  type FalEditResult,
} from './edit.service'

// =============================================================================
// TTS (Text-to-Speech) Service via Fal.ai ElevenLabs
// =============================================================================

export {
  generateSpeech,
  generateSpeechSimple,
  isTtsConfigured,
  getDefaultVoices,
  getAudioModels,
  DEFAULT_VOICES,
  type Voice,
  type SpeechGenerationInput,
  type SpeechResult,
  type WordTimestamp as TtsWordTimestamp,
} from './tts.service'

// =============================================================================
// OpenRouter LLM Service
// =============================================================================

export {
  chatCompletion,
  chatCompletionStream,
  calculateCredits,
  isOpenRouterConfigured,
  getLlmModels,
  getDefaultModel,
  type ChatMessage,
  type ToolCall,
  type ToolDefinition,
  type ChatCompletionInput,
  type ChatCompletionResponse,
  type StreamChunk,
} from './openrouter.service'

// =============================================================================
// Service Health Check
// =============================================================================

/**
 * Check if all required services are configured
 */
export function checkServicesHealth(): {
  bunny: boolean
  fal: boolean
  tts: boolean
  openrouter: boolean
  allConfigured: boolean
} {
  // Import lazily to avoid circular dependencies
  const { isBunnyConfigured } = require('./bunny.service')
  const { isFalConfigured } = require('./fal.service')
  const { isTtsConfigured } = require('./tts.service')
  const { isOpenRouterConfigured } = require('./openrouter.service')

  const bunny = isBunnyConfigured()
  const fal = isFalConfigured()
  const tts = isTtsConfigured()
  const openrouter = isOpenRouterConfigured()

  return {
    bunny,
    fal,
    tts,
    openrouter,
    allConfigured: bunny && fal && tts && openrouter,
  }
}
