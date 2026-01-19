/**
 * Agent Tool Definitions
 *
 * Defines the tools available to the AI Director agent.
 * Uses Zod schemas for validation and converts to OpenRouter format.
 */

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ToolDefinition } from '../services/openrouter.service'

// =============================================================================
// Tool Parameter Schemas
// =============================================================================

export const getProjectStateSchema = z.object({})

export const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(10)
    .max(1000)
    .describe(
      'Detailed image description. Be specific about scene, lighting, style, and composition.',
    ),
  aspectRatio: z
    .enum(['16:9', '9:16', '1:1', '4:3', '3:4'])
    .optional()
    .describe('Aspect ratio for the image. Defaults to project dimensions.'),
  style: z
    .string()
    .optional()
    .describe(
      'Style modifier (e.g., cinematic, anime, photorealistic, illustration)',
    ),
})

export const generateVideoSchema = z.object({
  imageAssetId: z
    .string()
    .describe('ID of the image asset to animate into a video'),
  motionPrompt: z
    .string()
    .min(5)
    .max(500)
    .describe(
      'Describe how the scene should move (e.g., "camera slowly pans right, clouds drift")',
    ),
  duration: z
    .number()
    .min(5)
    .max(10)
    .optional()
    .describe('Video duration in seconds (5-10). Defaults to 5.'),
})

export const generateVoiceoverSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(5000)
    .describe('The script text to convert to speech'),
  voiceStyle: z
    .enum(['male-narrator', 'female-narrator', 'male-casual', 'female-casual'])
    .optional()
    .describe('Voice style to use. Defaults to male-narrator.'),
})

export const updateTimelineSchema = z.object({
  action: z
    .enum([
      'addVideoClip',
      'addAudioClip',
      'addTextOverlay',
      'removeClip',
      'moveClip',
      'setBackground',
    ])
    .describe('The timeline action to perform'),

  // For addVideoClip
  videoAssetId: z
    .string()
    .optional()
    .describe('Asset ID of the video to add (for addVideoClip)'),

  // For addAudioClip
  audioAssetId: z
    .string()
    .optional()
    .describe('Asset ID of the audio to add (for addAudioClip)'),

  // For addTextOverlay - flattened structure for better LLM compatibility
  textOverlayType: z
    .enum(['BigTitle', 'LowerThird', 'KaraokeText'])
    .optional()
    .describe('Type of text overlay (for addTextOverlay)'),
  textOverlayText: z
    .string()
    .optional()
    .describe('Text content for the overlay (for addTextOverlay)'),
  textOverlayPosition: z
    .enum(['top', 'center', 'bottom'])
    .optional()
    .describe('Position of the text overlay'),
  textOverlayFontSize: z.number().optional().describe('Font size in pixels'),
  textOverlayColor: z
    .string()
    .optional()
    .describe('Text color (hex, e.g., "#FFFFFF")'),

  // For removeClip/moveClip
  clipId: z.string().optional().describe('ID of the clip to remove or move'),

  // For moveClip
  newStartFrame: z
    .number()
    .optional()
    .describe('New start frame position (for moveClip)'),

  // Common positioning
  startFrame: z
    .number()
    .optional()
    .describe('Start frame for the clip (30 frames = 1 second at 30fps)'),
  durationFrames: z
    .number()
    .optional()
    .describe('Duration in frames. If not specified, uses asset duration.'),
  layer: z
    .number()
    .optional()
    .describe('Layer/track number (0 = bottom, higher = on top)'),

  // For setBackground
  backgroundColor: z
    .string()
    .optional()
    .describe('Background color hex (for setBackground, e.g., "#000000")'),
})

export const listAssetsSchema = z.object({
  type: z
    .enum(['image', 'video', 'audio', 'all'])
    .optional()
    .describe('Filter assets by type. Defaults to all.'),
})

// =============================================================================
// Tool Names (for type safety)
// =============================================================================

export const TOOL_NAMES = {
  GET_PROJECT_STATE: 'getProjectState',
  GENERATE_IMAGE: 'generateImage',
  GENERATE_VIDEO: 'generateVideo',
  GENERATE_VOICEOVER: 'generateVoiceover',
  UPDATE_TIMELINE: 'updateTimeline',
  LIST_ASSETS: 'listAssets',
} as const

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES]

// =============================================================================
// Helper to convert Zod schema to OpenRouter parameters format
// =============================================================================

function schemaToParameters(
  schema: z.ZodObject<z.ZodRawShape>,
): ToolDefinition['function']['parameters'] {
  // Cast to any to work with both Zod v3 and v4

  const jsonSchema = zodToJsonSchema(schema as any, { target: 'openApi3' })

  // Extract just what we need for OpenRouter
  if (typeof jsonSchema === 'object' && 'type' in jsonSchema) {
    return {
      type: 'object',
      properties:
        (jsonSchema as { properties?: Record<string, unknown> }).properties ||
        {},
      required: (jsonSchema as { required?: Array<string> }).required,
    }
  }

  return { type: 'object', properties: {} }
}

// =============================================================================
// Tool Definitions for OpenRouter
// =============================================================================

/**
 * All agent tools in OpenRouter format
 */
export const AGENT_TOOLS: Array<ToolDefinition> = [
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.GET_PROJECT_STATE,
      description:
        'Get the current project state including manifest (timeline), settings (dimensions, fps), and list of available assets. Use this to understand what exists before making changes.',
      parameters: schemaToParameters(getProjectStateSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.GENERATE_IMAGE,
      description:
        'Generate a storyboard image from a text prompt. Returns a job ID that can be polled for completion. The image will be automatically added to the project assets when complete.',
      parameters: schemaToParameters(generateImageSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.GENERATE_VIDEO,
      description:
        'Convert an existing image asset to a video clip (5-10 seconds). Returns a job ID for polling. The video will be added to assets when complete. Use this after generating images.',
      parameters: schemaToParameters(generateVideoSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.GENERATE_VOICEOVER,
      description:
        'Generate a voiceover from text with word-level timestamps for karaoke-style text sync. Returns immediately with the audio asset ID and timestamps.',
      parameters: schemaToParameters(generateVoiceoverSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.UPDATE_TIMELINE,
      description:
        'Modify the video timeline. Can add video/audio clips, add text overlays, remove clips, move clips, or change background color. Returns the updated manifest.',
      parameters: schemaToParameters(updateTimelineSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.LIST_ASSETS,
      description:
        'List all assets available in the project library. Can filter by type (image, video, audio). Returns asset IDs, URLs, and metadata.',
      parameters: schemaToParameters(listAssetsSchema),
    },
  },
]

// =============================================================================
// Type exports for tool arguments
// =============================================================================

export type GetProjectStateArgs = z.infer<typeof getProjectStateSchema>
export type GenerateImageArgs = z.infer<typeof generateImageSchema>
export type GenerateVideoArgs = z.infer<typeof generateVideoSchema>
export type GenerateVoiceoverArgs = z.infer<typeof generateVoiceoverSchema>
export type UpdateTimelineArgs = z.infer<typeof updateTimelineSchema>
export type ListAssetsArgs = z.infer<typeof listAssetsSchema>

export type ToolArgs =
  | { name: typeof TOOL_NAMES.GET_PROJECT_STATE; args: GetProjectStateArgs }
  | { name: typeof TOOL_NAMES.GENERATE_IMAGE; args: GenerateImageArgs }
  | { name: typeof TOOL_NAMES.GENERATE_VIDEO; args: GenerateVideoArgs }
  | { name: typeof TOOL_NAMES.GENERATE_VOICEOVER; args: GenerateVoiceoverArgs }
  | { name: typeof TOOL_NAMES.UPDATE_TIMELINE; args: UpdateTimelineArgs }
  | { name: typeof TOOL_NAMES.LIST_ASSETS; args: ListAssetsArgs }
