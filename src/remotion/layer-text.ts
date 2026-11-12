/**
 * Live text for a text layer, drawn as SVG so the same markup renders in the
 * layer viewer, the Remotion preview / render, and the server's composite
 * (sharp rasterises SVG). The text is centred in its box and sized to fill
 * it: by the box height per line, shrunk when a line would run too wide.
 *
 * Pure — no React, no Node — so every one of those can import it.
 */

import type { LayerTextProps } from './types'

/** average glyph width as a fraction of the font size (a rough sans-serif) */
const GLYPH_WIDTH = 0.58
const LINE_HEIGHT = 1.08

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** fal names a similar font; servers and browsers may not have it installed */
export function genericFontFamily(name: string | undefined): string {
  const n = name ?? ''
  if (/mono|courier|code|consolas/i.test(n)) return 'monospace'
  if (
    !/sans/i.test(n) &&
    /serif|times|garamond|georgia|playfair|baskerville|didot|bodoni|caslon|merriweather|lora|roman/i.test(
      n,
    )
  ) {
    return 'serif'
  }
  return 'sans-serif'
}

/** Only plain colours get into the markup: #hex, rgb()/rgba() or a CSS name */
export function safeColor(color: string | undefined): string {
  const c = (color ?? '').trim()
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return c
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(c)) return c
  if (/^[a-z]{3,20}$/i.test(c)) return c
  return '#ffffff'
}

export function fontStack(name: string | undefined): string {
  const clean = (name ?? '')
    .replace(/["'<>&;{}]/g, '')
    .trim()
    .slice(0, 60)
  const generic = genericFontFamily(clean)
  return clean ? `'${clean}', ${generic}` : generic
}

export function textLines(text: string): Array<string> {
  const lines = text.replace(/\r/g, '').split('\n')
  return lines.length > 0 ? lines : ['']
}

/** Font size (box pixels) that fits every line into a box of this size */
export function fitFontSize(
  lines: Array<string>,
  width: number,
  height: number,
): number {
  const byHeight = height / (lines.length * LINE_HEIGHT)
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const byWidth = (width * 0.98) / (longest * GLYPH_WIDTH)
  return Math.max(4, Math.min(byHeight, byWidth))
}

/**
 * The text as an SVG document `width` × `height` box pixels. With `pixels`
 * the root carries that size (for sharp); otherwise it fills its container.
 */
export function layerTextSvg(
  props: LayerTextProps,
  width: number,
  height: number,
  opts: { pixels?: boolean } = {},
): string {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const lines = textLines(props.text)
  const size = fitFontSize(lines, w, h)
  const block = size * LINE_HEIGHT * lines.length
  const top = (h - block) / 2
  const tspans = lines
    .map((line, i) => {
      // baseline sits ~0.8em into its line box
      const y = top + size * LINE_HEIGHT * i + size * 0.86
      return `<tspan x="${w / 2}" y="${y.toFixed(1)}">${escapeXml(line)}</tspan>`
    })
    .join('')
  const dims = opts.pixels
    ? `width="${w}" height="${h}"`
    : 'width="100%" height="100%"'
  const family = escapeXml(fontStack(props.fontFamily))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${w} ${h}" overflow="visible">` +
    `<text text-anchor="middle" font-family="${family}" font-size="${size.toFixed(1)}"` +
    ` font-weight="${props.bold ? 700 : 400}" font-style="${props.italic ? 'italic' : 'normal'}"` +
    ` fill="${escapeXml(safeColor(props.color))}">${tspans}</text></svg>`
  )
}
