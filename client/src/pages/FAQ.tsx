import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

export default function FAQ() {
  useEffect(() => {
    document.title = "Help Centre - Frequently Asked Questions | EventLink";

    // Add meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Find answers to frequently asked questions about EventLink - the premier platform connecting event professionals with opportunities in the corporate events sector."
      );
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content =
        "Find answers to frequently asked questions about EventLink - the premier platform connecting event professionals with opportunities in the corporate events sector.";
      document.head.appendChild(meta);
    }
  }, []);

  const faqData = [
    {
      category: "Account & Registration",
      questions: [
        {
          id: "account-1",
          question: "How do I create an EventLink account?",
          answer:
            "You can sign up for free by clicking 'Sign Up' on the homepage. Choose whether you're a freelancer or an employer and fill in the required information.",
        },
        {
          id: "account-2",
          question: "Do I need to pay to use EventLink?",
          answer:
            "No. Creating a profile and applying for jobs are free. Premium features may be added later.",
        },
        {
          id: "account-3",
          question: "How do I reset my password?",
          answer:
            "On the login page, click 'Forgot Password' and follow the email instructions to reset it.",
        },
        {
          id: "account-4",
          question: "Can I delete my account?",
          answer:
            "Yes. Go to 'Account Settings' and select 'Delete Account.' This permanently removes all your data.",
        },
      ],
    },
    {
      category: "Jobs & Applications",
      questions: [
        {
          id: "jobs-1",
          question: "How do I post a job?",
          answer:
            "Employers can post jobs by clicking 'Post a New Job' in their dashboard or header menu.",
        },
        {
          id: "jobs-2",
          question: "Can freelancers apply for multiple jobs?",
          answer: "Yes. Freelancers can apply for as many suitable jobs as they like.",
        },
        {
          id: "jobs-3",
          question: "How do I know if my application was viewed?",
          answer: "You'll receive a dashboard notification when an employer views your profile.",
        },
        {
          id: "jobs-4",
          question: "Can I edit a job after posting?",
          answer: "Yes. Go to your 'My Jobs' section, select the job, and click 'Edit.'",
        },
      ],
    },
    {
      category: "Messaging & Notifications",
      questions: [
        {
          id: "messaging-1",
          question: "How do I contact an employer or freelancer?",
          answer: "You can message them directly from their profile or from your message inbox.",
        },
        {
          id: "messaging-2",
          question: "Will I get notifications for messages or job updates?",
          answer: "Yes. EventLink sends email notifications for key updates and unread messages.",
        },
      ],
    },
    {
      category: "Ratings & Feedback",
      questions: [
        {
          id: "ratings-1",
          question: "How does the star rating system work?",
          answer:
            "After a job is completed, employers can rate freelancers from 1 to 5 stars. Ratings appear on profiles.",
        },
        {
          id: "ratings-2",
          question: "Can I respond to a rating?",
          answer: "Not directly, but users can contact support if they believe a rating is unfair.",
        },
      ],
    },
    {
      category: "Privacy & Security",
      questions: [
        {
          id: "privacy-1",
          question: "How is my data protected?",
          answer:
            "EventLink uses encrypted connections (HTTPS) and complies with GDPR for all personal data.",
        },
        {
          id: "privacy-2",
          question: "Who can see my profile?",
          answer:
            "Employers and Freelancers can view freelancer profiles; freelancers can view employer job listings.",
        },
        {
          id: "privacy-3",
          question: "What should I do if I suspect a scam or fake job post?",
          answer: "Contact support via the 'Contact Us' page immediately.",
        },
      ],
    },
  ];

  // Generate JSON-LD structured data for FAQ rich snippets
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.flatMap(category =>
      category.questions.map(q => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.answer,
        },
      }))
    ),
  };

  useEffect(() => {
    // Add JSON-LD schema to page
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(faqSchema);
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      document.head.removeChild(script);
    };
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#D8690E] to-[#E97B24] mb-6">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#D8690E] to-[#E97B24] bg-clip-text text-transparent">
              Help Centre
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find answers to frequently asked questions about EventLink
            </p>
          </div>

          {/* FAQ Sections */}
          {faqData.map((section, idx) => (
            <div key={idx} className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1 h-8 bg-gradient-to-b from-[#D8690E] to-[#E97B24] rounded-full"></span>
                {section.category}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {section.questions.map(faq => (
                  <AccordionItem
                    key={faq.id}
                    value={faq.id}
                    className="bg-card border rounded-lg px-6 data-[state=open]:shadow-md transition-shadow"
                    data-testid={`faq-item-${faq.id}`}
                  >
                    <AccordionTrigger
                      className="hover:no-underline py-4 text-left font-semibold"
                      data-testid={`faq-trigger-${faq.id}`}
                    >
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent
                      className="text-muted-foreground pb-4"
                      data-testid={`faq-content-${faq.id}`}
                    >
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {/* Contact Support CTA */}
          <div className="mt-16 text-center p-8 bg-card border rounded-lg">
            <h3 className="text-2xl font-bold mb-3">Still have questions?</h3>
            <p className="text-muted-foreground mb-6">
              Can't find what you're looking for? Get in touch with our support team.
            </p>
            <a
              href="/contact-us"
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#D8690E] to-[#E97B24] text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
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
