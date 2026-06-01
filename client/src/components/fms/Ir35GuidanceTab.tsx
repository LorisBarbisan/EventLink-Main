import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ir35BookingTable } from "./Ir35BookingTable";

const DISCLAIMER =
  "The information on this page is provided for general guidance only and does not " +
  "constitute legal or tax advice. IR35 status determinations are the responsibility " +
  "of the hiring organisation. EventLink accepts no liability for any determination " +
  "made using this guidance. For definitive advice, consult a qualified tax professional " +
  "or use HMRC's official Check Employment Status for Tax (CEST) tool.";

const HMRC_LINKS = [
  {
    label: "IR35 and Off-Payroll Working — HMRC Guidance",
    url: "https://www.gov.uk/guidance/understanding-off-payroll-working-ir35",
    description: "Official government guidance on IR35 and off-payroll working rules.",
  },
  {
    label: "Status Determination Statements",
    url: "https://www.gov.uk/guidance/status-determination-statements",
    description: "How to provide a Status Determination Statement to your contractor.",
  },
  {
    label: "Employment Status for Tax — Overview",
    url: "https://www.gov.uk/employment-status",
    description: "General overview of employment status and its tax implications.",
  },
  {
    label: "Small Companies Exemption",
    url: "https://www.gov.uk/guidance/april-2021-changes-to-off-payroll-working-for-clients",
    description: "Information on which companies are exempt from the off-payroll rules.",
  },
];

export function Ir35GuidanceTab() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Legal Disclaimer Banner */}
      <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">{DISCLAIMER}</p>
      </div>

      {/* 2. What is IR35? */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">What is IR35?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700 leading-relaxed">
          <p>
            IR35 is UK tax legislation that determines whether a contractor or freelancer should
            be treated as an employee for tax purposes, even when they work through a limited
            company or as a self-employed individual.
          </p>
          <p>
            If a freelancer is found to be <strong>'inside IR35'</strong>, the hiring organisation
            is responsible for deducting Income Tax and National Insurance contributions from their
            pay, just as they would for an employee.
          </p>
          <p>
            If a freelancer is <strong>'outside IR35'</strong>, they manage their own tax affairs
            and the hiring organisation has no additional tax obligations beyond paying their agreed fee.
          </p>
          <p>
            Since April 2021, medium and large private sector organisations bear the responsibility
            for making IR35 determinations — not the freelancer. Small companies are currently
            exempt, but should still be aware of the rules.
          </p>
        </CardContent>
      </Card>

      {/* 3. Your Responsibilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Your Responsibilities as an Employer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 leading-relaxed">
          <p className="mb-4">As the organisation engaging a freelancer, you are responsible for:</p>
          <ol className="space-y-3 list-none">
            {[
              "Assessing whether each engagement falls inside or outside IR35",
              "Providing a Status Determination Statement (SDS) to the freelancer",
              "Deducting and paying Income Tax and NICs if the engagement is inside IR35",
              "Keeping records of your determinations",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
            <p>
              The HMRC Check Employment Status for Tax (CEST) tool is the recommended starting
              point for making a determination. HMRC will stand behind CEST results provided the
              information entered is accurate and the tool is used correctly.
            </p>
            <p className="mt-2">
              If you are a small company (fewer than 50 employees, annual turnover under £10.2m,
              and balance sheet under £5.1m — two of three must apply), the off-payroll working
              rules currently do not apply to you, but best practice is still to assess and
              document each engagement.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. HMRC Links */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Official HMRC Resources</h2>

        {/* Primary CTA */}
        <a
          href="https://www.tax.service.gov.uk/check-employment-status-for-tax"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button size="lg" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <ExternalLink className="h-4 w-4" />
            Use HMRC CEST Tool
          </Button>
        </a>
        <p className="text-xs text-muted-foreground">
          HMRC's official tool to check employment status for tax purposes.
        </p>

        {/* Secondary link cards — 2×2 grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {HMRC_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 transition-colors group"
            >
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-orange-700 leading-snug">
                  {link.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 5. Booking IR35 Status Table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Record IR35 Status per Booking</h2>
          <p className="text-sm text-muted-foreground mt-1">
            After using the CEST tool, record the outcome for each booking below. This helps you
            maintain an audit trail of your determinations.
          </p>
          <p className="text-xs text-muted-foreground mt-1 italic">
            Note: This record is for your internal use only. EventLink does not share IR35 status
            information with freelancers.
          </p>
        </div>
        <Ir35BookingTable />
      </div>

      {/* 6. Footer disclaimer */}
      <p className="text-xs text-muted-foreground border-t pt-4">
        This information is provided for guidance only and does not constitute legal or tax advice.
      </p>
    </div>
  );
}
