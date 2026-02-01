import { Link } from '@tanstack/react-router'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common'
import { AudioToggle } from '@/components/audio'
import { MobileNav } from './MobileNav'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUserAccess } from '@/hooks/use-user-access'

const navItems = [
  { id: 'images', label: 'Images' },
  { id: 'transform', label: 'Transform' },
  { id: 'videos', label: 'Videos' },
  { id: '3d', label: '3D Models' },
  { id: 'models', label: 'AI Models' },
  { id: 'pricing', label: 'Pricing' },
]

export function LandingHeader() {
  const { scrollY } = useScroll()
  const [isScrolled, setIsScrolled] = useState(false)
  const isMobile = useIsMobile()
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()

  // Transform values based on scroll
  const headerWidth = useTransform(
    scrollY,
    [0, 100],
    isMobile ? ['100%', '100%'] : ['100%', '90%'],
  )
  const headerTop = useTransform(scrollY, [0, 100], isMobile ? [0, 0] : [0, 12])
  const headerBorderRadius = useTransform(
    scrollY,
    [0, 100],
    isMobile ? [0, 0] : [0, 16],
  )

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      setIsScrolled(latest > 50)
    })
    return unsubscribe
  }, [scrollY])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.header
        style={{
          width: headerWidth,
          top: headerTop,
          borderRadius: headerBorderRadius,
        }}
        className={cn(
          'pointer-events-auto transition-all duration-300 ease-in-out',
          isScrolled
            ? 'bg-background/80 backdrop-blur-xl shadow-lg border border-border/50'
            : 'bg-transparent backdrop-blur-none',
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <Logo
              size={32}
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold">Cinevido</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  'text-sm font-medium transition-colors cursor-pointer relative group',
                  isScrolled
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Audio Toggle + Auth Buttons + Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Audio toggle - desktop */}
            <div className="hidden md:block">
              <AudioToggle variant={isScrolled ? 'dark' : 'light'} />
            </div>

            {/* Desktop auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              {isLoggedIn ? (
                hasPlatformAccess ? (
                  <Link to="/dashboard">
                    <Button size="sm">Dashboard</Button>
                  </Link>
                ) : (
                  <Link to="/pricing" search={{ auto_checkout: 'true' }}>
                    <Button size="sm">Buy Now for €149</Button>
                  </Link>
                )
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/signup" search={{ redirect: 'checkout' }}>
                    <Button size="sm">Buy Now for €149</Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <MobileNav navItems={navItems} onNavClick={scrollToSection} />
          </div>
        </div>
      </motion.header>
    </div>
  )
}
