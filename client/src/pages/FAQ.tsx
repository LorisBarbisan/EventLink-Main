import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import { faqData, buildFaqSchema, type FaqQuestion } from "@shared/faqData";

// Renders a plain-text answer, linkifying the optional inline link (its `text`
// appears verbatim inside the answer) so humans keep the clickable tutorial link.
function renderAnswer(faq: FaqQuestion) {
  if (!faq.answerLink) return faq.answer;
  const [before, ...rest] = faq.answer.split(faq.answerLink.text);
  if (rest.length === 0) return faq.answer;
  return (
    <span>
      {before}
      <a
        href={faq.answerLink.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#D8690E] underline hover:text-[#E97B24]"
      >
        {faq.answerLink.text}
      </a>
      {rest.join(faq.answerLink.text)}
    </span>
  );
}

export default function FAQ() {
  useEffect(() => {
    document.title = "Help Centre - Frequently Asked Questions | EventLink";

    // Add meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Find answers to frequently asked questions about EventLink - the premier platform connecting event professionals with opportunities across the events industry."
      );
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content =
        "Find answers to frequently asked questions about EventLink - the premier platform connecting event professionals with opportunities across the events industry.";
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => {
    // Add JSON-LD schema to page (also served to crawlers by ogTagMiddleware).
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(buildFaqSchema());
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      document.head.removeChild(script);
    };
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#D8690E] to-[#E97B24]">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-4 bg-gradient-to-r from-[#D8690E] to-[#E97B24] bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
              Help Centre
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              Find answers to frequently asked questions about EventLink
            </p>
          </div>

          {/* FAQ Sections */}
          {faqData.map((section, idx) => (
            <div key={idx} className="mb-8">
              <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold">
                <span className="h-8 w-1 rounded-full bg-gradient-to-b from-[#D8690E] to-[#E97B24]"></span>
                {section.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {section.questions.map((faq) => (
                  <AccordionItem
                    key={faq.id}
                    value={faq.id}
                    className="rounded-lg border bg-card px-6 transition-shadow data-[state=open]:shadow-md"
                    data-testid={`faq-item-${faq.id}`}
                  >
                    <AccordionTrigger
                      className="py-4 text-left font-semibold hover:no-underline"
                      data-testid={`faq-trigger-${faq.id}`}
                    >
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent
                      className="pb-4 text-muted-foreground"
                      data-testid={`faq-content-${faq.id}`}
                    >
                      {renderAnswer(faq)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* Contact Support CTA */}
          <div className="mt-16 rounded-lg border bg-card p-8 text-center">
            <h3 className="mb-3 text-2xl font-bold">Still have questions?</h3>
            <p className="mb-6 text-muted-foreground">
              Can&apos;t find what you&apos;re looking for? Get in touch with our support team.
            </p>
            <a
              href="/contact-us"
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#D8690E] to-[#E97B24] px-6 py-3 font-semibold text-white transition-shadow hover:shadow-lg"
              data-testid="button-contact-support"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
