import { motion } from 'framer-motion'
import { Box, Image, Key, Video, Wand2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Image,
    title: 'AI Image Studio',
    description:
      'Generate, edit, upscale, and transform images with FLUX Pro, GPT-4o, Recraft, ImagineArt and more.',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
  },
  {
    icon: Video,
    title: 'Video Generator',
    description:
      'Text-to-video, image animation, and keyframe transitions with Kling, Pika, Wan, and Luma.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    icon: Box,
    title: '3D Model Creator',
    description:
      'Transform text or images into 3D models with Meshy, Tripo AI, and other cutting-edge tools.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    icon: Zap,
    title: 'Smart Upscaling',
    description:
      'Enhance image and video resolution with SeedVR, Topaz, and Bytedance AI upscalers.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    icon: Key,
    title: 'BYOK Model',
    description:
      'Connect your fal.ai API key and pay only for what you use. No platform fees, no hidden costs.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm mb-6">
            <Wand2 className="h-4 w-4 text-primary" />
            Powerful Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need to create
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            One platform for all your AI-powered creative needs. Generate
            images, videos, and 3D models with the best AI models available.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature }: { feature: (typeof features)[0] }) {
  const Icon = feature.icon

  return (
    <div
      className={cn(
        'group relative h-full rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        feature.borderColor,
      )}
    >
      {/* Gradient overlay on hover */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          feature.bgColor,
        )}
        style={{ opacity: 0 }}
      />

      <div className="relative z-10">
        {/* Icon */}
        <div
          className={cn(
            'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg',
            feature.bgColor,
          )}
        >
          <Icon className={cn('h-6 w-6', feature.color)} />
        </div>

        {/* Content */}
        <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
        <p className="text-muted-foreground">{feature.description}</p>
      </div>
    </div>
  )
}
