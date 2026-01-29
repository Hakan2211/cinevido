import { motion } from 'framer-motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'BYOK means you connect your own fal.ai API key to use Cinevido. This way, you pay fal.ai directly for the AI generations at their rates, and we charge nothing extra. You get full transparency on costs and no platform fees.',
  },
  {
    question: 'How do I get a fal.ai API key?',
    answer:
      'Visit fal.ai and create a free account. Once signed up, navigate to your dashboard to generate an API key. New accounts typically come with free starting credits to try out the platform. Then simply paste your key into Cinevido settings.',
  },
  {
    question: 'How much does each generation cost?',
    answer:
      'Costs vary by model and output type. Typical ranges: images ~$0.01-0.05 each, videos ~$0.05-0.20 each, 3D models ~$0.03-0.10 each. Upscaling and editing operations are generally cheaper. Check fal.ai pricing for exact current rates.',
  },
  {
    question: 'What AI models are supported?',
    answer:
      'We support 10+ leading AI models including FLUX Pro, GPT-4o Image, Recraft for images; Kling, Pika, Wan, Luma for videos; Meshy and Tripo AI for 3D models; and SeedVR, Topaz, Bytedance for upscaling. New models are added regularly.',
  },
  {
    question: 'Can I use my own images and videos as input?',
    answer:
      'Yes! Many features support your own content as input. You can upload images for image-to-video, image-to-3D, editing, upscaling, and age transformation. Videos can be uploaded for upscaling. All uploads are processed securely.',
  },
  {
    question: 'What formats can I export?',
    answer:
      'Images export as PNG or JPG at full resolution. Videos export as MP4 or WebM. 3D models export as GLB, OBJ, or FBX depending on the model. All exports are high-quality and ready for professional use.',
  },
  {
    question: 'Is my content private and secure?',
    answer:
      "Yes. Your generations are private to your account. We don't share your content or use it for training. API calls go directly to fal.ai through encrypted connections. You can delete any of your content at any time.",
  },
  {
    question: 'Do you train AI models on my generations?',
    answer:
      'No. Cinevido is purely an interface to existing AI models. We never use your prompts or generated content for training. Your creative work remains yours. We simply provide tools to access and use AI models more effectively.',
  },
  {
    question: 'Is there a Team or Enterprise option?',
    answer:
      'Yes! For teams needing shared workspaces, centralized API key management, and priority support, contact us for custom enterprise solutions. We can also help with custom integrations and dedicated account management.',
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-24 lg:py-32">
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
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers. If you can't find what you're
            looking for, reach out to us directly.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
