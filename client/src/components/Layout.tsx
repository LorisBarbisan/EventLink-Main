import { useState } from "react";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const { user } = useOptimizedAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header onFeedbackClick={() => setShowFeedback(true)} />
      
      <main className="flex-1">
        {children}
      </main>

      <Footer />

      {/* Feedback Modal */}
      <FeedbackForm 
        open={showFeedback} 
        onOpenChange={setShowFeedback} 
      />
    </div>
  );
};