import { Layout } from "@/components/Layout";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Who We Are</h2>
            <p>
              EventLink is operated by Kite ("we", "us", "our"). We provide a platform
              connecting freelance event technicians with employers in the live events industry.
              Our registered domain is <strong>app.eventlink.one</strong>.
            </p>
            <p className="mt-2">
              For any privacy-related enquiries, contact us at:{" "}
              <a href="mailto:privacy@eventlink.one" className="text-primary hover:underline">
                privacy@eventlink.one
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. What Data We Collect</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>Account information: name, email address, password (hashed), and role (freelancer or employer)</li>
              <li>Profile information: professional title, bio, skills, location, experience, portfolio links, and profile photo</li>
              <li>CV / resume files you upload</li>
              <li>Job postings, applications, and booking records</li>
              <li>Messages sent through the platform</li>
              <li>Calendar connection tokens (Google or Outlook), used solely to sync your bookings</li>
              <li>Usage data: pages visited, actions taken, and device/browser information for analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">3. Google Calendar Integration</h2>
            <p>
              When you choose to connect Google Calendar, EventLink requests permission to create,
              update, and delete calendar events on your behalf (scope:{" "}
              <code className="rounded bg-muted px-1 text-xs">calendar.events</code>). We also
              request your Google account email address to identify the connection.
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
              We do <strong>not</strong> read your existing calendar events, share your Google
              data with third parties, use it for advertising, or retain it beyond the purpose of
              syncing your EventLink bookings.
            </p>
            <p className="mt-2">
              Your Google OAuth tokens are stored securely in our database and used only to
              perform the above actions. You can disconnect Google Calendar at any time from the
              Calendar tab in your dashboard, which immediately revokes our access and deletes
              your stored tokens.
            </p>
            <p className="mt-2">
              EventLink's use and transfer of information received from Google APIs adheres to the{" "}
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

          <section>
            <h2 className="mb-3 text-lg font-semibold">4. How We Use Your Data</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>To operate and improve the EventLink platform</li>
              <li>To match freelancers with job opportunities</li>
              <li>To send transactional emails (booking confirmations, application updates, messages)</li>
              <li>To display your public profile to potential employers</li>
              <li>To generate anonymised usage statistics</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> sell your personal data to any third party.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">5. Data Sharing</h2>
            <p>We only share your data with:</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li><strong>Employers / Freelancers on the platform</strong> — profile information is visible to other users as part of the service</li>
              <li><strong>SendGrid</strong> — email delivery service</li>
              <li><strong>Google / Microsoft</strong> — only when you explicitly connect a calendar</li>
              <li><strong>Stripe</strong> — payment processing for Pro subscriptions (we do not store card details)</li>
              <li><strong>Law enforcement</strong> — if required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your
              account, your personal data is removed within 30 days, except where we are
              required to retain it for legal or financial compliance purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Your Rights</h2>
            <p>Under UK GDPR you have the right to:</p>
            <ul className="ml-4 mt-1 list-disc space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@eventlink.one" className="text-primary hover:underline">
                privacy@eventlink.one
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We also use
              Google Analytics cookies to understand how the platform is used. You can disable
              non-essential cookies in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (HTTPS),
              hashed passwords, and JWT-based authentication. No method of transmission over the
              internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. We will notify registered users of
              significant changes by email or via an in-app notice. Continued use of EventLink
              after changes are published constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Contact</h2>
            <p>
              For any questions about this policy, contact us at{" "}
              <a href="mailto:privacy@eventlink.one" className="text-primary hover:underline">
                privacy@eventlink.one
              </a>{" "}
              or via our{" "}
              <Link to="/contact-us" className="text-primary hover:underline">
                Contact page
              </Link>
              .
            </p>
          </section>

        </div>
      </div>
    </Layout>
  );
}
