// Single source of truth for the Help Centre / FAQ content.
//
// Imported by BOTH the client page (client/src/pages/FAQ.tsx) and the server
// crawler-prerender middleware (server/api/middleware/ogTags.ts) so the visible
// page, the FAQPage JSON-LD schema, and the bot-facing HTML can never drift.
//
// Answers are plain text so they can be serialised into JSON-LD. Where an answer
// needs an inline link, put the link in `answerLink`; its `text` must appear
// verbatim inside `answer`, and each renderer decides how to linkify it.

export interface FaqQuestion {
  id: string;
  question: string;
  /** Plain-text answer — used verbatim by the JSON-LD schema and crawler HTML. */
  answer: string;
  /** Optional inline link. `text` must be a substring of `answer` to be linkified. */
  answerLink?: { url: string; text: string };
}

export interface FaqCategory {
  category: string;
  questions: FaqQuestion[];
}

export const faqData: FaqCategory[] = [
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
          "Employers can post jobs by clicking 'Post a New Job' in their dashboard or header menu. Watch the tutorial for a step-by-step walkthrough.",
        answerLink: { url: "https://youtu.be/2JxKSwMq5hE", text: "Watch the tutorial" },
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

/** Builds the schema.org FAQPage JSON-LD object from the shared FAQ data. */
export function buildFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.flatMap((category) =>
      category.questions.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.answer,
        },
      }))
    ),
  };
}
