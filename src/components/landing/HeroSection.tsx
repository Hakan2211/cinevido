import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserAccess } from '@/hooks/use-user-access'
import { heroImages } from '@/lib/showcase-assets'
import { CATALOG_MODEL_COUNT } from './catalog-summary'

/**
 * Landing hero — the Home prompt's promise, on a still that changes every
 * few seconds. Dark graphite, one amber action, no glow.
 */
export function HeroSection() {
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % heroImages.length),
      5000,
    )
    return () => clearInterval(t)
  }, [])

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const primary = hasPlatformAccess ? (
    <Link to="/dashboard">
      <Button size="lg" className="min-w-[200px]">
        Open the studio
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  ) : (
    <Link
      to={isLoggedIn ? '/pricing' : '/signup'}
      search={isLoggedIn ? { auto_checkout: 'true' } : { redirect: 'checkout' }}
    >
      <Button size="lg" className="min-w-[200px]">
        Get Cinevido · €149
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  )

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            AI film studio · bring your own fal key
          </p>
          <h1 className="mt-6 text-5xl font-medium tracking-tight md:text-6xl lg:text-7xl">
            Ideas become films.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Describe what you want to make. The Director writes a priced shot
            plan, renders cheap drafts you review, then renders the finals and
            cuts them on a timeline. Plus labs for every image, video, voice,
            music and 3D model, each with its price on the button.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            {primary}
            <Button
              variant="secondary"
              size="lg"
              className="min-w-[180px]"
              onClick={() => scrollTo('director')}
            >
              <Play className="h-4 w-4 fill-current" />
              How it works
            </Button>
          </div>
        </div>

        {/* Rotating still, framed like a monitor */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl border border-border bg-card">
            {/* initial={false}: the first still is in the server HTML */}
            <AnimatePresence mode="sync" initial={false}>
              <motion.img
                key={index}
                src={heroImages[index]}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2 }}
              />
            </AnimatePresence>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-black/45 px-5 py-3 text-xs text-white/80 backdrop-blur-sm">
              <span>Generated with models on fal</span>
              <span className="flex gap-1.5">
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Show still ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-5 bg-primary' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </span>
            </div>
          </div>

          <dl className="mx-auto mt-8 grid max-w-3xl grid-cols-3 divide-x divide-border text-center">
            {[
              { value: `${CATALOG_MODEL_COUNT}`, label: 'Curated models' },
              { value: '€149', label: 'One-time, lifetime' },
              { value: 'At cost', label: 'You pay fal directly' },
            ].map((s) => (
              <div key={s.label} className="px-4">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
