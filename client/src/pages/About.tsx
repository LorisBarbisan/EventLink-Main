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
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#D8690E] to-[#E97B24] mb-6">
              <Info className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-[#D8690E] to-[#E97B24] bg-clip-text text-transparent">
              About EventLink
            </h1>
          </div>

          <div className="bg-card border rounded-lg p-8 md:p-12 space-y-6 text-lg leading-relaxed">
            <p>
              EventLink was created to make finding and offering work in the events industry simpler, fairer, and more transparent.
            </p>

            <p>
              Built by people who have worked as freelancers and alongside freelance crews, EventLink exists to solve everyday challenges faced by technical professionals and event teams. The platform was designed with a clear understanding of how corporate events actually operate — tight timelines, specialist roles, and the need for reliable, direct communication.
            </p>

            <p>
              For freelancers, EventLink provides a professional space to showcase skills, experience, and availability, receive relevant job alerts, and build a visible reputation through ratings. For employers and event teams, it offers a straightforward way to post roles, discover talent, and connect directly with the people they need to deliver successful events.
            </p>

            <p className="font-semibold text-foreground">
              EventLink is not an agency. It does not take a cut, mediate relationships, or restrict how people work. Freelancers remain fully independent, and employers retain complete control over their hiring decisions. The platform simply provides the tools to help both sides connect more efficiently.
            </p>

            <p>
              Our aim is to support a more open and trusted events industry — one where opportunities are easier to access, experience is recognised, and collaboration is built on clear information rather than closed networks.
            </p>

            <p>
              EventLink continues to evolve with input from the community it serves. Feedback from freelancers and event professionals plays a central role in shaping how the platform grows and improves over time.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
