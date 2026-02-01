import { motion } from 'framer-motion'
import { Baby, Wand2 } from 'lucide-react'
import { BeforeAfterSlider } from '@/components/ui/before-after-slider'
import { beforeAfterDemos } from '@/lib/showcase-assets'

export function BeforeAfterSection() {
  return (
    <section id="transform" className="py-24 lg:py-32">
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
            Transform & Enhance
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Powerful AI Transformations
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Edit, enhance, and transform images with state-of-the-art AI. Drag
            the slider to see the magic.
          </p>
        </motion.div>

        {/* Before/After Sliders Grid */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Baby Prediction Demo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10">
                <Baby className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {beforeAfterDemos.aging.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {beforeAfterDemos.aging.description}
                </p>
              </div>
            </div>
            <BeforeAfterSlider
              beforeSrc={beforeAfterDemos.aging.before}
              afterSrc={beforeAfterDemos.aging.after}
              beforeLabel="Original"
              afterLabel="Baby Prediction"
              className="aspect-square md:aspect-[4/3]"
            />
          </motion.div>

          {/* AI Edit Demo */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Wand2 className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {beforeAfterDemos.edit.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {beforeAfterDemos.edit.description}
                </p>
              </div>
            </div>
            <BeforeAfterSlider
              beforeSrc={beforeAfterDemos.edit.before}
              afterSrc={beforeAfterDemos.edit.after}
              beforeLabel="Original"
              afterLabel="Enhanced"
              className="aspect-square md:aspect-[4/3]"
            />
          </motion.div>
        </div>

        {/* Additional capabilities hint */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Also supports: Age progression/regression, face swap, background
            removal, smart upscaling, and more.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
