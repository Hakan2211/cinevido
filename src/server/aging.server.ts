/**
 * AI Baby & Aging Generator Server Functions
 *
 * Server functions for age transformation operations:
 * - Single person: Age progression/regression from one photo
 * - Multi person: Baby prediction from two parent photos
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db.server'
import { authMiddleware } from './middleware.server'
import { getUserFalApiKey } from './byok.server'
import { generateAging, getJobStatus } from './services/fal.server'
import { AGE_GROUPS, AGING_MODELS, getAgingModelByType } from './services/types'
import { uploadFromUrl } from './services/bunny.server'
import { getUserStorageConfig } from './storage-config.server'

// =============================================================================
// Schemas
// =============================================================================

const ageGroupValues = AGE_GROUPS.map((g) => g.id) as [string, ...Array<string>]

const agingSchema = z.object({
  subMode: z.enum(['single', 'multi']),
  ageGroup: z.enum(ageGroupValues),
  gender: z.enum(['male', 'female']),
  prompt: z.string().max(1000).optional(),
  imageSize: z
    .object({
      width: z.number().min(256).max(2048),
      height: z.number().min(256).max(2048),
    })
    .optional(),
  numImages: z.number().min(1).max(4).optional(),
  seed: z.number().optional(),
  outputFormat: z.enum(['jpeg', 'png']).optional(),
  // Single mode
  idImageUrls: z.array(z.string().url()).optional(),
  sourceAssetId: z.string().optional(), // For linking to original asset
  // Multi mode
  motherImageUrls: z.array(z.string().url()).optional(),
  fatherImageUrls: z.array(z.string().url()).optional(),
  motherAssetId: z.string().optional(),
  fatherAssetId: z.string().optional(),
  fatherWeight: z.number().min(0).max(1).optional(),
  projectId: z.string().optional(),
})

const jobIdSchema = z.object({
  jobId: z.string(),
})

// =============================================================================
// Generate Aging
// =============================================================================

/**
 * Start an aging job - transform photos by age
 * - Single: Age progression/regression from one person's photo
 * - Multi: Predict what a baby would look like from two parent photos
 */
export const generateAgingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(agingSchema)
  .handler(async ({ data, context }) => {
    console.log('[AGING_FN] generateAgingFn called:', {
      userId: context.user.id,
      subMode: data.subMode,
      ageGroup: data.ageGroup,
      gender: data.gender,
    })

    const modelConfig = getAgingModelByType(data.subMode)
    if (!modelConfig) {
      console.error('[AGING_FN] Unknown subMode:', data.subMode)
      throw new Error(`Unknown aging mode: ${data.subMode}`)
    }

    // Validate required inputs based on mode
    if (data.subMode === 'single') {
      if (!data.idImageUrls || data.idImageUrls.length === 0) {
        throw new Error(
          'At least one image is required for single person aging',
        )
      }
    } else {
      if (!data.motherImageUrls || data.motherImageUrls.length === 0) {
        throw new Error('Mother image is required for baby prediction')
      }
      if (!data.fatherImageUrls || data.fatherImageUrls.length === 0) {
        throw new Error('Father image is required for baby prediction')
      }
    }

    // Get user's fal.ai API key (BYOK)
    const userApiKey = await getUserFalApiKey(context.user.id)

    // Start aging job
    console.log('[AGING_FN] Starting aging job...')
    const job = await generateAging(
      {
        subMode: data.subMode,
        ageGroup: data.ageGroup as any,
        gender: data.gender,
        prompt: data.prompt,
        imageSize: data.imageSize,
        numImages: data.numImages,
        seed: data.seed,
        outputFormat: data.outputFormat,
        idImageUrls: data.idImageUrls,
        motherImageUrls: data.motherImageUrls,
        fatherImageUrls: data.fatherImageUrls,
        fatherWeight: data.fatherWeight,
      },
      userApiKey,
    )

    console.log('[AGING_FN] Aging job started:', {
      requestId: job.requestId,
      status: job.status,
      statusUrl: job.statusUrl,
      responseUrl: job.responseUrl,
    })

    // Create job record - save all inputs and URLs for later polling
    const dbJob = await prisma.generationJob.create({
      data: {
        userId: context.user.id,
        projectId: data.projectId || null,
        type: 'image', // Store as image type since output is images
        status: 'pending',
        provider: 'fal',
        model: modelConfig.id,
        input: JSON.stringify({
          subMode: data.subMode,
          ageGroup: data.ageGroup,
          gender: data.gender,
          prompt: data.prompt,
          numImages: data.numImages,
          // Source asset tracking
          sourceAssetId: data.sourceAssetId,
          motherAssetId: data.motherAssetId,
          fatherAssetId: data.fatherAssetId,
          fatherWeight: data.fatherWeight,
          // Save fal.ai queue URLs for status polling
          statusUrl: job.statusUrl,
          responseUrl: job.responseUrl,
        }),
        externalId: job.requestId,
      },
    })

    console.log('[AGING_FN] DB job created:', {
      dbJobId: dbJob.id,
      externalId: job.requestId,
    })

    return {
      jobId: dbJob.id,
      externalId: job.requestId,
      model: modelConfig.id,
      subMode: data.subMode,
      status: 'pending',
    }
  })

// =============================================================================
// Job Status
// =============================================================================

/**
 * Check the status of an aging job
 */
export const getAgingJobStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(jobIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[AGING_FN] getAgingJobStatusFn called:', { jobId: data.jobId })

    const job = await prisma.generationJob.findUnique({
      where: { id: data.jobId },
    })

    if (!job) {
      console.error('[AGING_FN] Job not found:', data.jobId)
      throw new Error('Job not found')
    }

    console.log('[AGING_FN] Found job:', {
      id: job.id,
      status: job.status,
      externalId: job.externalId,
      model: job.model,
    })

    if (job.userId !== context.user.id) {
      throw new Error('Unauthorized')
    }

    // If already completed or failed, return cached result
    if (job.status === 'completed' || job.status === 'failed') {
      console.log('[AGING_FN] Returning cached result, status:', job.status)
      return {
        jobId: job.id,
        status: job.status,
        progress: job.status === 'completed' ? 100 : 0,
        output: job.output ? JSON.parse(job.output) : null,
        error: job.error,
      }
    }

    // Poll Fal.ai for status using the saved URLs
    if (!job.externalId) {
      console.error('[AGING_FN] Job has no external ID!')
      throw new Error('Job has no external ID')
    }

    // Get statusUrl and responseUrl from saved input
    const inputData = JSON.parse(job.input)
    const { statusUrl, responseUrl } = inputData

    if (!statusUrl || !responseUrl) {
      console.error('[AGING_FN] Job missing statusUrl or responseUrl!', {
        statusUrl,
        responseUrl,
      })
      throw new Error('Job is missing fal.ai queue URLs')
    }

    console.log('[AGING_FN] Polling fal.ai for status using saved URLs...')
    let falStatus: Awaited<ReturnType<typeof getJobStatus>>
    try {
      // Get user's API key for polling (supports admin fallback to FAL_KEY)
      const userApiKey = await getUserFalApiKey(job.userId)
      falStatus = await getJobStatus(statusUrl, responseUrl, userApiKey)
      console.log('[AGING_FN] fal.ai status result:', {
        status: falStatus.status,
        hasResult: !!falStatus.result,
      })
    } catch (pollError) {
      // Handle unexpected errors during status polling
      const errorMessage =
        pollError instanceof Error ? pollError.message : 'Status check failed'
      console.error('[AGING_FN] Status polling error:', errorMessage)

      // Update job as failed in database
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: errorMessage,
      }
    }

    // Update job status in database
    if (falStatus.status === 'completed' && falStatus.result) {
      console.log('[AGING_FN] Job completed! Processing result...')
      const result = falStatus.result as {
        images?: Array<{ url: string; width: number; height: number }>
        image?: { url: string; width: number; height: number }
        seed?: number
        prompt?: string
      }

      // Handle both 'images' array and single 'image' response formats
      const images = result.images || (result.image ? [result.image] : [])

      if (images.length > 0) {
        const uploadedAssets: Array<{
          url: string
          assetId: string
          width: number
          height: number
        }> = []

        // Get user's storage config once before the loop
        const storageConfig = await getUserStorageConfig(context.user.id)

        // Upload each generated image to Bunny CDN and create assets
        for (let i = 0; i < images.length; i++) {
          const img = images[i]
          const filename = `aging-${inputData.subMode}-${inputData.ageGroup}-${Date.now()}-${i}.${inputData.outputFormat || 'jpeg'}`

          let permanentUrl = img.url

          console.log(
            `[AGING_FN] Uploading image ${i + 1}/${images.length} to Bunny CDN...`,
          )
          try {
            const uploadResult = await uploadFromUrl(
              img.url,
              {
                folder: `images/${context.user.id}`,
                filename,
              },
              storageConfig ?? undefined,
            )
            permanentUrl = uploadResult.url
            console.log('[AGING_FN] Bunny upload success:', permanentUrl)
          } catch (uploadError) {
            console.error(
              '[AGING_FN] Failed to upload to Bunny CDN:',
              uploadError,
            )
            console.log('[AGING_FN] Falling back to FAL temp URL')
          }

          // Create asset for the generated image
          const asset = await prisma.asset.create({
            data: {
              userId: context.user.id,
              projectId: job.projectId,
              type: 'image',
              storageUrl: permanentUrl,
              filename,
              prompt:
                inputData.prompt || `${inputData.ageGroup} ${inputData.gender}`,
              provider: 'fal',
              model: job.model,
              metadata: JSON.stringify({
                width: img.width,
                height: img.height,
                seed: result.seed,
                subMode: inputData.subMode,
                ageGroup: inputData.ageGroup,
                gender: inputData.gender,
                sourceAssetId: inputData.sourceAssetId,
                motherAssetId: inputData.motherAssetId,
                fatherAssetId: inputData.fatherAssetId,
                fatherWeight: inputData.fatherWeight,
              }),
            },
          })

          uploadedAssets.push({
            url: permanentUrl,
            assetId: asset.id,
            width: img.width,
            height: img.height,
          })

          console.log('[AGING_FN] Asset created:', asset.id)
        }

        // Update job as completed
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            progress: 100,
            output: JSON.stringify({
              images: uploadedAssets,
              subMode: inputData.subMode,
              ageGroup: inputData.ageGroup,
              gender: inputData.gender,
            }),
          },
        })
        console.log('[AGING_FN] Job marked as completed')

        return {
          jobId: job.id,
          status: 'completed' as const,
          progress: 100,
          output: {
            images: uploadedAssets,
            subMode: inputData.subMode,
            ageGroup: inputData.ageGroup,
            gender: inputData.gender,
          },
        }
      }
    }

    if (falStatus.status === 'failed') {
      console.error('[AGING_FN] Job failed!', falStatus.error)
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: falStatus.error || 'Aging generation failed',
        },
      })

      return {
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        error: falStatus.error || 'Aging generation failed',
      }
    }

    // Still processing
    const progress =
      falStatus.progress || (falStatus.status === 'processing' ? 50 : 10)

    console.log('[AGING_FN] Job still in progress:', {
      falStatus: falStatus.status,
      progress,
    })

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: falStatus.status === 'processing' ? 'processing' : 'pending',
        progress,
      },
    })

    return {
      jobId: job.id,
      status: falStatus.status === 'processing' ? 'processing' : 'pending',
      progress,
    }
  })

// =============================================================================
// Model Info
// =============================================================================

/**
 * Get available aging models
 */
export const getAgingModelsFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return {
      models: AGING_MODELS,
      ageGroups: AGE_GROUPS,
    }
  },
)
