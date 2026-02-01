import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from '@/components/common'
import { AudioToggle } from '@/components/audio'
import { useUserAccess } from '@/hooks/use-user-access'
import { useState } from 'react'

interface MobileNavProps {
  navItems: { id: string; label: string }[]
  onNavClick: (id: string) => void
}

export function MobileNav({ navItems, onNavClick }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const { isLoggedIn, hasPlatformAccess } = useUserAccess()

  const handleNavClick = (id: string) => {
    onNavClick(id)
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[350px]">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size={28} />
              <span className="text-lg font-bold">Cinevido</span>
            </div>
            <AudioToggle variant="dark" />
          </SheetTitle>
        </SheetHeader>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 py-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className="flex items-center rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="mt-auto border-t pt-6 flex flex-col gap-3">
          {isLoggedIn ? (
            hasPlatformAccess ? (
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button className="w-full" size="lg">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link
                to="/pricing"
                search={{ auto_checkout: 'true' }}
                onClick={() => setOpen(false)}
              >
                <Button className="w-full" size="lg">
                  Buy Now for €149
                </Button>
              </Link>
            )
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full" size="lg">
                  Sign in
                </Button>
              </Link>
              <Link
                to="/signup"
                search={{ redirect: 'checkout' }}
                onClick={() => setOpen(false)}
              >
                <Button className="w-full" size="lg">
                  Buy Now for €149
                </Button>
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
