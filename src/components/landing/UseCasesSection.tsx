import { motion } from 'framer-motion'
import {
  Film,
  Gamepad2,
  Image,
  Megaphone,
  ShoppingBag,
  Youtube,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const useCases = [
  {
    icon: Youtube,
    title: 'Content Creators',
    description:
      'Generate eye-catching thumbnails, animated intros, and b-roll footage for your videos.',
    examples: ['Thumbnails', 'Intros', 'B-roll'],
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  {
    icon: Megaphone,
    title: 'Marketing Teams',
    description:
      'Create ad creatives, social media visuals, and promotional videos at scale.',
    examples: ['Ad creatives', 'Social posts', 'Promo videos'],
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  {
    icon: Gamepad2,
    title: 'Game Developers',
    description:
      'Generate concept art, 3D assets, textures, and promotional materials for your games.',
    examples: ['Concept art', '3D models', 'Textures'],
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  {
    icon: Film,
    title: 'Filmmakers',
    description:
      'Create storyboards, pre-visualization videos, and VFX concepts quickly.',
    examples: ['Storyboards', 'Pre-viz', 'VFX concepts'],
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description:
      'Generate product photos, 360-degree views, and promotional videos for your store.',
    examples: ['Product shots', '360 views', 'Demo videos'],
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  {
    icon: Image,
    title: 'Everyone Else',
    description:
      'Personal projects, learning AI tools, or just having fun creating amazing content.',
    examples: ['Personal art', 'Experiments', 'Fun projects'],
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
  },
]

export function UseCasesSection() {
  return (
    <section id="use-cases" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for creators of all kinds
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're a solo creator or a large team, Cinevido adapts to
            your creative workflow.
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <UseCaseCard useCase={useCase} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UseCaseCard({ useCase }: { useCase: (typeof useCases)[0] }) {
  const Icon = useCase.icon

  return (
    <div
      className={cn(
        'group h-full rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        useCase.borderColor,
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
          useCase.bgColor,
        )}
      >
        <Icon className={cn('h-6 w-6', useCase.color)} />
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
      <p className="text-muted-foreground mb-4">{useCase.description}</p>

      {/* Example tags */}
      <div className="flex flex-wrap gap-2">
        {useCase.examples.map((example) => (
          <span
            key={example}
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              useCase.bgColor,
              useCase.color,
            )}
          >
            {example}
          </span>
        ))}
      </div>
    </div>
  )
}
