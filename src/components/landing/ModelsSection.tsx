import { motion } from 'framer-motion'
import { Box, Image, Video, Zap, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

const modelCategories = [
  {
    title: 'Image',
    icon: Image,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    models: [
      'Flux 2 Pro',
      'GPT Image 1.5',
      'Recraft V3',
      'ImagineArt 1.5',
      'Seedream 4.5',
      'Bria 3.2',
      'Wan 2.6',
    ],
  },
  {
    title: 'Video',
    icon: Video,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    models: [
      'Kling 2.6 Pro',
      'Sora 2 Pro',
      'Veo 3.1',
      'Wan 2.6',
      'Seedance 1.5',
      'Hailuo 2.3',
      'Pika 2.2',
    ],
  },
  {
    title: '3D',
    icon: Box,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    models: ['Hunyuan3D V3', 'Meshy 6', 'Rodin V2', 'Seed3D', 'SAM 3D'],
  },
  {
    title: 'Upscale',
    icon: Zap,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    models: ['SeedVR2', 'Topaz'],
  },
]

export function ModelsSection() {
  return (
    <section id="models" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm mb-6">
            <Cpu className="h-4 w-4 text-primary" />
            65+ AI Models
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Powered by the Best AI Models
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access cutting-edge AI from leading providers through your fal.ai
            API key. New models added regularly.
          </p>
        </motion.div>

        {/* Model Categories Grid - Simplified */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {modelCategories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn(
                'rounded-xl border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
                category.borderColor,
              )}
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center',
                    category.bgColor,
                  )}
                >
                  <category.icon className={cn('h-5 w-5', category.color)} />
                </div>
                <h3 className="font-semibold">{category.title}</h3>
              </div>

              {/* Models List - Simple badges */}
              <div className="flex flex-wrap gap-2">
                {category.models.map((model) => (
                  <span
                    key={model}
                    className="text-xs font-medium bg-muted px-2.5 py-1 rounded-full text-muted-foreground"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
