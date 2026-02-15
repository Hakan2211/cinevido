/**
 * Tool Executor
 *
 * Executes agent tools and returns results.
 * Each tool function handles validation, execution, and error handling.
 */

import { prisma } from '../../db.server'
import {
  generateImage,
  generateSpeech,
  generateVideo,
} from '../services/index.server'
import { getUserStorageConfig } from '../storage-config.server'
import { TOOL_NAMES } from './tools.server'
import type {
  AudioClip,
  ComponentOverlay,
  ProjectManifest,
  VideoClip,
} from '../services/index.server'
import type {
  GenerateImageArgs,
  GenerateVideoArgs,
  GenerateVoiceoverArgs,
  ListAssetsArgs,
  UpdateTimelineArgs,
} from './tools.server'

// Voice name mappings (Fal.ai uses voice names directly)
const VOICE_NAMES = {
  MALE_NARRATOR: 'Adam',
  FEMALE_NARRATOR: 'Rachel',
}

// =============================================================================
// Types
// =============================================================================

export interface ToolContext {
  userId: string
  projectId: string
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

// =============================================================================
// Tool: getProjectState
// =============================================================================

export async function executeGetProjectState(
  context: ToolContext,
): Promise<ToolResult> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: context.projectId },
      include: {
        assets: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    if (project.userId !== context.userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const manifest = JSON.parse(project.manifest) as ProjectManifest

    return {
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          width: project.width,
          height: project.height,
          fps: project.fps,
          duration: project.duration,
          status: project.status,
        },
        manifest: {
          videoClipCount: manifest.tracks.video.length,
          audioClipCount: manifest.tracks.audio.length,
          componentCount: manifest.tracks.components.length,
          backgroundColor: manifest.globalSettings.backgroundColor,
        },
        assets: project.assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          url: asset.storageUrl,
          prompt: asset.prompt?.slice(0, 100),
          durationSeconds: asset.durationSeconds,
          createdAt: asset.createdAt,
        })),
        assetCounts: {
          images: project.assets.filter((a) => a.type === 'image').length,
          videos: project.assets.filter((a) => a.type === 'video').length,
          audio: project.assets.filter((a) => a.type === 'audio').length,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get project state',
    }
  }
}

// =============================================================================
// Tool: generateImage
// =============================================================================

export async function executeGenerateImage(
  args: GenerateImageArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    // Get project for dimensions
    const project = await prisma.project.findUnique({
      where: { id: context.projectId },
      select: { width: true, height: true },
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { preferredImageModel: true, role: true },
    })

    // Determine dimensions from aspect ratio
    let width = project.width
    let height = project.height

    if (args.aspectRatio) {
      const [w, h] = args.aspectRatio.split(':').map(Number)
      // Keep the larger dimension and calculate the other
      if (project.width > project.height) {
        width = project.width
        height = Math.round((project.width * h) / w)
      } else {
        height = project.height
        width = Math.round((project.height * w) / h)
      }
    }

    // Build the full prompt
    let fullPrompt = args.prompt
    if (args.style) {
      fullPrompt += `, ${args.style} style`
    }

    const modelId = user?.preferredImageModel || 'fal-ai/flux-pro/v1.1'

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        type: 'image',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({ prompt: fullPrompt, width, height }),
      },
    })

    // Start async generation
    const falJob = await generateImage({
      prompt: fullPrompt,
      model: modelId,
      width,
      height,
    })

    // Update job with external ID
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { externalId: falJob.requestId, status: 'processing' },
    })

    return {
      success: true,
      data: {
        jobId: job.id,
        status: 'processing',
        message: `Started generating image. This usually takes 10-30 seconds.`,
        prompt: fullPrompt,
        dimensions: `${width}x${height}`,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate image',
    }
  }
}

// =============================================================================
// Tool: generateVideo
// =============================================================================

export async function executeGenerateVideo(
  args: GenerateVideoArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    // Get the source image asset
    const imageAsset = await prisma.asset.findUnique({
      where: { id: args.imageAssetId },
    })

    if (!imageAsset) {
      return {
        success: false,
        error: `Image asset not found: ${args.imageAssetId}`,
      }
    }

    if (imageAsset.type !== 'image') {
      return { success: false, error: 'Asset is not an image' }
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { preferredVideoModel: true, role: true },
    })

    const modelId =
      user?.preferredVideoModel || 'fal-ai/kling-video/v1.5/pro/image-to-video'

    // Create job in database
    const job = await prisma.generationJob.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        type: 'video',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          imageUrl: imageAsset.storageUrl,
          prompt: args.motionPrompt,
          duration: args.duration || 5,
        }),
      },
    })

    // Start async generation
    const falJob = await generateVideo({
      generationType: 'image-to-video',
      imageUrl: imageAsset.storageUrl,
      prompt: args.motionPrompt,
      model: modelId,
      duration: args.duration || 5,
    })

    // Update job with external ID
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { externalId: falJob.requestId, status: 'processing' },
    })

    return {
      success: true,
      data: {
        jobId: job.id,
        status: 'processing',
        message: `Started converting image to video. This usually takes 60-90 seconds.`,
        sourceImageId: args.imageAssetId,
        duration: args.duration || 5,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate video',
    }
  }
}

// =============================================================================
// Tool: generateVoiceover
// =============================================================================

export async function executeGenerateVoiceover(
  args: GenerateVoiceoverArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    // Get user preferences for voice
    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { preferredVoiceId: true },
    })

    // Map voice style to voice name (Fal.ai uses voice names directly)
    const voiceMap: Record<string, string> = {
      'male-narrator': VOICE_NAMES.MALE_NARRATOR,
      'female-narrator': VOICE_NAMES.FEMALE_NARRATOR,
      'male-casual': VOICE_NAMES.MALE_NARRATOR, // Use same for now
      'female-casual': VOICE_NAMES.FEMALE_NARRATOR,
    }

    // Use user's preferred voice (stored in preferredVoiceId), or map from style, or default to Adam
    // Note: preferredVoiceId now stores voice names (e.g., "Rachel") instead of IDs
    const voice =
      user?.preferredVoiceId ||
      voiceMap[args.voiceStyle || 'male-narrator'] ||
      VOICE_NAMES.MALE_NARRATOR

    // Create job record
    const job = await prisma.generationJob.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        type: 'audio',
        status: 'processing',
        provider: 'fal',
        model: 'fal-ai/elevenlabs/tts/multilingual-v2',
        input: JSON.stringify({ text: args.text, voice }),
      },
    })

    // Generate speech via Fal.ai (synchronous - TTS is fast)
    // The service handles re-uploading to Bunny.net for permanent storage
    const storageConfig = await getUserStorageConfig(context.userId)
    const result = await generateSpeech(
      {
        text: args.text,
        voice,
      },
      undefined, // userApiKey (uses service default)
      storageConfig,
    )

    // Create asset record
    const asset = await prisma.asset.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        type: 'audio',
        storageUrl: result.audioUrl,
        filename: `tts-${Date.now()}.mp3`,
        prompt: args.text.slice(0, 500),
        provider: 'fal',
        model: 'fal-ai/elevenlabs/tts/multilingual-v2',
        metadata: JSON.stringify({
          wordTimestamps: result.wordTimestamps,
          voice,
        }),
        durationSeconds: result.duration,
      },
    })

    // Update job as completed
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        output: JSON.stringify({
          url: result.audioUrl,
          assetId: asset.id,
          duration: result.duration,
          wordTimestamps: result.wordTimestamps,
        }),
      },
    })

    return {
      success: true,
      data: {
        assetId: asset.id,
        url: result.audioUrl,
        duration: result.duration,
        wordTimestamps: result.wordTimestamps,
        message: `Generated ${result.duration.toFixed(1)}s voiceover with ${result.wordTimestamps.length} words`,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate voiceover',
    }
  }
}

// =============================================================================
// Tool: updateTimeline
// =============================================================================

export async function executeUpdateTimeline(
  args: UpdateTimelineArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    // Get current project and manifest
    const project = await prisma.project.findUnique({
      where: { id: context.projectId },
      select: { manifest: true, fps: true, userId: true },
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    if (project.userId !== context.userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const manifest = JSON.parse(project.manifest) as ProjectManifest
    const fps = project.fps

    switch (args.action) {
      case 'addVideoClip': {
        if (!args.videoAssetId) {
          return {
            success: false,
            error: 'videoAssetId is required for addVideoClip',
          }
        }

        const asset = await prisma.asset.findUnique({
          where: { id: args.videoAssetId },
        })

        if (!asset || asset.type !== 'video') {
          return { success: false, error: 'Video asset not found' }
        }

        // Calculate end of current timeline
        const lastEndFrame = manifest.tracks.video.reduce(
          (max, clip) => Math.max(max, clip.startFrame + clip.durationFrames),
          0,
        )

        const durationFrames =
          args.durationFrames ||
          (asset.durationSeconds
            ? Math.round(asset.durationSeconds * fps)
            : 150)

        const newClip: VideoClip = {
          id: `video-${Date.now()}`,
          assetId: asset.id,
          url: asset.storageUrl,
          startFrame: args.startFrame ?? lastEndFrame,
          durationFrames,
          layer: args.layer ?? 0,
        }

        manifest.tracks.video.push(newClip)
        break
      }

      case 'addAudioClip': {
        if (!args.audioAssetId) {
          return {
            success: false,
            error: 'audioAssetId is required for addAudioClip',
          }
        }

        const asset = await prisma.asset.findUnique({
          where: { id: args.audioAssetId },
        })

        if (!asset || asset.type !== 'audio') {
          return { success: false, error: 'Audio asset not found' }
        }

        const metadata = asset.metadata ? JSON.parse(asset.metadata) : {}

        const durationFrames =
          args.durationFrames ||
          (asset.durationSeconds
            ? Math.round(asset.durationSeconds * fps)
            : 150)

        const newClip: AudioClip = {
          id: `audio-${Date.now()}`,
          assetId: asset.id,
          url: asset.storageUrl,
          startFrame: args.startFrame ?? 0,
          durationFrames,
          volume: 1,
          wordTimestamps: metadata.wordTimestamps,
        }

        manifest.tracks.audio.push(newClip)
        break
      }

      case 'addTextOverlay': {
        if (!args.textOverlayType || !args.textOverlayText) {
          return {
            success: false,
            error:
              'textOverlayType and textOverlayText are required for addTextOverlay',
          }
        }

        const newOverlay: ComponentOverlay = {
          id: `text-${Date.now()}`,
          component: args.textOverlayType,
          props: {
            text: args.textOverlayText,
            position: args.textOverlayPosition || 'center',
            fontSize: args.textOverlayFontSize || 48,
            color: args.textOverlayColor || '#FFFFFF',
          },
          startFrame: args.startFrame ?? 0,
          durationFrames: args.durationFrames ?? 90, // Default 3 seconds
          layer: args.layer ?? 10,
        }

        manifest.tracks.components.push(newOverlay)
        break
      }

      case 'removeClip': {
        if (!args.clipId) {
          return { success: false, error: 'clipId is required for removeClip' }
        }

        // Try to find and remove from each track type
        let removed = false

        const videoIndex = manifest.tracks.video.findIndex(
          (c) => c.id === args.clipId,
        )
        if (videoIndex !== -1) {
          manifest.tracks.video.splice(videoIndex, 1)
          removed = true
        }

        const audioIndex = manifest.tracks.audio.findIndex(
          (c) => c.id === args.clipId,
        )
        if (audioIndex !== -1) {
          manifest.tracks.audio.splice(audioIndex, 1)
          removed = true
        }

        const compIndex = manifest.tracks.components.findIndex(
          (c) => c.id === args.clipId,
        )
        if (compIndex !== -1) {
          manifest.tracks.components.splice(compIndex, 1)
          removed = true
        }

        if (!removed) {
          return { success: false, error: `Clip not found: ${args.clipId}` }
        }
        break
      }

      case 'moveClip': {
        if (!args.clipId || args.newStartFrame === undefined) {
          return {
            success: false,
            error: 'clipId and newStartFrame are required for moveClip',
          }
        }

        let moved = false

        const videoClip = manifest.tracks.video.find(
          (c) => c.id === args.clipId,
        )
        if (videoClip) {
          videoClip.startFrame = args.newStartFrame
          moved = true
        }

        const audioClip = manifest.tracks.audio.find(
          (c) => c.id === args.clipId,
        )
        if (audioClip) {
          audioClip.startFrame = args.newStartFrame
          moved = true
        }

        const compClip = manifest.tracks.components.find(
          (c) => c.id === args.clipId,
        )
        if (compClip) {
          compClip.startFrame = args.newStartFrame
          moved = true
        }

        if (!moved) {
          return { success: false, error: `Clip not found: ${args.clipId}` }
        }
        break
      }

      case 'setBackground': {
        if (!args.backgroundColor) {
          return {
            success: false,
            error: 'backgroundColor is required for setBackground',
          }
        }

        manifest.globalSettings.backgroundColor = args.backgroundColor
        break
      }

      default:
        return { success: false, error: `Unknown action: ${args.action}` }
    }

    // Calculate new duration
    let maxFrame = 0
    for (const clip of manifest.tracks.video) {
      maxFrame = Math.max(maxFrame, clip.startFrame + clip.durationFrames)
    }
    for (const clip of manifest.tracks.audio) {
      maxFrame = Math.max(maxFrame, clip.startFrame + clip.durationFrames)
    }
    for (const comp of manifest.tracks.components) {
      maxFrame = Math.max(maxFrame, comp.startFrame + comp.durationFrames)
    }

    // Save updated manifest
    await prisma.project.update({
      where: { id: context.projectId },
      data: {
        manifest: JSON.stringify(manifest),
        duration: maxFrame,
      },
    })

    return {
      success: true,
      data: {
        action: args.action,
        totalDuration: maxFrame,
        totalDurationSeconds: maxFrame / fps,
        clipCounts: {
          video: manifest.tracks.video.length,
          audio: manifest.tracks.audio.length,
          components: manifest.tracks.components.length,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update timeline',
    }
  }
}

// =============================================================================
// Tool: listAssets
// =============================================================================

export async function executeListAssets(
  args: ListAssetsArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    const assets = await prisma.asset.findMany({
      where: {
        projectId: context.projectId,
        userId: context.userId,
        ...(args.type && args.type !== 'all' && { type: args.type }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return {
      success: true,
      data: {
        count: assets.length,
        assets: assets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          url: asset.storageUrl,
          prompt: asset.prompt?.slice(0, 100),
          durationSeconds: asset.durationSeconds,
          metadata: asset.metadata ? JSON.parse(asset.metadata) : null,
          createdAt: asset.createdAt,
        })),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list assets',
    }
  }
}

// =============================================================================
// Main Executor
// =============================================================================

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  toolName: string,
  args: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  switch (toolName) {
    case TOOL_NAMES.GET_PROJECT_STATE:
      return executeGetProjectState(context)

    case TOOL_NAMES.GENERATE_IMAGE:
      return executeGenerateImage(args as GenerateImageArgs, context)

    case TOOL_NAMES.GENERATE_VIDEO:
      return executeGenerateVideo(args as GenerateVideoArgs, context)

    case TOOL_NAMES.GENERATE_VOICEOVER:
      return executeGenerateVoiceover(args as GenerateVoiceoverArgs, context)

    case TOOL_NAMES.UPDATE_TIMELINE:
      return executeUpdateTimeline(args as UpdateTimelineArgs, context)

    case TOOL_NAMES.LIST_ASSETS:
      return executeListAssets(args as ListAssetsArgs, context)

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
