/**
 * Packshots — a Bible cut-out placed, untouched, on a generated set.
 *
 * The background still comes from the shot's prompt (told to leave the
 * centre empty); this places the transparent product on it, standing in the
 * lower middle with a soft contact shadow, and saves the result as the
 * shot's still. Draft and final then animate it like any still, so the label
 * and shape stay exactly what the user uploaded. No fal cost.
 */

import sharp from 'sharp'
import { prisma } from '../../db.server'
import { uploadBuffer } from './bunny.server'
import { getUserStorageConfig } from '../storage-config.server'

const MOCK = process.env.MOCK_GENERATION === 'true'

/** How big the product stands in the frame, and where its base sits */
export const PACKSHOT_LAYOUT = {
  maxHeight: 0.56,
  maxWidth: 0.5,
  /** the product's bottom edge, as a fraction of the frame height */
  baseline: 0.86,
} as const

async function fetchBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  }
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Could not load ${url.slice(0, 80)} (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/** The product's place in a frame of this size (pure, for tests) */
export function packshotPlacement(
  frame: { width: number; height: number },
  product: { width: number; height: number },
): { width: number; height: number; left: number; top: number } {
  const scale = Math.min(
    (frame.height * PACKSHOT_LAYOUT.maxHeight) / product.height,
    (frame.width * PACKSHOT_LAYOUT.maxWidth) / product.width,
  )
  const width = Math.max(1, Math.round(product.width * scale))
  const height = Math.max(1, Math.round(product.height * scale))
  const left = Math.round((frame.width - width) / 2)
  const top = Math.max(
    0,
    Math.round(frame.height * PACKSHOT_LAYOUT.baseline - height),
  )
  return { width, height, left, top }
}

export async function composePackshot(args: {
  backgroundUrl: string
  cutoutUrl: string
  userId: string
  projectId: string
  shotId?: string
  title: string
}): Promise<{ url: string; assetId: string }> {
  const [bgBuf, cutBuf] = await Promise.all([
    fetchBuffer(args.backgroundUrl),
    fetchBuffer(args.cutoutUrl),
  ])
  const bg = sharp(bgBuf)
  const meta = await bg.metadata()
  const frame = { width: meta.width ?? 1024, height: meta.height ?? 1024 }

  // drop the cut-out's empty margins so "stands on the surface" is true
  let product = sharp(cutBuf).ensureAlpha()
  try {
    product = sharp(await product.trim({ threshold: 1 }).png().toBuffer())
  } catch {
    // nothing to trim (or trim refused): keep the image as it is
  }
  const pm = await product.metadata()
  const place = packshotPlacement(frame, {
    width: pm.width ?? 1,
    height: pm.height ?? 1,
  })
  const productPng = await product
    .resize(place.width, place.height, { fit: 'fill' })
    .png()
    .toBuffer()

  // a soft contact shadow under the product's base
  const sw = Math.round(place.width * 0.9)
  const sh = Math.max(6, Math.round(place.height * 0.07))
  const pad = sh * 2
  const shadow = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sw + pad * 2}" height="${sh + pad * 2}">` +
        `<ellipse cx="${sw / 2 + pad}" cy="${sh / 2 + pad}" rx="${sw / 2}" ry="${sh / 2}" fill="black" fill-opacity="0.45"/></svg>`,
    ),
  )
    .blur(Math.max(1, sh / 2))
    .png()
    .toBuffer()
  const shadowLeft = Math.round(frame.width / 2 - sw / 2 - pad)
  const shadowTop = Math.round(place.top + place.height - sh / 2 - pad)

  const overlays: Array<sharp.OverlayOptions> = []
  if (
    shadowLeft >= 0 &&
    shadowTop >= 0 &&
    shadowLeft + sw + pad * 2 <= frame.width &&
    shadowTop + sh + pad * 2 <= frame.height
  ) {
    overlays.push({ input: shadow, left: shadowLeft, top: shadowTop })
  }
  overlays.push({ input: productPng, left: place.left, top: place.top })

  const out = await bg.composite(overlays).jpeg({ quality: 92 }).toBuffer()

  const storage = (await getUserStorageConfig(args.userId)) ?? undefined
  const filename = `packshot-${Date.now()}.jpg`
  const up = await uploadBuffer(
    out,
    'image/jpeg',
    { folder: `images/${args.userId}`, filename },
    storage,
  )
  // mock storage hands back URLs that don't load
  const url = MOCK ? `data:image/jpeg;base64,${out.toString('base64')}` : up.url
  const asset = await prisma.asset.create({
    data: {
      userId: args.userId,
      projectId: args.projectId,
      type: 'image',
      storageUrl: url,
      filename: `${args.title} · packshot`.slice(0, 120),
      provider: 'cinevido',
      model: 'cinevido/packshot',
      metadata: JSON.stringify({
        width: frame.width,
        height: frame.height,
        production: { shotId: args.shotId, stage: 'still' },
        packshot: {
          background: args.backgroundUrl.startsWith('data:')
            ? undefined
            : args.backgroundUrl,
          cutout: args.cutoutUrl,
        },
      }),
    },
  })
  return { url, assetId: asset.id }
}
