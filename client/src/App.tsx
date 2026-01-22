import { LiveNotificationPopups } from "@/components/LiveNotificationPopups";
import { TabNotificationManager } from "@/components/TabNotificationManager";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { useAnalytics } from "@/hooks/use-analytics";
import { AuthProvider } from "@/hooks/useAuth";
import { initGA } from "@/lib/analytics";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import AdminDashboard from "./pages/AdminDashboard";
import Auth from "./pages/Auth";
import ContactUs from "./pages/ContactUs";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import ForgotPassword from "./pages/ForgotPassword";
import Freelancers from "./pages/Freelancers";
import HowItWorks from "./pages/HowItWorks";
import Index from "./pages/Index";
import Jobs from "./pages/Jobs";
import NotFound from "./pages/NotFound";
import NotificationSettings from "./pages/NotificationSettings";
import Profile from "./pages/Profile";
import { RatingDashboard } from "./pages/RatingDashboard";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";

import { ScrollToTop } from "@/components/ScrollToTop";

// ... (other imports)

function AppRouter() {
  // Track page views when routes change
  useAnalytics();

  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/auth" component={Auth} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/:userId" component={Profile} />
        <Route path="/settings" component={Settings} />
        <Route path="/notification-settings" component={NotificationSettings} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/freelancers" component={Freelancers} />
        <Route path="/ratings" component={RatingDashboard} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/contact-us" component={ContactUs} />
        <Route path="/faq" component={FAQ} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn("Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID");
    } else {
      initGA();
      console.log(
        "✅ Google Analytics initialized with ID:",
        import.meta.env.VITE_GA_MEASUREMENT_ID
      );
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <LiveNotificationPopups />
            <TabNotificationManager />
            <AppRouter />
          </TooltipProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
