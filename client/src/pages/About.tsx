import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Info } from "lucide-react";

export default function About() {
  useEffect(() => {
    document.title = "About EventLink | Connecting Event Professionals";

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Learn about EventLink - a platform built to make finding and offering work in the events industry simpler, fairer, and more transparent."
      );
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content =
        "Learn about EventLink - a platform built to make finding and offering work in the events industry simpler, fairer, and more transparent.";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <div className="mb-12 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#D8690E] to-[#E97B24]">
              <Info className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-4 bg-gradient-to-r from-[#D8690E] to-[#E97B24] bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
              About EventLink
            </h1>
          </div>

          <div className="space-y-6 rounded-lg border bg-card p-8 text-lg leading-relaxed md:p-12">
            <p>
              EventLink was created to make finding and offering work in the events industry
              simpler, fairer, and more transparent.
            </p>

            <p>
              Built by people who have worked as freelancers and alongside freelance crews,
              EventLink exists to solve everyday challenges faced by technical professionals and
              event teams. The platform was designed with a clear understanding of how events
              actually operate — tight timelines, specialist roles, and the need for reliable,
              direct communication.
            </p>

            <p>
              For freelancers, EventLink provides a professional space to showcase skills,
              experience, and availability, receive relevant job alerts, and build a visible
              reputation through ratings. For employers and event teams, it offers a straightforward
              way to post roles, discover talent, and connect directly with the people they need to
              deliver successful events.
            </p>

            <p>
              Freelancing is a business, and most of the difficulty is in the parts nobody trained
              you for — knowing what you&apos;re owed, keeping track of what the work cost you, and
              getting to January with your records in order. EventLink keeps all of that alongside
              the work itself, free, because it is as much a part of making a living in this
              industry as finding the next job.
            </p>

            <p className="font-semibold text-foreground">
              EventLink is not an agency. It does not take a cut, mediate relationships, or restrict
              how people work. Freelancers remain fully independent, and employers retain complete
              control over their hiring decisions. The platform simply provides the tools to help
              both sides connect more efficiently.
            </p>

            <p>
              Our aim is to support a more open and trusted events industry — one where
              opportunities are easier to access, experience is recognised, and collaboration is
              built on clear information rather than closed networks.
            </p>

            <p>
              EventLink continues to evolve with input from the community it serves. Feedback from
              freelancers and event professionals plays a central role in shaping how the platform
              grows and improves over time.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
