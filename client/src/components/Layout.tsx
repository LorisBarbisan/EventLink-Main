import { FeedbackForm } from "@/components/FeedbackForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
  dark?: boolean;
}

export const Layout = ({ children, dark = false }: LayoutProps) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const { user } = useAuth();
  const isPro = useIsPro();
  // Pro freelancers get the dark navy header/footer across all pages
  const effectiveDark = dark || (user?.role === "freelancer" && isPro);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onFeedbackClick={() => setShowFeedback(true)} dark={effectiveDark} />

      <main className="flex-1">{children}</main>

      <Footer dark={effectiveDark} />

      {/* Feedback Modal */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
    </div>
  );
};
