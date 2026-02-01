import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Globe, Key, Sparkles, Twitter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common'
import { useUserAccess } from '@/hooks/use-user-access'

const footerLinks = {
  product: [
    { label: 'Images', href: '#images' },
    { label: 'Transform', href: '#transform' },
    { label: 'Videos', href: '#videos' },
    { label: '3D Models', href: '#3d' },
    { label: 'AI Models', href: '#models' },
    { label: 'Pricing', href: '#pricing' },
  ],
  resources: [
    { label: 'fal.ai', href: 'https://fal.ai' },
    { label: 'Get API Key', href: 'https://fal.ai/dashboard/keys' },
    { label: 'API Pricing', href: 'https://fal.ai/pricing' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
}

export function LandingFooter() {
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()

  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const id = href.slice(1)
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer className="border-t bg-background">
      {/* CTA Section - Merged into footer */}
      <div className="bg-primary text-primary-foreground relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -top-1/2 -left-1/4 w-full h-full bg-white/10 rounded-full blur-3xl"
          />
        </div>

        <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Start creating today
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Ready to Create Something Amazing?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Pay €149 once for lifetime access. Connect your fal.ai API key and
              unleash your creativity.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {hasPlatformAccess ? (
                <Link to="/dashboard">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="min-w-[200px] group"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              ) : isLoggedIn ? (
                <Link to="/pricing" search={{ auto_checkout: 'true' }}>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="min-w-[200px] group"
                  >
                    Buy Now for €149
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              ) : (
                <Link to="/signup" search={{ redirect: 'checkout' }}>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="min-w-[200px] group"
                  >
                    Buy Now for €149
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              )}
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="min-w-[200px] bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Key className="mr-2 h-4 w-4" />
                  Get fal.ai API Key
                </Button>
              </a>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm opacity-80">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span>One-time payment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span>Lifetime access</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span>Your content stays private</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer Links */}
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Logo size={32} />
              <span className="text-xl font-bold">Cinevido</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Your AI creative studio. Generate images, videos, and 3D models
              with cutting-edge AI. BYOK - Bring Your Own Key.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/hakanbilgo"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://hakanda.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://hakanda.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              hakanda.com
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({
  label,
  href,
  scrollToSection,
}: {
  label: string
  href: string
  scrollToSection: (href: string) => void
}) {
  const className =
    'text-sm text-muted-foreground hover:text-foreground transition-colors'

  if (href.startsWith('#')) {
    return (
      <button onClick={() => scrollToSection(href)} className={className}>
        {label}
      </button>
    )
  }

  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    )
  }

  return (
    <Link to={href} className={className}>
      {label}
    </Link>
  )
}
