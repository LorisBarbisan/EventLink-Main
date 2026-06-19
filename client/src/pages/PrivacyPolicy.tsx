import { Layout } from "@/components/Layout";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">Privacy Policy &amp; GDPR Notice</h1>
        <p className="mb-1 text-sm text-muted-foreground">Last updated: June 2026</p>
        <p className="mb-8 text-sm text-muted-foreground">
          Version 2.0 — applies to all users worldwide, including the European Economic Area (EEA),
          United Kingdom, and United States.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Who We Are (Data Controller)</h2>
            <p>
              EventLink is operated by <strong>Kite</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
              &ldquo;our&rdquo;), a company registered in England and Wales. We provide a platform
              connecting freelance event technicians with employers in the live events industry. Our
              primary domain is <strong>eventlink.one</strong>.
            </p>
            <p className="mt-2">
              As the data controller, we determine the purposes and means of processing your
              personal data. For all privacy-related enquiries:
            </p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>
                Email:{" "}
                <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                  admin@eventlink.one
                </a>
              </li>
              <li>Subject line: &ldquo;Privacy Request&rdquo;</li>
            </ul>
            <p className="mt-2">
              We are not currently required to appoint a Data Protection Officer (DPO); however,
              privacy enquiries are handled directly by our management team and we will respond
              within 30 days.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Scope and Applicable Law</h2>
            <p>
              This policy applies to all users of EventLink regardless of location. Depending on
              where you are based, the following laws may apply to how we handle your data:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                <strong>United Kingdom:</strong> UK General Data Protection Regulation (UK GDPR) and
                the Data Protection Act 2018
              </li>
              <li>
                <strong>European Economic Area (EEA):</strong> EU General Data Protection Regulation
                2016/679 (EU GDPR)
              </li>
              <li>
                <strong>California, USA:</strong> California Consumer Privacy Act (CCPA) /
                California Privacy Rights Act (CPRA)
              </li>
              <li>
                <strong>Other jurisdictions:</strong> We apply the principles of the UK/EU GDPR as a
                baseline standard for all users globally
              </li>
            </ul>
            <p className="mt-2">
              Where UK GDPR and EU GDPR differ, we apply the higher standard of protection.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">3. What Personal Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>

            <h3 className="mb-1 mt-3 font-semibold">3.1 Account &amp; Identity Data</h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>Full name and email address</li>
              <li>
                Password (stored as an irreversible hash — we never store your plain-text password)
              </li>
              <li>Account role (freelancer or employer)</li>
              <li>Account creation date and login activity</li>
            </ul>

            <h3 className="mb-1 mt-3 font-semibold">3.2 Profile Data</h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>Professional title, biography, skills, and superpower summary</li>
              <li>City, country, and years of experience</li>
              <li>Portfolio links, LinkedIn URL, and personal website URL</li>
              <li>Profile photograph</li>
              <li>Availability status</li>
              <li>CV / resume files you upload</li>
              <li>Portfolio posts (photos, videos, blog-style text) you publish on the platform</li>
            </ul>

            <h3 className="mb-1 mt-3 font-semibold">3.3 Activity &amp; Transactional Data</h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>Job postings, applications submitted and received, and booking records</li>
              <li>Messages sent and received through the platform</li>
              <li>Saved profiles and crew lists</li>
              <li>Ratings and references given or received</li>
            </ul>

            <h3 className="mb-1 mt-3 font-semibold">3.4 Technical &amp; Usage Data</h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>IP address, browser type, operating system, and device identifiers</li>
              <li>Pages visited, features used, and time spent on the platform</li>
              <li>Session tokens for authentication (JWT)</li>
              <li>Error logs and performance data</li>
            </ul>

            <h3 className="mb-1 mt-3 font-semibold">3.5 Third-Party Integration Data</h3>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Google or Microsoft OAuth tokens (only when you voluntarily connect your calendar)
              </li>
              <li>
                Payment method details — handled entirely by Stripe; we do not receive or store card
                numbers, expiry dates, or CVV codes
              </li>
            </ul>

            <p className="mt-2">
              We do <strong>not</strong> collect special category data (e.g. health, ethnicity,
              religion, political opinions, biometric data) and ask that you do not include such
              information on your profile.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Legal Basis for Processing</h2>
            <p>
              Under UK GDPR and EU GDPR, we must have a lawful basis for every processing activity.
              The table below sets out each purpose and the basis we rely on:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-semibold">Purpose</th>
                    <th className="p-2 text-left font-semibold">Lawful Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Creating and managing your account", "Contract (Art. 6(1)(b))"],
                    [
                      "Matching freelancers with job opportunities",
                      "Contract / Legitimate Interests (Art. 6(1)(b)(f))",
                    ],
                    ["Displaying your public profile to employers", "Contract (Art. 6(1)(b))"],
                    [
                      "Sending booking confirmations and application updates",
                      "Contract (Art. 6(1)(b))",
                    ],
                    ["Sending platform notifications and messages", "Contract (Art. 6(1)(b))"],
                    ["Processing subscription payments via Stripe", "Contract (Art. 6(1)(b))"],
                    [
                      "Syncing your calendar (Google / Outlook)",
                      "Consent (Art. 6(1)(a)) — you can withdraw at any time",
                    ],
                    [
                      "Analysing platform usage to improve the service",
                      "Legitimate Interests (Art. 6(1)(f))",
                    ],
                    [
                      "Fraud prevention and security monitoring",
                      "Legitimate Interests (Art. 6(1)(f))",
                    ],
                    [
                      "Legal compliance and responding to lawful requests",
                      "Legal Obligation (Art. 6(1)(c))",
                    ],
                    [
                      "Marketing communications (if opted in)",
                      "Consent (Art. 6(1)(a)) — you can unsubscribe at any time",
                    ],
                  ].map(([purpose, basis], i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 align-top">{purpose}</td>
                      <td className="p-2 align-top text-muted-foreground">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Where we rely on <strong>legitimate interests</strong>, we have conducted a balancing
              test and concluded that our interests do not override your fundamental rights and
              freedoms. You have the right to object to processing based on legitimate interests
              (see Section 9).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Google Calendar Integration</h2>
            <p>
              When you choose to connect Google Calendar, EventLink requests the{" "}
              <code className="rounded bg-muted px-1 text-xs">calendar.events</code> scope to
              create, update, and delete calendar events on your behalf, and your Google account
              email address to identify the connection.
            </p>
            <p className="mt-2">
              <strong>We only use this access to:</strong>
            </p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>Create calendar events for confirmed bookings on your EventLink account</li>
              <li>Update those events when booking details change</li>
              <li>Delete those events if a booking is cancelled</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> read your existing calendar events, share your Google data
              with third parties, use it for advertising, or retain it beyond syncing your bookings.
              You can disconnect at any time from your dashboard Calendar tab, which immediately
              revokes our access and deletes your stored tokens.
            </p>
            <p className="mt-2">
              EventLink&apos;s use of Google API data adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              6. Data Sharing and Third-Party Processors
            </h2>
            <p>
              We do <strong>not</strong> sell, rent, or trade your personal data. We share data only
              in the following circumstances:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-semibold">Recipient</th>
                    <th className="p-2 text-left font-semibold">Purpose</th>
                    <th className="p-2 text-left font-semibold">Safeguard</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Other EventLink users (employers / freelancers)",
                      "Core platform functionality — profile visibility, messaging, applications",
                      "Contractual necessity; data minimisation applied",
                    ],
                    [
                      "Neon (PostgreSQL hosting)",
                      "Secure database storage",
                      "EU/UK Standard Contractual Clauses (SCCs); data encrypted at rest",
                    ],
                    [
                      "Railway (application hosting)",
                      "Hosting and running the EventLink application",
                      "Located in US; SCCs in place",
                    ],
                    [
                      "SendGrid / Twilio",
                      "Transactional email delivery",
                      "Located in US; SCCs in place; GDPR Data Processing Agreement signed",
                    ],
                    [
                      "Stripe",
                      "Payment processing for Pro subscriptions",
                      "PCI-DSS Level 1 certified; SCCs in place; we share only what Stripe requires (name, email, country)",
                    ],
                    [
                      "Google / Microsoft",
                      "Calendar sync (only when you connect)",
                      "Conditional on your explicit consent; governed by their own privacy policies",
                    ],
                    [
                      "Law enforcement / regulatory authorities",
                      "Where required by applicable law or court order",
                      "Legal obligation; we will notify you where legally permitted to do so",
                    ],
                  ].map(([recipient, purpose, safeguard], i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 align-top font-medium">{recipient}</td>
                      <td className="p-2 align-top">{purpose}</td>
                      <td className="p-2 align-top text-muted-foreground">{safeguard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">7. International Data Transfers</h2>
            <p>
              Some of our third-party processors are located outside the UK and EEA (primarily the
              United States). Where this is the case, we ensure appropriate safeguards are in place:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                <strong>Standard Contractual Clauses (SCCs)</strong> approved by the European
                Commission and the UK ICO (International Data Transfer Agreements — IDTAs)
              </li>
              <li>
                <strong>Adequacy decisions</strong> where the destination country is recognised as
                providing an adequate level of data protection
              </li>
              <li>
                <strong>Binding Corporate Rules</strong> where applicable
              </li>
            </ul>
            <p className="mt-2">
              You may request a copy of the relevant transfer safeguards by contacting us at{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>
              .
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Data Retention</h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong>Active accounts:</strong> We retain your personal data for as long as your
                account is active and for a period of 12 months after your last login, after which
                we may send you a retention notice.
              </li>
              <li>
                <strong>Account deletion:</strong> When you delete your account, your personal data
                is anonymised or deleted within <strong>30 days</strong>, except where retention is
                required by law.
              </li>
              <li>
                <strong>Financial and billing records:</strong> Retained for{" "}
                <strong>7 years</strong> as required by UK tax and accounting law.
              </li>
              <li>
                <strong>Legal hold:</strong> Where data is subject to an active legal dispute,
                regulatory investigation, or court order, we will retain it until the matter is
                resolved.
              </li>
              <li>
                <strong>Calendar tokens:</strong> Deleted immediately on disconnection.
              </li>
              <li>
                <strong>Technical logs:</strong> Retained for a maximum of 90 days.
              </li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Your Rights</h2>
            <p>
              Depending on your location, you have the following rights regarding your personal
              data. To exercise any right, email{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>{" "}
              with subject line &ldquo;Data Rights Request&rdquo;. We will respond within{" "}
              <strong>30 days</strong> (extendable by a further 60 days for complex requests, with
              notice).
            </p>

            <h3 className="mb-1 mt-3 font-semibold">9.1 UK &amp; EU GDPR Rights</h3>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong>Right of access (Art. 15):</strong> Request a copy of all personal data we
                hold about you.
              </li>
              <li>
                <strong>Right to rectification (Art. 16):</strong> Request correction of inaccurate
                or incomplete data. Most profile data can be updated directly in your dashboard.
              </li>
              <li>
                <strong>Right to erasure / &ldquo;right to be forgotten&rdquo; (Art. 17):</strong>{" "}
                Request deletion of your personal data where there is no overriding legal basis for
                retention.
              </li>
              <li>
                <strong>Right to restriction of processing (Art. 18):</strong> Request that we pause
                processing your data while a dispute is resolved.
              </li>
              <li>
                <strong>Right to data portability (Art. 20):</strong> Receive your data in a
                structured, machine-readable format (JSON or CSV) to transfer to another service.
                Applies to data processed on the basis of consent or contract.
              </li>
              <li>
                <strong>Right to object (Art. 21):</strong> Object to processing based on legitimate
                interests or for direct marketing. We will cease processing unless we can
                demonstrate compelling legitimate grounds.
              </li>
              <li>
                <strong>Rights related to automated decision-making (Art. 22):</strong> We do not
                make solely automated decisions with legal or similarly significant effects. Our
                matching and search features are informational tools; humans always make final
                hiring decisions.
              </li>
              <li>
                <strong>Right to withdraw consent:</strong> Where processing is based on consent
                (e.g. calendar integration, marketing emails), you may withdraw at any time without
                affecting the lawfulness of prior processing.
              </li>
            </ul>

            <h3 className="mb-1 mt-3 font-semibold">9.2 California Residents (CCPA / CPRA)</h3>
            <p>In addition to the above, California residents have the right to:</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>
                <strong>Know</strong> what personal information we collect, use, disclose, and sell
              </li>
              <li>
                <strong>Delete</strong> personal information we have collected (subject to certain
                exceptions)
              </li>
              <li>
                <strong>Opt-out of the sale or sharing</strong> of personal information —{" "}
                <em>
                  we do not sell or share personal information for cross-context behavioural
                  advertising
                </em>
              </li>
              <li>
                <strong>Correct</strong> inaccurate personal information
              </li>
              <li>
                <strong>Limit use of sensitive personal information</strong>
              </li>
              <li>
                <strong>Non-discrimination</strong> — we will not discriminate against you for
                exercising your CCPA rights
              </li>
            </ul>
            <p className="mt-2">
              To submit a CCPA request, email{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>{" "}
              with &ldquo;CCPA Request&rdquo; in the subject line. We may need to verify your
              identity before processing the request.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Cookies and Tracking Technologies</h2>
            <p>We use the following types of cookies:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left font-semibold">Type</th>
                    <th className="p-2 text-left font-semibold">Purpose</th>
                    <th className="p-2 text-left font-semibold">Legal Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Strictly necessary",
                      "Authentication session tokens, CSRF protection, security",
                      "Legitimate Interests / Contractual necessity — cannot be disabled",
                    ],
                    [
                      "Functional",
                      "Remembering your preferences (e.g. theme, tab state)",
                      "Legitimate Interests",
                    ],
                    [
                      "Analytics",
                      "Understanding how the platform is used (aggregated, anonymised)",
                      "Consent",
                    ],
                    ["Marketing", "Currently not used", "N/A"],
                  ].map(([type, purpose, basis], i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 align-top font-medium">{type}</td>
                      <td className="p-2 align-top">{purpose}</td>
                      <td className="p-2 align-top text-muted-foreground">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              You can manage cookie preferences through your browser settings. Disabling cookies
              other than strictly necessary ones will not affect your ability to use the core
              platform.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Children&apos;s Privacy</h2>
            <p>
              EventLink is not directed at children under the age of 16 (or 13 in the United
              States). We do not knowingly collect personal data from children. If you believe a
              child has provided us with personal data, please contact us immediately at{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>{" "}
              and we will delete it promptly.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">12. Security Measures</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your data,
              including:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>Encrypted connections (HTTPS / TLS 1.2+) for all data in transit</li>
              <li>Passwords stored using industry-standard one-way hashing (bcrypt)</li>
              <li>JWT-based authentication with short-lived tokens</li>
              <li>Database encryption at rest</li>
              <li>Access controls limiting staff access to data on a need-to-know basis</li>
              <li>Regular security reviews</li>
            </ul>
            <p className="mt-2">
              In the event of a personal data breach that is likely to result in a risk to your
              rights and freedoms, we will notify the relevant supervisory authority within{" "}
              <strong>72 hours</strong> of becoming aware, and will inform affected users without
              undue delay where required.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              13. Complaints and Supervisory Authorities
            </h2>
            <p>
              If you are not satisfied with how we handle your personal data, you have the right to
              lodge a complaint with the relevant data protection authority:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>United Kingdom:</strong> Information Commissioner&apos;s Office (ICO) —{" "}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ico.org.uk
                </a>{" "}
                — Tel: 0303 123 1113
              </li>
              <li>
                <strong>Ireland / EU lead supervisory authority:</strong> Data Protection Commission
                (DPC) —{" "}
                <a
                  href="https://www.dataprotection.ie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  dataprotection.ie
                </a>
              </li>
              <li>
                <strong>Other EEA countries:</strong> You may also contact the supervisory authority
                in your country of residence
              </li>
              <li>
                <strong>California (USA):</strong> California Privacy Protection Agency (CPPA) —{" "}
                <a
                  href="https://cppa.ca.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  cppa.ca.gov
                </a>
              </li>
            </ul>
            <p className="mt-2">
              We would always encourage you to contact us first so we can resolve your concern
              directly.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">14. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time to reflect changes in our practices, legal
              obligations, or the features we offer. We will notify registered users of material
              changes by email or via an in-app notice at least <strong>14 days</strong> before they
              take effect. The &ldquo;Last updated&rdquo; date at the top of this page will always
              reflect the current version.
            </p>
            <p className="mt-2">
              Continued use of EventLink after changes take effect constitutes acceptance of the
              updated policy. If you do not agree with changes, you may close your account at any
              time.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">15. Contact Us</h2>
            <p>For any questions, requests, or concerns about this policy:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>
                Email:{" "}
                <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                  admin@eventlink.one
                </a>
              </li>
              <li>
                Contact form:{" "}
                <Link to="/contact-us" className="text-primary hover:underline">
                  eventlink.one/contact-us
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </Layout>
  );
}
