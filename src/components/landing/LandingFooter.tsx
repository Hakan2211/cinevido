import { Link } from '@tanstack/react-router'
import { Github, Twitter } from 'lucide-react'
import { Logo } from '@/components/common'

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Showcase', href: '#showcase' },
    { label: 'AI Models', href: '#models' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
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
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Logo size={32} />
              <span className="text-xl font-bold">DirectorAI</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Your AI creative studio. Generate images, videos, and 3D models
              with cutting-edge AI. BYOK - Bring Your Own Key.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <Github className="h-4 w-4" />
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
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} DirectorAI. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with TanStack Start & fal.ai
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
