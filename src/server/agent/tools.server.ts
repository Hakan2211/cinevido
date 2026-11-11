/**
 * Agent Tool Definitions
 *
 * Defines the tools available to the AI Director agent.
 * Uses Zod schemas for validation and converts to OpenRouter format.
 */

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { TTS_VOICES } from '../services/types'
import type { ToolDefinition } from '../services/openrouter.server'

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

export const generateMusicSchema = z.object({
  prompt: z
    .string()
    .min(3)
    .max(1000)
    .describe(
      'The music to write. For ACE-Step this is comma-separated genre tags ("synthwave, driving bass, 110 BPM"); for the other engines a prose description.',
    ),
  lyrics: z
    .string()
    .max(3000)
    .optional()
    .describe(
      'Words to sing, with [verse]/[chorus] markers. ACE-Step only; leave empty for an instrumental.',
    ),
  instrumental: z
    .boolean()
    .optional()
    .describe('Force an instrumental take with no vocals. Defaults to true.'),
  durationSec: z
    .number()
    .min(10)
    .max(240)
    .optional()
    .describe('Track length in seconds. Defaults to 60.'),
  title: z.string().max(120).optional().describe('A name for the track'),
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
    .describe(
      'Which lane of its kind to use (0 = the base lane). Later video lanes composite on top.',
    ),

  // For setBackground
  backgroundColor: z
    .string()
    .optional()
    .describe('Background color hex (for setBackground, e.g., "#000000")'),
})

export const proposePlanSchema = z.object({
  title: z.string().min(1).max(120).describe('Working title of the production'),
  format: z
    .string()
    .max(40)
    .optional()
    .describe('What it is, in two or three words: "ad", "product teaser", "music video"'),
  shots: z
    .array(
      z.object({
        title: z.string().min(1).max(80).describe('Short shot name, e.g. "Morning Light"'),
        description: z
          .string()
          .min(1)
          .max(240)
          .describe('One line for the storyboard card: what the viewer sees and why'),
        durationSec: z
          .number()
          .min(3)
          .max(15)
          .describe('Shot length in seconds; 5 suits most shots, 8-10 for slow establishing shots'),
        prompt: z
          .string()
          .min(20)
          .max(1200)
          .describe(
            'Image prompt for the first frame of the shot: subject, composition, lens/framing, lighting, palette, style. Repeat recurring characters/products with the same wording in every shot for consistency.',
          ),
        motion: z
          .string()
          .min(5)
          .max(500)
          .describe('What moves during the shot: camera move and action, e.g. "slow push-in, steam rises from the cup"'),
        cast: z
          .array(z.string().max(60))
          .max(4)
          .optional()
          .describe(
            'Names of Project Bible entries that appear in this shot (exact names from the Bible). Their reference images keep faces and products consistent. Omit when none appear.',
          ),
      }),
    )
    .min(1)
    .max(12)
    .describe('The shots in order'),
  voiceoverScript: z
    .string()
    .max(2000)
    .optional()
    .describe('Narration to record over the cut, if the brief wants one. Fit it to the total length (~2.5 words per second).'),
  musicPrompt: z
    .string()
    .max(300)
    .optional()
    .describe('Score as comma-separated genre tags, e.g. "warm acoustic, soft piano, 90 BPM". Omit for no music.'),
})

export const updateShotSchema = z.object({
  shotNumber: z.number().min(1).describe('1-based position of the shot in the plan'),
  title: z.string().max(80).optional(),
  description: z.string().max(240).optional(),
  durationSec: z.number().min(3).max(15).optional(),
  prompt: z
    .string()
    .max(1200)
    .optional()
    .describe('New first-frame image prompt (drops the renders of that shot)'),
  motion: z.string().max(500).optional().describe('New motion prompt (drops the clips)'),
  cast: z
    .array(z.string().max(60))
    .max(4)
    .optional()
    .describe('Project Bible names in this shot; replaces the cast (drops the renders of that shot)'),
})

const voiceNames = TTS_VOICES.map((v) => v.name) as [string, ...Array<string>]

export const updateBibleSchema = z.object({
  style: z
    .string()
    .max(400)
    .optional()
    .describe(
      'One visual style for every still, e.g. "35mm film, warm tungsten grade, shallow depth of field". Appended to every shot prompt, so keep it out of the shot prompts.',
    ),
  voice: z
    .enum(voiceNames)
    .optional()
    .describe('Narrator voice for the voiceover'),
  entries: z
    .array(
      z.object({
        name: z.string().min(1).max(60).describe('How shots refer to it: "Mara", "The bottle"'),
        kind: z.enum(['character', 'product', 'place']).optional(),
        description: z
          .string()
          .max(400)
          .optional()
          .describe(
            'The fixed look in words: age, build, hair, clothing; or shape, material, colours, label. Used to draw a reference image and repeated into every shot it is in.',
          ),
      }),
    )
    .max(8)
    .optional()
    .describe('Characters, products and places to add or update (matched by name). Never removes entries or their images.'),
})

export const renderPlanSchema = z.object({
  stage: z
    .enum(['drafts', 'finals', 'direct'])
    .describe(
      '"drafts": cheap draft clips of every shot for review. "finals": re-render the kept shots on the final model and assemble the timeline. "direct": skip drafts, render finals of every shot.',
    ),
})

export const listAssetsSchema = z.object({
  type: z
    .enum(['image', 'video', 'audio', 'music', 'all'])
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
  GENERATE_MUSIC: 'generateMusic',
  UPDATE_TIMELINE: 'updateTimeline',
  LIST_ASSETS: 'listAssets',
  PROPOSE_PLAN: 'proposePlan',
  UPDATE_SHOT: 'updateShot',
  RENDER_PLAN: 'renderPlan',
  UPDATE_BIBLE: 'updateBible',
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
      name: TOOL_NAMES.PROPOSE_PLAN,
      description:
        'Turn a brief into a storyboard plan: an ordered list of shots, each with a first-frame image prompt and a motion prompt, plus optional voiceover and music. The server prices every shot, picks draft and final models that fit the budget, and shows the plan as cards with Edit plan / Render buttons. Replaces the current plan. Nothing is rendered or spent.',
      parameters: schemaToParameters(proposePlanSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.UPDATE_SHOT,
      description:
        'Change one shot of the current plan (title, description, length, image prompt or motion). Prefer this over proposing a whole new plan when the user tweaks a shot.',
      parameters: schemaToParameters(updateShotSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.UPDATE_BIBLE,
      description:
        'Add to or change the Project Bible: the visual style, the narrator voice, and recurring characters / products / places. Shots name Bible entries in their `cast`; entries the user gave a reference image make those shots match it. Nothing is rendered or spent.',
      parameters: schemaToParameters(updateBibleSchema),
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL_NAMES.RENDER_PLAN,
      description:
        'Start rendering the current plan. Spends fal credits from the user account within the project budget; refuses when the projected cost does not fit. Only call when the user asks to render (or approves the plan).',
      parameters: schemaToParameters(renderPlanSchema),
    },
  },
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
      name: TOOL_NAMES.GENERATE_MUSIC,
      description:
        'Write a music track from a description (genre tags or prose) with optional lyrics. Returns a job ID for polling; the finished track becomes a music asset that belongs on the Music lane of the timeline.',
      parameters: schemaToParameters(generateMusicSchema),
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
export type GenerateMusicArgs = z.infer<typeof generateMusicSchema>
export type UpdateTimelineArgs = z.infer<typeof updateTimelineSchema>
export type ListAssetsArgs = z.infer<typeof listAssetsSchema>
export type ProposePlanArgs = z.infer<typeof proposePlanSchema>
export type UpdateShotArgs = z.infer<typeof updateShotSchema>
export type RenderPlanArgs = z.infer<typeof renderPlanSchema>
export type UpdateBibleArgs = z.infer<typeof updateBibleSchema>

export type ToolArgs =
  | { name: typeof TOOL_NAMES.GET_PROJECT_STATE; args: GetProjectStateArgs }
  | { name: typeof TOOL_NAMES.GENERATE_IMAGE; args: GenerateImageArgs }
  | { name: typeof TOOL_NAMES.GENERATE_VIDEO; args: GenerateVideoArgs }
  | { name: typeof TOOL_NAMES.GENERATE_VOICEOVER; args: GenerateVoiceoverArgs }
  | { name: typeof TOOL_NAMES.GENERATE_MUSIC; args: GenerateMusicArgs }
  | { name: typeof TOOL_NAMES.UPDATE_TIMELINE; args: UpdateTimelineArgs }
  | { name: typeof TOOL_NAMES.LIST_ASSETS; args: ListAssetsArgs }
