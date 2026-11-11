import { cn } from '@/lib/utils'

interface WordmarkProps {
  className?: string
  /** show the "AI FILM STUDIO" tagline after a hairline divider */
  tagline?: boolean
}

/** "Cinevido" set in Playfair Display — the only place the serif is used. */
export function Wordmark({ className, tagline = true }: WordmarkProps) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <span className="font-display text-[22px] font-semibold leading-none tracking-tight text-foreground">
        Cinevido
      </span>
      {tagline && (
        <>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground sm:block">
            AI Film Studio
          </span>
        </>
      )}
    </span>
  )
}
