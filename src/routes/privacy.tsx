import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPolicyPage,
})

function PrivacyPolicyPage() {
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
            Privacy Policy
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
            {/* Introduction */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Hakanda ("we," "our," or "us") operates the Cinevido platform
                (the "Service"), an AI-powered creative studio accessible at
                cinevido.com. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our
                Service.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We are committed to protecting your privacy and ensuring
                compliance with the Turkish Personal Data Protection Law No.
                6698 ("KVKK"), the European Union General Data Protection
                Regulation ("GDPR"), and other applicable data protection
                legislation. By using our Service, you consent to the data
                practices described in this policy.
              </p>
            </section>

            {/* Data Controller */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                2. Data Controller
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The data controller responsible for your personal data is:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="font-medium">Hakanda</p>
                <p className="text-muted-foreground">Istanbul, Turkey</p>
                <p className="text-muted-foreground">
                  Email: privacy@hakanda.com
                </p>
                <p className="text-muted-foreground">Website: hakanda.com</p>
              </div>
            </section>

            {/* Information We Collect */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                3. Information We Collect
              </h2>

              <h3 className="text-xl font-medium mb-3">
                3.1 Information You Provide Directly
              </h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
                <li>
                  <strong>Account Information:</strong> When you register, we
                  collect your name, email address, and password (stored in
                  hashed form).
                </li>
                <li>
                  <strong>Payment Information:</strong> Payment transactions are
                  processed by Stripe, Inc. We do not store complete credit card
                  numbers on our servers. We retain only transaction identifiers
                  and billing details necessary for our records.
                </li>
                <li>
                  <strong>API Keys:</strong> If you use our BYOK (Bring Your Own
                  Key) feature, your fal.ai API key is encrypted using
                  industry-standard AES-256 encryption before storage.
                </li>
                <li>
                  <strong>User Content:</strong> Images, videos, prompts, and
                  other content you create or upload through the Service.
                </li>
              </ul>

              <h3 className="text-xl font-medium mb-3">
                3.2 Information Collected Automatically
              </h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Usage Data:</strong> We collect information about your
                  interactions with the Service, including features used,
                  generation history, and session duration.
                </li>
                <li>
                  <strong>Device Information:</strong> Browser type, operating
                  system, device identifiers, and IP address.
                </li>
                <li>
                  <strong>Log Data:</strong> Server logs that record requests
                  made to our Service, including timestamps and referring URLs.
                </li>
              </ul>
            </section>

            {/* Legal Basis */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                4. Legal Basis for Processing
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Under KVKK and GDPR, we process your personal data based on the
                following legal grounds:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Contractual Necessity:</strong> Processing necessary
                  to perform our contract with you and provide the Service.
                </li>
                <li>
                  <strong>Legitimate Interests:</strong> Processing necessary
                  for our legitimate business interests, such as improving our
                  Service, preventing fraud, and ensuring security.
                </li>
                <li>
                  <strong>Legal Obligations:</strong> Processing necessary to
                  comply with applicable laws and regulations.
                </li>
                <li>
                  <strong>Consent:</strong> Where required, we will obtain your
                  explicit consent before processing your data for specific
                  purposes.
                </li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                5. How We Use Your Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>To provide, operate, and maintain the Service</li>
                <li>To process transactions and send related information</li>
                <li>
                  To communicate with you regarding updates, support, and
                  promotional materials (with your consent)
                </li>
                <li>
                  To monitor and analyze usage patterns to improve user
                  experience
                </li>
                <li>
                  To detect, prevent, and address technical issues and security
                  threats
                </li>
                <li>To comply with legal obligations and enforce our terms</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                6. Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We engage trusted third-party service providers to assist in
                operating our Service:
              </p>

              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">fal.ai</h4>
                  <p className="text-sm text-muted-foreground">
                    AI model provider. When you use AI generation features, your
                    prompts and images are transmitted to fal.ai for processing.
                    Please review fal.ai's privacy policy for their data
                    handling practices.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Stripe, Inc.</h4>
                  <p className="text-sm text-muted-foreground">
                    Payment processing. Stripe handles all payment transactions
                    and stores payment credentials in accordance with PCI-DSS
                    standards.
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Bunny CDN</h4>
                  <p className="text-sm text-muted-foreground">
                    Content delivery and storage. Your generated content is
                    stored on Bunny CDN's global infrastructure for fast and
                    reliable access.
                  </p>
                </div>
              </div>
            </section>

            {/* International Data Transfers */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                7. International Data Transfers
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in
                countries other than Turkey, including the United States and
                European Union member states. When we transfer data
                internationally, we implement appropriate safeguards in
                accordance with KVKK Article 9 and GDPR Chapter V, including
                Standard Contractual Clauses approved by the European Commission
                and adequacy decisions where applicable.
              </p>
            </section>

            {/* Data Security */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">8. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We implement robust technical and organizational measures to
                protect your personal data:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Encryption of data in transit using TLS 1.3</li>
                <li>
                  AES-256 encryption for sensitive data at rest, including API
                  keys
                </li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>
                  Access controls limiting personnel access to personal data
                </li>
                <li>Secure authentication mechanisms with hashed passwords</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                While we strive to use commercially acceptable means to protect
                your data, no method of transmission over the Internet or
                electronic storage is 100% secure.
              </p>
            </section>

            {/* Data Retention */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">9. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We retain your personal data only for as long as necessary to
                fulfill the purposes outlined in this policy:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Account Data:</strong> Retained for the duration of
                  your account and for 30 days following account deletion.
                </li>
                <li>
                  <strong>Generated Content:</strong> Retained until you delete
                  it or close your account.
                </li>
                <li>
                  <strong>Transaction Records:</strong> Retained for 10 years as
                  required by Turkish commercial and tax law.
                </li>
                <li>
                  <strong>Log Data:</strong> Retained for 12 months for security
                  and analytical purposes.
                </li>
              </ul>
            </section>

            {/* Your Rights */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">10. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Under KVKK and GDPR, you have the following rights regarding
                your personal data:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Right of Access:</strong> Request a copy of the
                  personal data we hold about you.
                </li>
                <li>
                  <strong>Right to Rectification:</strong> Request correction of
                  inaccurate or incomplete data.
                </li>
                <li>
                  <strong>Right to Erasure:</strong> Request deletion of your
                  personal data, subject to legal retention requirements.
                </li>
                <li>
                  <strong>Right to Restriction:</strong> Request limitation of
                  processing in certain circumstances.
                </li>
                <li>
                  <strong>Right to Data Portability:</strong> Receive your data
                  in a structured, machine-readable format.
                </li>
                <li>
                  <strong>Right to Object:</strong> Object to processing based
                  on legitimate interests or direct marketing.
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> Withdraw
                  previously given consent at any time.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                To exercise these rights, please contact us at
                privacy@hakanda.com. We will respond to your request within 30
                days as required by law. You also have the right to lodge a
                complaint with the Turkish Personal Data Protection Authority
                (KVKK) or your local supervisory authority.
              </p>
            </section>

            {/* Cookies */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                11. Cookies and Tracking Technologies
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use essential cookies strictly necessary for the operation of
                our Service:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>
                  <strong>Session Cookies:</strong> To maintain your
                  authenticated session.
                </li>
                <li>
                  <strong>Security Cookies:</strong> To prevent cross-site
                  request forgery and ensure secure transactions.
                </li>
                <li>
                  <strong>Preference Cookies:</strong> To remember your settings
                  and preferences.
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We do not use third-party tracking cookies or advertising
                cookies. You may configure your browser to refuse cookies, but
                this may limit your ability to use certain features of the
                Service.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                12. Children's Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not directed to individuals under the age of 18.
                We do not knowingly collect personal data from children. If we
                become aware that we have collected personal data from a child
                without parental consent, we will take steps to delete such
                information. If you believe we may have collected data from a
                minor, please contact us immediately.
              </p>
            </section>

            {/* Changes to Policy */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                13. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time to reflect
                changes in our practices or applicable law. We will notify you
                of any material changes by posting the new policy on this page
                and updating the "Last Updated" date. For significant changes,
                we will provide additional notice via email or through the
                Service. Your continued use of the Service after such
                modifications constitutes your acknowledgment of the modified
                policy.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                14. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions, concerns, or requests regarding this
                Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium">Hakanda - Data Protection</p>
                <p className="text-muted-foreground">
                  Email: privacy@hakanda.com
                </p>
                <p className="text-muted-foreground">Website: hakanda.com</p>
              </div>
              <p className="text-muted-foreground leading-relaxed mt-4">
                We will endeavor to respond to all inquiries within a reasonable
                timeframe and in accordance with applicable legal requirements.
              </p>
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
