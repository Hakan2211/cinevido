import { useState } from 'react'
import { motion } from 'framer-motion'
import { Box, Image, Play, Sparkles, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

type ShowcaseCategory = 'all' | 'images' | 'videos' | '3d'

const categories = [
  { id: 'all' as const, label: 'All', icon: Sparkles },
  { id: 'images' as const, label: 'Images', icon: Image },
  { id: 'videos' as const, label: 'Videos', icon: Video },
  { id: '3d' as const, label: '3D Models', icon: Box },
]

// Placeholder showcase items - replace with real content later
const showcaseItems = [
  {
    id: '1',
    type: 'images' as const,
    title: 'Portrait Generation',
    description: 'Photorealistic portrait created with FLUX Pro',
    placeholder: 'from-violet-500/30 to-purple-500/30',
  },
  {
    id: '2',
    type: 'videos' as const,
    title: 'Product Animation',
    description: 'Product showcase animated with Kling',
    placeholder: 'from-blue-500/30 to-cyan-500/30',
  },
  {
    id: '3',
    type: '3d' as const,
    title: 'Character Model',
    description: '3D character from text with Meshy',
    placeholder: 'from-emerald-500/30 to-teal-500/30',
  },
  {
    id: '4',
    type: 'images' as const,
    title: 'Landscape Art',
    description: 'Fantasy landscape with ImagineArt',
    placeholder: 'from-amber-500/30 to-orange-500/30',
  },
  {
    id: '5',
    type: 'videos' as const,
    title: 'Scene Transition',
    description: 'Keyframe video with Pika',
    placeholder: 'from-pink-500/30 to-rose-500/30',
  },
  {
    id: '6',
    type: '3d' as const,
    title: 'Product Model',
    description: 'Image-to-3D with Tripo AI',
    placeholder: 'from-indigo-500/30 to-blue-500/30',
  },
  {
    id: '7',
    type: 'images' as const,
    title: 'AI Upscale',
    description: '4x enhancement with Topaz',
    placeholder: 'from-green-500/30 to-emerald-500/30',
  },
  {
    id: '8',
    type: 'videos' as const,
    title: 'Text-to-Video',
    description: 'Cinematic scene with Wan',
    placeholder: 'from-red-500/30 to-pink-500/30',
  },
]

export function ShowcaseSection() {
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>('all')

  const filteredItems =
    activeCategory === 'all'
      ? showcaseItems
      : showcaseItems.filter((item) => item.type === activeCategory)

  return (
    <section id="showcase" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            See what's possible
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore creations made with Cinevido. From stunning images to
            cinematic videos and detailed 3D models.
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex rounded-xl border border-border/50 bg-card/50 backdrop-blur p-1.5">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    activeCategory === category.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Showcase Grid */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <ShowcaseCard item={item} />
            </motion.div>
          ))}
        </motion.div>

        {/* Placeholder Notice */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Real showcase examples coming soon. Sign up to be featured!
        </motion.p>
      </div>
    </section>
  )
}

function ShowcaseCard({ item }: { item: (typeof showcaseItems)[0] }) {
  const isVideo = item.type === 'videos'
  const is3D = item.type === '3d'

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-card cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Placeholder gradient background */}
      <div
        className={cn('absolute inset-0 bg-gradient-to-br', item.placeholder)}
      />

      {/* Type indicator */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1 text-xs text-white">
          {isVideo && <Play className="h-3 w-3" />}
          {is3D && <Box className="h-3 w-3" />}
          {!isVideo && !is3D && <Image className="h-3 w-3" />}
          <span className="capitalize">{item.type}</span>
        </div>
      </div>

      {/* Placeholder icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isVideo && (
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        )}
        {is3D && (
          <motion.div
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm"
          />
        )}
        {!isVideo && !is3D && <Sparkles className="h-12 w-12 text-white/50" />}
      </div>

      {/* Info overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <h4 className="font-semibold text-white text-sm">{item.title}</h4>
        <p className="text-xs text-white/70 mt-0.5">{item.description}</p>
      </div>
    </div>
  )
}
