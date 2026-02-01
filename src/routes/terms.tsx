import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/terms')({
  component: TermsOfServicePage,
})

function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-muted-foreground mb-8">
            Last Updated:{' '}
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {/* Acceptance */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                These Terms of Service ("Terms") constitute a legally binding
                agreement between you ("User," "you," or "your") and Hakanda
                ("Company," "we," "our," or "us") governing your access to and
                use of the Cinevido platform, including all associated websites,
                applications, and services (collectively, the "Service").
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                BY ACCESSING OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE
                READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS. IF YOU
                DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE
                SERVICE.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. Material
                changes will be communicated through the Service or via email.
                Your continued use of the Service following such notification
                constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Definitions */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">2. Definitions</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For the purposes of these Terms:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>"Service"</strong> refers to the Cinevido platform and
                  all related features, tools, and functionalities.
                </li>
                <li>
                  <strong>"User Content"</strong> means any images, videos, 3D
                  models, prompts, text, or other materials you create, upload,
                  or generate through the Service.
                </li>
                <li>
                  <strong>"API Key"</strong> refers to authentication
                  credentials for third-party AI services, including fal.ai.
                </li>
                <li>
                  <strong>"BYOK"</strong> (Bring Your Own Key) refers to our
                  model where users provide their own API keys for AI services.
                </li>
                <li>
                  <strong>"Subscription"</strong> refers to your purchased
                  access to the Service.
                </li>
              </ul>
            </section>

            {/* Description of Service */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                3. Description of Service
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Cinevido is an AI-powered creative studio that enables users to
                generate, edit, and transform images, videos, and 3D models
                using various artificial intelligence models. The Service
                operates on a BYOK (Bring Your Own Key) model, wherein users
                provide their own API keys from supported AI service providers,
                primarily fal.ai.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The Service provides the interface and tools for interacting
                with AI models, but the actual AI processing is performed by
                third-party providers. We do not guarantee specific results,
                output quality, or availability of any particular AI model.
              </p>
            </section>

            {/* Eligibility */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">4. Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To use the Service, you must:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  Be at least 18 years of age or the age of legal majority in
                  your jurisdiction;
                </li>
                <li>
                  Have the legal capacity to enter into binding contracts;
                </li>
                <li>
                  Not be prohibited from using the Service under applicable
                  laws;
                </li>
                <li>Provide accurate and complete registration information.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using the Service, you represent and warrant that you meet
                all eligibility requirements.
              </p>
            </section>

            {/* Account Registration */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                5. Account Registration and Security
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You must register for an account to access the Service. You
                agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  Provide accurate, current, and complete information during
                  registration;
                </li>
                <li>Maintain and promptly update your account information;</li>
                <li>
                  Maintain the security and confidentiality of your login
                  credentials;
                </li>
                <li>
                  Accept responsibility for all activities that occur under your
                  account;
                </li>
                <li>
                  Immediately notify us of any unauthorized use of your account.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We reserve the right to suspend or terminate accounts that
                violate these Terms or that we reasonably believe are being used
                for fraudulent or unauthorized purposes.
              </p>
            </section>

            {/* BYOK Model */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                6. BYOK Model and API Usage
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service operates on a Bring Your Own Key (BYOK) model. You
                acknowledge and agree that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  You are responsible for obtaining and maintaining valid API
                  keys from supported providers (e.g., fal.ai);
                </li>
                <li>
                  All API usage costs incurred through your API key are your
                  sole responsibility;
                </li>
                <li>
                  You must comply with the terms of service of all third-party
                  API providers;
                </li>
                <li>
                  We encrypt and securely store your API keys but are not liable
                  for unauthorized access resulting from your failure to
                  maintain key security;
                </li>
                <li>
                  We do not monitor or control the content processed through
                  third-party APIs and are not responsible for their outputs.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You are solely responsible for monitoring your API usage and
                associated costs with third-party providers. We do not provide
                refunds for API costs incurred.
              </p>
            </section>

            {/* Fees and Payment */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                7. Fees and Payment
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Access to the Service requires a one-time payment of €149 for
                lifetime access ("Lifetime License"). This payment grants you
                perpetual access to the Service as it exists and as updated,
                subject to these Terms.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Payment is processed by Stripe, Inc. By making a payment, you
                agree to Stripe's terms of service and authorize us to charge
                your designated payment method.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong>Refund Policy:</strong> Due to the digital nature of the
                Service and immediate access granted upon purchase, all sales
                are final. No refunds will be provided except where required by
                applicable law. In such cases, refund requests must be submitted
                within 14 days of purchase.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The Lifetime License fee does not include any API costs incurred
                through third-party providers, which remain your sole
                responsibility under the BYOK model.
              </p>
            </section>

            {/* Acceptable Use */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                8. Acceptable Use Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  Generate, upload, or distribute content that is illegal,
                  harmful, threatening, abusive, harassing, defamatory, obscene,
                  or otherwise objectionable;
                </li>
                <li>
                  Create content that infringes upon intellectual property
                  rights of third parties;
                </li>
                <li>
                  Generate deepfakes or synthetic media intended to deceive,
                  defraud, or harm individuals;
                </li>
                <li>
                  Create content depicting minors in any inappropriate context;
                </li>
                <li>
                  Attempt to reverse engineer, decompile, or disassemble any
                  part of the Service;
                </li>
                <li>Circumvent any access controls or usage limitations;</li>
                <li>
                  Use automated systems or bots to access the Service without
                  authorization;
                </li>
                <li>
                  Interfere with or disrupt the integrity or performance of the
                  Service;
                </li>
                <li>
                  Violate any applicable local, national, or international law
                  or regulation.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We reserve the right to remove any content and suspend or
                terminate accounts that violate this Acceptable Use Policy
                without prior notice.
              </p>
            </section>

            {/* Intellectual Property */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                9. Intellectual Property Rights
              </h2>

              <h3 className="text-xl font-medium mb-3">
                9.1 Our Intellectual Property
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service, including its original content, features,
                functionality, design, and underlying technology, is owned by
                Hakanda and protected by international copyright, trademark,
                patent, trade secret, and other intellectual property laws. You
                may not copy, modify, distribute, sell, or lease any part of our
                Service or included software.
              </p>

              <h3 className="text-xl font-medium mb-3">9.2 Your Content</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You retain ownership of User Content you create through the
                Service, subject to the terms of the underlying AI model
                providers. You are responsible for ensuring you have the
                necessary rights to any input content (images, text, etc.) you
                provide to the Service.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By using the Service, you grant us a limited, non-exclusive
                license to store, process, and display your User Content solely
                for the purpose of providing the Service to you.
              </p>
            </section>

            {/* User Content */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                10. User-Generated Content
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You are solely responsible for all User Content you create,
                upload, or generate through the Service. You represent and
                warrant that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  You own or have the necessary rights to use all input content;
                </li>
                <li>
                  Your User Content does not infringe any third-party rights;
                </li>
                <li>
                  Your User Content complies with all applicable laws and these
                  Terms;
                </li>
                <li>
                  You will not use AI-generated content to impersonate real
                  individuals without their consent.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We do not claim ownership of your User Content and do not use it
                for training AI models or any purpose other than providing the
                Service to you.
              </p>
            </section>

            {/* Third-Party Services */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                11. Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Service integrates with third-party services, including but
                not limited to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>fal.ai:</strong> AI model processing and generation
                </li>
                <li>
                  <strong>Stripe:</strong> Payment processing
                </li>
                <li>
                  <strong>Bunny CDN:</strong> Content storage and delivery
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Your use of these third-party services is governed by their
                respective terms of service and privacy policies. We are not
                responsible for the availability, accuracy, or practices of
                these third-party services.
              </p>
            </section>

            {/* Disclaimers */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">12. Disclaimers</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT
                NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We do not warrant that:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>The Service will meet your specific requirements;</li>
                <li>
                  The Service will be uninterrupted, timely, secure, or
                  error-free;
                </li>
                <li>
                  AI-generated outputs will be accurate, complete, or suitable
                  for any purpose;
                </li>
                <li>Any defects in the Service will be corrected.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                AI-generated content may contain errors, inaccuracies, or
                unintended outputs. You are solely responsible for reviewing and
                using any AI-generated content appropriately.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                13. Limitation of Liability
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
                SHALL HAKANDA, ITS DIRECTORS, EMPLOYEES, PARTNERS, AGENTS,
                SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT
                LIMITATION LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER
                INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  Your access to or use of (or inability to access or use) the
                  Service;
                </li>
                <li>
                  Any conduct or content of any third party on the Service;
                </li>
                <li>Any content obtained from the Service;</li>
                <li>
                  Unauthorized access, use, or alteration of your transmissions
                  or content;
                </li>
                <li>Costs incurred through third-party API usage.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS
                EXCEED THE AMOUNT YOU PAID TO US FOR THE SERVICE IN THE TWELVE
                (12) MONTHS PRECEDING THE CLAIM, OR €149, WHICHEVER IS GREATER.
              </p>
            </section>

            {/* Indemnification */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                14. Indemnification
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to defend, indemnify, and hold harmless Hakanda, its
                officers, directors, employees, agents, and affiliates from and
                against any and all claims, damages, obligations, losses,
                liabilities, costs, and expenses (including reasonable
                attorneys' fees) arising from: (a) your use of the Service; (b)
                your violation of these Terms; (c) your violation of any
                third-party right, including intellectual property rights; (d)
                any claim that your User Content caused damage to a third party;
                or (e) your violation of any applicable law or regulation.
              </p>
            </section>

            {/* Termination */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">15. Termination</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may terminate or suspend your account and access to the
                Service immediately, without prior notice or liability, for any
                reason, including without limitation if you breach these Terms.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Upon termination:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Your right to use the Service will immediately cease;</li>
                <li>We may delete your account and all associated data;</li>
                <li>
                  Provisions of these Terms that by their nature should survive
                  termination shall survive, including ownership provisions,
                  warranty disclaimers, indemnification, and limitations of
                  liability.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You may terminate your account at any time by contacting us. No
                refunds will be provided for the Lifetime License upon voluntary
                termination.
              </p>
            </section>

            {/* Governing Law */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">16. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance
                with the laws of the Republic of Turkey, without regard to its
                conflict of law provisions. Any legal action or proceeding
                arising out of or relating to these Terms or your use of the
                Service shall be brought exclusively in the courts located in
                Istanbul, Turkey, and you hereby consent to the personal
                jurisdiction and venue of such courts.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                17. Dispute Resolution
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Before initiating any legal proceedings, you agree to first
                attempt to resolve any dispute informally by contacting us at
                legal@hakanda.com. We will attempt to resolve the dispute
                through good-faith negotiations within thirty (30) days.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If the dispute cannot be resolved informally, either party may
                pursue resolution through the courts of Istanbul, Turkey, as
                specified in Section 16.
              </p>
            </section>

            {/* Severability */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">18. Severability</h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is held to be invalid, illegal,
                or unenforceable by a court of competent jurisdiction, such
                invalidity, illegality, or unenforceability shall not affect any
                other provision of these Terms. The remaining provisions shall
                continue in full force and effect, and the invalid provision
                shall be modified to the minimum extent necessary to make it
                valid and enforceable while preserving its original intent.
              </p>
            </section>

            {/* Entire Agreement */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                19. Entire Agreement
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms, together with our Privacy Policy and any other
                legal notices published by us on the Service, constitute the
                entire agreement between you and Hakanda regarding your use of
                the Service. These Terms supersede any prior agreements,
                communications, or understandings, whether oral or written,
                between you and us regarding such subject matter.
              </p>
            </section>

            {/* Waiver */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">20. Waiver</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our failure to enforce any right or provision of these Terms
                shall not be deemed a waiver of such right or provision. Any
                waiver of any provision of these Terms will be effective only if
                in writing and signed by an authorized representative of
                Hakanda.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                21. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium">Hakanda - Legal Department</p>
                <p className="text-muted-foreground">
                  Email: legal@hakanda.com
                </p>
                <p className="text-muted-foreground">Website: hakanda.com</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 lg:px-8 text-center">
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
      </footer>
    </div>
  )
}
