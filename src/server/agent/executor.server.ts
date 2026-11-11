/**
 * Tool Executor
 *
 * Executes agent tools and returns results.
 * Each tool function handles validation, execution, and error handling.
 */

import { prisma } from '../../db.server'
import {
  imageJobCost,
  musicJobCost,
  speechJobCost,
  videoJobCost,
} from '../../lib/job-cost'
import {
  addClip,
  appendClip,
  clipCount,
  findClip,
  generateImage,
  generateSpeech,
  generateVideo,
  migrateManifest,
  newId,
  removeClip,
  sequenceEndFrame,
  tracksOfKind,
  updateClip,
} from '../services/index.server'
import { getUserStorageConfig } from '../storage-config.server'
import { getUserFalApiKey } from '../byok.server'
import {
  clampDuration as clampMusicDuration,
  generateMusic,
} from '../services/music.server'
import {
  DEFAULT_MODELS,
  IMAGE_MODELS,
  MUSIC_MODELS,
  VIDEO_MODELS,
  resolveModelId,
} from '../services/types'
import { TOOL_NAMES } from './tools.server'
import {
  applyPlanEdit,
  buildPlan,
  modelName,
  parsePlan,
  planPhase,
  planTotals,
  priceShot,
  shotBusy,
} from '../../lib/production'
import {
  requestRender,
  savePlan,
  withProjectLock,
} from './production.server'
import {
  isVoice,
  parseBible,
  resolveCast,
  summarizeBible,
  upsertEntries,
} from '../../lib/bible'
import { saveBible } from './production.server'
import type { ProjectBible } from '../../lib/bible'
import type { ProductionPlan } from '../../lib/production'
import type { ProjectManifest, TrackKind } from '../services/index.server'
import type {
  GenerateImageArgs,
  GenerateMusicArgs,
  GenerateVideoArgs,
  GenerateVoiceoverArgs,
  ListAssetsArgs,
  ProposePlanArgs,
  RenderPlanArgs,
  UpdateBibleArgs,
  UpdateShotArgs,
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

    const manifest = migrateManifest(project.manifest)
    const countOfKind = (kind: TrackKind) =>
      tracksOfKind(manifest, kind).reduce((n, t) => n + t.clips.length, 0)

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
          videoClipCount: countOfKind('video'),
          audioClipCount: countOfKind('voice'),
          musicClipCount: countOfKind('music'),
          componentCount: countOfKind('component'),
          totalClipCount: clipCount(manifest),
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
          music: project.assets.filter((a) => a.type === 'music').length,
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

    // A stored preference may name a model we have since retired
    const modelId = resolveModelId(
      user?.preferredImageModel,
      IMAGE_MODELS,
      DEFAULT_MODELS.image,
    )

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
        estimatedCostUsd: imageJobCost(modelId, { width, height }),
      },
    })

    // Start async generation on the user's own fal key (BYOK)
    const userApiKey = await getUserFalApiKey(context.userId)
    const falJob = await generateImage(
      {
        prompt: fullPrompt,
        model: modelId,
        width,
        height,
      },
      userApiKey,
    )

    // Update job with external ID
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        externalId: falJob.requestId,
        statusUrl: falJob.statusUrl,
        responseUrl: falJob.responseUrl,
        cancelUrl: falJob.cancelUrl,
        status: 'processing',
      },
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

    // Only image-to-video models qualify: the Director animates stills
    const modelId = resolveModelId(
      user?.preferredVideoModel,
      VIDEO_MODELS.filter((m) => m.capabilities.includes('image-to-video')),
      DEFAULT_MODELS.imageToVideo,
    )

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
        estimatedCostUsd: videoJobCost(modelId, {
          duration: args.duration || 5,
        }),
      },
    })

    // Start async generation on the user's own fal key (BYOK)
    const userApiKey = await getUserFalApiKey(context.userId)
    const falJob = await generateVideo(
      {
        generationType: 'image-to-video',
        imageUrl: imageAsset.storageUrl,
        prompt: args.motionPrompt,
        model: modelId,
        duration: args.duration || 5,
      },
      userApiKey,
    )

    // Update job with external ID
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        externalId: falJob.requestId,
        statusUrl: falJob.statusUrl,
        responseUrl: falJob.responseUrl,
        cancelUrl: falJob.cancelUrl,
        status: 'processing',
      },
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
        model: DEFAULT_MODELS.tts,
        input: JSON.stringify({ text: args.text, voice }),
        estimatedCostUsd: speechJobCost(DEFAULT_MODELS.tts, args.text),
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
      await getUserFalApiKey(context.userId),
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
        model: DEFAULT_MODELS.tts,
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
// Tool: generateMusic
// =============================================================================

/**
 * Score the project. Music is a queued job like video — this returns the job
 * id, and the finished track shows up as a music asset on the next poll.
 */
export async function executeGenerateMusic(
  args: GenerateMusicArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    const modelId = MUSIC_MODELS[0].id
    const durationSec = clampMusicDuration(args.durationSec, modelId)
    const instrumental = args.instrumental ?? !args.lyrics?.trim()

    const userApiKey = await getUserFalApiKey(context.userId)
    const job = await generateMusic(
      {
        prompt: args.prompt,
        model: modelId,
        lyrics: args.lyrics,
        instrumental,
        durationSec,
      },
      userApiKey,
    )

    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        type: 'music',
        status: 'pending',
        provider: 'fal',
        model: modelId,
        input: JSON.stringify({
          prompt: args.prompt,
          lyrics: args.lyrics,
          instrumental,
          durationSec,
          title: args.title,
        }),
        estimatedCostUsd: musicJobCost(modelId, durationSec),
        externalId: job.requestId,
        statusUrl: job.statusUrl,
        responseUrl: job.responseUrl,
        cancelUrl: job.cancelUrl,
      },
    })

    return {
      success: true,
      data: {
        jobId: dbJob.id,
        model: modelId,
        durationSec,
        instrumental,
        message: `Writing a ${durationSec}s ${
          instrumental ? 'instrumental' : 'vocal'
        } track. It will appear as a music asset when it is done.`,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to generate music',
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

    let manifest: ProjectManifest = migrateManifest(project.manifest)
    const fps = project.fps

    /** `layer` used to mean z-order; in v2 it is the nth lane of a kind */
    const laneIndex = args.layer !== undefined ? Math.max(0, args.layer) : 0

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

        if (!asset || (asset.type !== 'video' && asset.type !== 'image')) {
          return { success: false, error: 'Video asset not found' }
        }

        const durationFrames =
          args.durationFrames ||
          (asset.durationSeconds
            ? Math.round(asset.durationSeconds * fps)
            : 150)

        manifest = appendClip(
          manifest,
          'video',
          {
            id: newId('video'),
            kind: asset.type === 'image' ? 'image' : 'video',
            assetId: asset.id,
            url: asset.storageUrl,
            label: asset.filename,
            startFrame: args.startFrame,
            durationFrames,
            sourceInFrame: 0,
            transitionFrames: 0,
            gain: 1,
          },
          laneIndex,
        ).manifest
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

        if (!asset || (asset.type !== 'audio' && asset.type !== 'music')) {
          return { success: false, error: 'Audio asset not found' }
        }

        const metadata = asset.metadata ? JSON.parse(asset.metadata) : {}

        const durationFrames =
          args.durationFrames ||
          (asset.durationSeconds
            ? Math.round(asset.durationSeconds * fps)
            : 150)

        // Voice takes go on the Voice lane, scores on the Music lane, so the
        // mixer can duck one under the other.
        const kind: TrackKind = asset.type === 'music' ? 'music' : 'voice'

        manifest = addClip(
          manifest,
          kind,
          {
            id: newId('audio'),
            kind: 'audio',
            assetId: asset.id,
            url: asset.storageUrl,
            label: asset.filename,
            startFrame: args.startFrame ?? 0,
            durationFrames,
            sourceInFrame: 0,
            transitionFrames: 0,
            gain: 1,
            wordTimestamps: metadata.wordTimestamps,
          },
          laneIndex,
        ).manifest
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

        manifest = addClip(
          manifest,
          'component',
          {
            id: newId('text'),
            kind: 'component',
            label: args.textOverlayText.slice(0, 40),
            component: args.textOverlayType,
            props: {
              text: args.textOverlayText,
              position: args.textOverlayPosition || 'center',
              fontSize: args.textOverlayFontSize || 48,
              color: args.textOverlayColor || '#FFFFFF',
            },
            startFrame: args.startFrame ?? 0,
            durationFrames: args.durationFrames ?? 90, // Default 3 seconds
            sourceInFrame: 0,
            transitionFrames: 0,
            gain: 1,
          },
          0,
        ).manifest
        break
      }

      case 'removeClip': {
        if (!args.clipId) {
          return { success: false, error: 'clipId is required for removeClip' }
        }

        if (!findClip(manifest, args.clipId)) {
          return { success: false, error: `Clip not found: ${args.clipId}` }
        }

        manifest = removeClip(manifest, args.clipId)
        break
      }

      case 'moveClip': {
        if (!args.clipId || args.newStartFrame === undefined) {
          return {
            success: false,
            error: 'clipId and newStartFrame are required for moveClip',
          }
        }

        if (!findClip(manifest, args.clipId)) {
          return { success: false, error: `Clip not found: ${args.clipId}` }
        }

        manifest = updateClip(manifest, args.clipId, {
          startFrame: Math.max(0, Math.round(args.newStartFrame)),
        })
        break
      }

      case 'setBackground': {
        if (!args.backgroundColor) {
          return {
            success: false,
            error: 'backgroundColor is required for setBackground',
          }
        }

        manifest = {
          ...manifest,
          globalSettings: {
            ...manifest.globalSettings,
            backgroundColor: args.backgroundColor,
          },
        }
        break
      }

      default:
        return { success: false, error: `Unknown action: ${args.action}` }
    }

    const maxFrame = sequenceEndFrame(manifest)

    // Save updated manifest
    await prisma.project.update({
      where: { id: context.projectId },
      data: {
        manifest: JSON.stringify(manifest),
        duration: maxFrame,
      },
    })

    const countOfKind = (kind: TrackKind) =>
      tracksOfKind(manifest, kind).reduce((n, t) => n + t.clips.length, 0)

    return {
      success: true,
      data: {
        action: args.action,
        totalDuration: maxFrame,
        totalDurationSeconds: maxFrame / fps,
        clipCounts: {
          video: countOfKind('video'),
          audio: countOfKind('voice'),
          music: countOfKind('music'),
          components: countOfKind('component'),
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
// Director v2: plans
// =============================================================================

/** What the model sees of a plan — the numbers come from the server */
export function summarizePlan(
  plan: ProductionPlan,
  budgetUsd: number,
  bible?: ProjectBible,
) {
  const names = new Map((bible?.entries ?? []).map((e) => [e.id, e.name]))
  const totals = planTotals(plan)
  return {
    title: plan.title,
    format: plan.format,
    phase: planPhase(plan),
    models: {
      draft: modelName(plan.models.draft),
      final: `${modelName(plan.models.final.model)}${plan.models.final.resolution ? ` ${plan.models.final.resolution}` : ''}`,
    },
    shots: plan.shots.map((s, i) => {
      const p = priceShot(s, plan.models, plan.aspectRatio)
      return {
        n: i + 1,
        title: s.title,
        durationSec: s.durationSec,
        ...(s.cast?.length
          ? { cast: s.cast.map((id) => names.get(id)).filter(Boolean) }
          : {}),
        draftUsd: +(p.stillUsd + p.draftUsd).toFixed(3),
        finalUsd: +p.finalUsd.toFixed(3),
        draft: s.draft?.status,
        check: s.check?.note,
        decision: s.decision,
        final: s.final?.status,
      }
    }),
    totals: {
      draftUsd: totals.draftUsd,
      finalUsd: totals.finalUsd,
      directUsd: totals.directUsd,
    },
    budgetUsd,
    spentUsd: plan.spentUsd,
    notice: plan.stopped ?? plan.notice,
  }
}

export async function executeProposePlan(
  args: ProposePlanArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    return await withProjectLock(context.projectId, async () => {
      const project = await prisma.project.findUnique({
        where: { id: context.projectId },
        select: {
          userId: true,
          width: true,
          height: true,
          budgetUsd: true,
          plan: true,
          bible: true,
        },
      })
      if (!project || project.userId !== context.userId) {
        return { success: false, error: 'Project not found' }
      }
      const bible = parseBible(project.bible)
      const previous = parsePlan(project.plan)
      if (previous?.shots.some(shotBusy)) {
        return {
          success: false,
          error:
            'A render of the current plan is still running. Wait for it, or change single shots with updateShot.',
        }
      }
      const unknown = new Set<string>()
      const shots = args.shots.map((shot) => {
        const cast = resolveCast(bible, shot.cast)
        for (const name of shot.cast ?? []) {
          if (!resolveCast(bible, [name]).length) unknown.add(name)
        }
        return { ...shot, cast }
      })
      const plan = buildPlan({ ...args, shots }, {
        budgetUsd: project.budgetUsd,
        width: project.width,
        height: project.height,
      })
      // the budget is the project's: what earlier plans spent still counts
      plan.spentUsd = previous?.spentUsd ?? 0
      await savePlan(context.projectId, plan)
      return {
        success: true,
        data: {
          ...summarizePlan(plan, project.budgetUsd, bible),
          ...(unknown.size
            ? {
                warning: `Not in the Bible, left out of the cast: ${[...unknown].join(', ')}. Add them with updateBible first.`,
              }
            : {}),
        },
      }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save the plan',
    }
  }
}

export async function executeUpdateShot(
  args: UpdateShotArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    return await withProjectLock(context.projectId, async () => {
      const project = await prisma.project.findUnique({
        where: { id: context.projectId },
        select: { userId: true, plan: true, budgetUsd: true, bible: true },
      })
      const plan = parsePlan(project?.plan)
      const bible = parseBible(project?.bible)
      if (!project || project.userId !== context.userId || !plan) {
        return { success: false, error: 'There is no plan to change — propose one first.' }
      }
      const index = Math.round(args.shotNumber) - 1
      const shot = plan.shots[index]
      if (!shot) {
        return { success: false, error: `There is no shot ${args.shotNumber}.` }
      }
      if (shotBusy(shot)) {
        return { success: false, error: `Shot ${args.shotNumber} is still rendering.` }
      }
      const next = applyPlanEdit(plan, {
        shots: plan.shots.map((s, i) =>
          i === index
            ? {
                id: s.id,
                title: args.title ?? s.title,
                description: args.description ?? s.description,
                durationSec: args.durationSec ?? s.durationSec,
                prompt: args.prompt ?? s.prompt,
                motion: args.motion ?? s.motion,
                cast: args.cast ? resolveCast(bible, args.cast) : s.cast,
              }
            : s,
        ),
      })
      await savePlan(context.projectId, next)
      return { success: true, data: summarizePlan(next, project.budgetUsd, bible) }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update the shot',
    }
  }
}

export async function executeRenderPlan(
  args: RenderPlanArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    const { message } = await requestRender(context, args.stage)
    return { success: true, data: { message } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start the render',
    }
  }
}

export async function executeUpdateBible(
  args: UpdateBibleArgs,
  context: ToolContext,
): Promise<ToolResult> {
  try {
    return await withProjectLock(context.projectId, async () => {
      const project = await prisma.project.findUnique({
        where: { id: context.projectId },
        select: { userId: true, bible: true },
      })
      if (!project || project.userId !== context.userId) {
        return { success: false, error: 'Project not found' }
      }
      let bible = parseBible(project.bible)
      if (args.style !== undefined) bible.style = args.style.trim()
      if (isVoice(args.voice)) bible.voice = args.voice
      if (args.entries?.length) bible = upsertEntries(bible, args.entries)
      await saveBible(context.projectId, bible)
      return { success: true, data: summarizeBible(bible) }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update the Bible',
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

    case TOOL_NAMES.GENERATE_MUSIC:
      return executeGenerateMusic(args as GenerateMusicArgs, context)

    case TOOL_NAMES.UPDATE_TIMELINE:
      return executeUpdateTimeline(args as UpdateTimelineArgs, context)

    case TOOL_NAMES.LIST_ASSETS:
      return executeListAssets(args as ListAssetsArgs, context)

    case TOOL_NAMES.PROPOSE_PLAN:
      return executeProposePlan(args as ProposePlanArgs, context)

    case TOOL_NAMES.UPDATE_SHOT:
      return executeUpdateShot(args as UpdateShotArgs, context)

    case TOOL_NAMES.RENDER_PLAN:
      return executeRenderPlan(args as RenderPlanArgs, context)

    case TOOL_NAMES.UPDATE_BIBLE:
      return executeUpdateBible(args as UpdateBibleArgs, context)

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}
