import { useState } from 'react'
import { motion } from 'framer-motion'
import { Image, Sparkles } from 'lucide-react'
import { MasonryGrid } from '@/components/ui/masonry-grid'
import {
  galleryImages,
  imageCategories,
  type ImageCategory,
} from '@/lib/showcase-assets'
import { cn } from '@/lib/utils'

export function ImageShowcaseSection() {
  const [activeCategory, setActiveCategory] = useState<ImageCategory>('all')

  const filteredImages =
    activeCategory === 'all'
      ? galleryImages
      : galleryImages.filter((img) => img.category === activeCategory)

  return (
    <section id="images" className="py-24 lg:py-32 bg-muted/30">
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
            <Image className="h-4 w-4 text-primary" />
            AI Image Generation
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Create Anything You Can Imagine
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From photorealistic portraits to surreal art — powered by FLUX Pro,
            Recraft, GPT-4o, and more. Every image below was generated with
            Cinevido.
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
          <div className="inline-flex flex-wrap justify-center gap-2 rounded-xl border border-border/50 bg-card/50 backdrop-blur p-1.5">
            {imageCategories.map((category) => (
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
                {category.id === 'all' && <Sparkles className="h-4 w-4" />}
                {category.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Masonry Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <MasonryGrid
            images={filteredImages}
            columns={4}
            gap={4}
            initialCount={12}
            showViewAll={true}
            className="hidden lg:block"
          />
          <MasonryGrid
            images={filteredImages}
            columns={3}
            gap={3}
            initialCount={9}
            showViewAll={true}
            className="hidden md:block lg:hidden"
          />
          <MasonryGrid
            images={filteredImages}
            columns={2}
            gap={3}
            initialCount={6}
            showViewAll={true}
            className="block md:hidden"
          />
        </motion.div>
      </div>
    </section>
  )
}
