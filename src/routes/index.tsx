import { createFileRoute } from '@tanstack/react-router'
import {
  BeforeAfterSection,
  DirectorSection,
  FAQSection,
  HeroSection,
  ImageShowcaseSection,
  LandingFooter,
  LandingHeader,
  ModelsSection,
  PricingSection,
  ThreeDShowcaseSection,
  VideoShowcaseSection,
} from '@/components/landing'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <ImageShowcaseSection />
        <BeforeAfterSection />
        <VideoShowcaseSection />
        <ThreeDShowcaseSection />
        <ModelsSection />
        <DirectorSection />
        <PricingSection />
        <FAQSection />
      </main>
      <LandingFooter />
    </div>
  )
}
