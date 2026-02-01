import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Box, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModelViewer } from '@/components/ui/model-viewer'
import { showcase3DModel } from '@/lib/showcase-assets'
import { useUserAccess } from '@/hooks/use-user-access'

export function ThreeDShowcaseSection() {
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()

  return (
    <section id="3d" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm mb-6">
              <Box className="h-4 w-4 text-primary" />
              3D Model Generation
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              From Concept to 3D in Seconds
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              Transform text descriptions or images into detailed 3D models with
              Meshy and Tripo AI. Perfect for games, product visualization, and
              creative projects.
            </p>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {[
                'Text to 3D model generation',
                'Image to 3D conversion',
                'Export to GLB/GLTF formats',
                'Texture and material control',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            {hasPlatformAccess ? (
              <Link to="/dashboard">
                <Button size="lg" className="group">
                  Start Creating 3D
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            ) : isLoggedIn ? (
              <Link to="/pricing" search={{ auto_checkout: 'true' }}>
                <Button size="lg" className="group">
                  Get Access for €149
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            ) : (
              <Link to="/signup" search={{ redirect: 'checkout' }}>
                <Button size="lg" className="group">
                  Get Access for €149
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            )}
          </motion.div>

          {/* 3D Model Viewer */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 to-muted/20 p-2 shadow-xl">
              {/* Model badge */}
              <div className="absolute top-5 left-5 z-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white">
                  <Box className="h-3 w-3" />
                  {showcase3DModel.model}
                </span>
              </div>

              {/* Rotate hint */}
              <div className="absolute top-5 right-5 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white">
                  <RotateCcw className="h-3 w-3" />
                  Interactive
                </span>
              </div>

              <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-background via-muted/50 to-background">
                <ModelViewer
                  src={`/api/proxy-glb?url=${encodeURIComponent(showcase3DModel.src)}`}
                  alt={showcase3DModel.title}
                  autoRotate={true}
                  cameraControls={true}
                  className="h-full"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
