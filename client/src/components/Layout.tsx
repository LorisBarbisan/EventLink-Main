import { FeedbackForm } from "@/components/FeedbackForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
  dark?: boolean;
}

export const Layout = ({ children, dark = false }: LayoutProps) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onFeedbackClick={() => setShowFeedback(true)} dark={dark} />

      <main className="flex-1">{children}</main>

      <Footer dark={dark} />

      {/* Feedback Modal */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
    </div>
  );
};
