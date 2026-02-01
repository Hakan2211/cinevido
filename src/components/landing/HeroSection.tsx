import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Key, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserAccess } from '@/hooks/use-user-access'
import { heroImages } from '@/lib/showcase-assets'

export function HeroSection() {
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Rotate hero images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 pt-32 pb-24 lg:pt-40 lg:pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
        {/* Animated gradient orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/3 left-1/4 w-96 h-96 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm">
                <Key className="h-4 w-4 text-primary" />
                BYOK - Bring Your Own Key
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            >
              Create Stunning AI{' '}
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
                Art, Videos & 3D
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0"
            >
              One platform for FLUX, Kling, Meshy and 10+ AI models. Connect
              your fal.ai key — pay only for what you use. No subscriptions.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              {hasPlatformAccess ? (
                <Link to="/dashboard">
                  <Button size="lg" className="min-w-[200px] group">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              ) : isLoggedIn ? (
                <Link to="/pricing" search={{ auto_checkout: 'true' }}>
                  <Button size="lg" className="min-w-[200px] group">
                    Buy Now for €149
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              ) : (
                <Link to="/signup" search={{ redirect: 'checkout' }}>
                  <Button size="lg" className="min-w-[200px] group">
                    Buy Now for €149
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                size="lg"
                className="min-w-[180px]"
                onClick={() => scrollToSection('images')}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                See Examples
              </Button>
            </motion.div>

            {/* How it works - simplified */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-12 flex flex-wrap justify-center lg:justify-start gap-6"
            >
              {[
                { step: '1', label: 'Connect fal.ai key' },
                { step: '2', label: 'Create content' },
                { step: '3', label: 'Download & use' },
              ].map((item, index) => (
                <div key={item.step} className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {item.step}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  {index < 2 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 hidden sm:block" />
                  )}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Hero Image Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            <div className="relative rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-2 shadow-2xl overflow-hidden">
              {/* Image container */}
              <div className="aspect-[4/3] rounded-xl overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImageIndex}
                    src={heroImages[currentImageIndex]}
                    alt="AI Generated Art"
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.7 }}
                  />
                </AnimatePresence>

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Badge */}
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </span>
                </div>
              </div>

              {/* Image indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentImageIndex
                        ? 'w-6 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stats overlay */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-auto"
            >
              <div className="flex items-center justify-center gap-6 rounded-xl border bg-background/90 backdrop-blur-sm px-6 py-4 shadow-lg">
                {[
                  { value: '10+', label: 'AI Models' },
                  { value: '€149', label: 'One-Time' },
                  { value: 'Lifetime', label: 'Access' },
                ].map((stat, index) => (
                  <div key={stat.label} className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg md:text-xl font-bold text-primary">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                    {index < 2 && (
                      <div className="h-8 w-px bg-border hidden md:block" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
