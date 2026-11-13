import { Layout } from "@/components/Layout";
import { Link } from "wouter";

export default function TermsOfUse() {
  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">Terms of Use</h1>
        <p className="mb-1 text-sm text-muted-foreground">Last updated: November 2026</p>
        <p className="mb-2 text-sm text-muted-foreground">Version 2.0</p>
        <p className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          These terms have been updated in November 2026 to describe the verification checks
          EventLink carries out, to cover your business records, and to clarify that EventLink is a
          record-keeping tool and not a source of accountancy, tax or financial advice.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using EventLink (&ldquo;the platform&rdquo;), you agree to be bound by
              these Terms of Use. If you do not agree to these terms, please do not use the
              platform. These terms apply to all users, including freelancers, employers, and
              visitors.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Description of Service</h2>
            <p>
              EventLink is an online platform operated by <strong>Kite</strong>, registered in
              England and Wales. The platform connects freelance event technicians and professionals
              with employers in the live events industry. EventLink also provides tools for
              freelancers to manage their business records, including income, expenses, invoices,
              and mileage.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">3. User Accounts</h2>
            <p>
              To access most features, you must create an account. You are responsible for
              maintaining the confidentiality of your login credentials and for all activity that
              occurs under your account. You must notify us immediately at{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>{" "}
              if you become aware of any unauthorised use of your account.
            </p>
            <p className="mt-2">
              You must provide accurate, current, and complete information when creating your
              account. You may not create an account on behalf of another person without their
              consent, or use the platform for any unlawful purpose.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">4. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use EventLink. By creating an account, you
              confirm that you meet this requirement. If you are using the platform on behalf of an
              organisation, you confirm that you have the authority to bind that organisation to
              these terms.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">5. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1">
              <li>Post false, misleading, or defamatory content</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>
                Use the platform to solicit users for services outside of EventLink in a way that
                circumvents the platform
              </li>
              <li>Upload malicious code, viruses, or disruptive content</li>
              <li>
                Scrape, crawl, or systematically extract data from the platform without prior
                written consent
              </li>
              <li>Impersonate another person or organisation</li>
              <li>
                Use automated systems to access the platform in a way that sends more requests than
                a human could reasonably produce
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">6. Content and Intellectual Property</h2>
            <p>
              You retain ownership of content you upload or post (&ldquo;User Content&rdquo;). By
              posting User Content, you grant EventLink a non-exclusive, royalty-free licence to
              display, store, and distribute that content solely for the purpose of operating the
              platform.
            </p>
            <p className="mt-2">
              EventLink&apos;s name, logo, design, and all platform content not owned by users are
              the property of Kite and may not be used without written permission. All rights
              reserved.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">7. Privacy</h2>
            <p>
              Your use of EventLink is also governed by our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated into these terms by reference.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">8. Verification, Ratings and Disclaimers</h2>

            <h3 className="mb-2 mt-3 font-semibold">8.1 What verification means on EventLink</h3>
            <p>Where a profile displays verified credentials, ratings or references, this means:</p>
            <ul className="ml-4 mt-2 list-disc space-y-2">
              <li>
                <strong>Credentials</strong> — the freelancer has uploaded a document and told us
                what it is and when it expires. We display it and track the expiry date they have
                given. We do not independently confirm the document with the body that issued it
                unless we expressly say so on the profile.
              </li>
              <li>
                <strong>Ratings</strong> — an employer who booked that freelancer through EventLink
                has rated them. Ratings are the opinions of the people who gave them.
              </li>
              <li>
                <strong>References</strong> — a reference has been confirmed through the
                referee&apos;s LinkedIn account.
              </li>
              <li>
                <strong>Identity</strong> — where a profile shows an identity check, the freelancer
                has completed a document and likeness check with our identity verification provider.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold">8.2 What it does not mean</h3>
            <p>
              Verification is a record of checks carried out on information provided to us. It is
              not a guarantee of any person&apos;s competence, conduct, qualifications, insurance,
              right to work, or suitability for any particular engagement. You remain responsible
              for satisfying yourself that anyone you engage is suitable, and for carrying out any
              checks your own obligations require.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">8.3 No guarantee of outcome</h3>
            <p>
              We provide a platform. We are not a party to any engagement arranged through it, we do
              not employ freelancers, and we do not guarantee that any engagement will be offered,
              accepted, performed or paid.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">9. Payments and Subscriptions</h2>
            <p>
              Certain features may require a paid subscription. All payments are processed securely
              by Stripe. By subscribing, you authorise us to charge the applicable fees to your
              chosen payment method on the billing cycle you select. Subscriptions renew
              automatically unless cancelled before the renewal date. Cancellation takes effect at
              the end of the current billing period.
            </p>
            <p className="mt-2">
              Refunds are not provided for partial billing periods unless required by applicable
              law. For billing queries, contact{" "}
              <a href="mailto:admin@eventlink.one" className="text-primary hover:underline">
                admin@eventlink.one
              </a>
              .
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for breach of
              these terms, fraudulent activity, or behaviour harmful to other users or the platform.
              You may close your account at any time from your Account Settings. Termination does
              not affect any rights or obligations that arose before the termination date.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">11. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, EventLink and Kite shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising out of your
              use of or inability to use the platform, including but not limited to loss of profits,
              data, or goodwill.
            </p>
            <p className="mt-2">
              Our total liability to you for any claim arising from your use of the platform shall
              not exceed the greater of (i) the amount you paid to us in the twelve months preceding
              the claim, or (ii) £100.
            </p>
            <p className="mt-2">
              Nothing in these terms excludes or limits our liability for death or personal injury
              caused by negligence, fraud, or any other liability that cannot be excluded under
              applicable law.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">12. Indemnity</h2>
            <p>
              You agree to indemnify and hold harmless EventLink and Kite from any claims, losses,
              damages, or expenses (including reasonable legal fees) arising from your use of the
              platform, your breach of these terms, or your violation of any third-party rights.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">13. Governing Law</h2>
            <p>
              These terms are governed by the laws of England and Wales. Any disputes arising from
              or relating to these terms or your use of the platform shall be subject to the
              exclusive jurisdiction of the courts of England and Wales, except where applicable law
              requires otherwise.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">14. Your Business Records</h2>

            <h3 className="mb-2 mt-3 font-semibold">14.1 Your data</h3>
            <p>
              Records you create using EventLink&apos;s business tools — income, expenses, invoices,
              mileage, equipment and related documents — belong to you. We store them to provide the
              tools to you and we do not share them with other users.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">14.2 Accuracy</h3>
            <p>
              You are responsible for the accuracy and completeness of what you enter, upload or
              import. Where a feature extracts information automatically — from a receipt image, an
              uploaded file or a connected account — it produces a suggestion for you to check and
              confirm. We do not warrant that automatic extraction is accurate, and confirming a
              suggestion is your decision.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">14.3 Availability and export</h3>
            <p>
              You can export your records at any time, in a standard format. We retain them as set
              out in our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . These tools are a convenience, not a substitute for keeping your own copies, and we
              recommend you export periodically.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">14.4 Deletion</h3>
            <p>
              Deleting a record or your account deletes the data concerned. We cannot recover it
              afterwards. The legal obligation to keep business records is yours, and you should
              export anything you are required to keep before deleting it.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">
              15. No Accountancy, Tax or Financial Advice
            </h2>

            <h3 className="mb-2 mt-3 font-semibold">15.1</h3>
            <p>
              EventLink is a record-keeping tool. We are not accountants, tax advisers or financial
              advisers, and nothing in the platform constitutes accountancy, tax, legal or financial
              advice.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">15.2</h3>
            <p>
              Any tax figure shown is an <strong>estimate</strong>, calculated from the records you
              have entered and the rates and thresholds in force for the relevant tax year. It is
              provided to help you plan. It is not a calculation of what you owe.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">15.3</h3>
            <p>
              Estimates are based on data you have entered. They cover Income Tax, Class 4 National
              Insurance, student loan repayments, payments on account, pension relief, Gift Aid band
              extension, working-from-home flat rate, losses carried forward, the High Income Child
              Benefit Charge, and Marriage Allowance. They do not cover capital allowances on
              vehicles or equipment (the estimate will warn you if you try to record a car as an
              ordinary expense), rental income, foreign income, capital gains, the pension annual
              allowance charge, savings and dividend income at their specific rates, or anything
              else specific to your circumstances that you have not entered. All figures are
              estimates. The estimate is not a calculation of what you owe and does not constitute
              tax advice.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">15.4</h3>
            <p>
              We are not recognised by HMRC as software for Making Tax Digital, we do not submit
              anything to HMRC on your behalf, and using EventLink does not discharge any obligation
              you have to HMRC.
            </p>

            <h3 className="mb-2 mt-4 font-semibold">15.5</h3>
            <p>
              You should consult a qualified accountant or tax adviser before relying on any figure
              produced by EventLink. You remain solely responsible for your tax affairs.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">16. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. We will notify registered users of
              material changes by email or in-app notice at least <strong>14 days</strong> before
              they take effect. The &ldquo;Last updated&rdquo; date at the top of this page always
              reflects the current version. Continued use of EventLink after changes take effect
              constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">17. Contact</h2>
            <p>For any questions about these terms:</p>
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
