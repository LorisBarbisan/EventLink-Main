import { FeedbackForm } from "@/components/FeedbackForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
  dark?: boolean;
}

export const Layout = ({ children, dark = false }: LayoutProps) => {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header onFeedbackClick={() => setShowFeedback(true)} dark={dark} />

      <main className="flex-1">{children}</main>

      <Footer dark={dark} />

      {/* Feedback Modal */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
    </div>
  );
};
