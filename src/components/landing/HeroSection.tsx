import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Key, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUserAccess } from '@/hooks/use-user-access'

export function HeroSection() {
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()

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
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
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
            AI Images, Videos & 3D.{' '}
            <span className="bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
              One Studio.
            </span>{' '}
            Your API Key.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl"
          >
            Create stunning visuals with cutting-edge AI models like FLUX,
            Kling, and Meshy. No subscription fees - just connect your fal.ai
            key and start creating.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4"
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
              onClick={() => scrollToSection('showcase')}
            >
              See What's Possible
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-t pt-8"
          >
            {[
              { value: '10+', label: 'AI Models' },
              { value: '3', label: 'Creation Modes' },
              { value: '$149', label: 'One-Time Payment' },
              { value: 'Lifetime', label: 'Access' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Hero Visual Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16 w-full max-w-5xl"
          >
            <div className="relative rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-2 shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/50 rounded-t-xl">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                    cinevido.com
                  </div>
                </div>
              </div>
              {/* Preview content */}
              <div className="aspect-[16/9] rounded-b-xl bg-gradient-to-br from-background via-muted/50 to-background overflow-hidden">
                <div className="h-full flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-3xl">
                    {/* Image preview */}
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="aspect-square rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
                    >
                      <Sparkles className="h-8 w-8 text-violet-500/60" />
                    </motion.div>
                    {/* Video preview */}
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5,
                      }}
                      className="aspect-square rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center"
                    >
                      <div className="w-0 h-0 border-l-[16px] border-l-blue-500/60 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
                    </motion.div>
                    {/* 3D preview */}
                    <motion.div
                      animate={{ y: [0, -8, 0], rotateY: [0, 180, 360] }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 1,
                      }}
                      className="aspect-square rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
                      style={{ perspective: 1000 }}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/40 to-teal-500/40 rounded-lg transform rotate-45" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
