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
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch } from "wouter";

import { ScrollToTop } from "@/components/ScrollToTop";

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Freelancers = lazy(() => import("./pages/Freelancers"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Index = lazy(() => import("./pages/Index"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Jobs = lazy(() => import("./pages/Jobs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Profile = lazy(() => import("./pages/Profile"));
const RatingDashboard = lazy(() =>
  import("./pages/RatingDashboard").then((m) => ({ default: m.RatingDashboard }))
);
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const ReferencePage = lazy(() => import("./pages/ReferencePage"));
const ReferenceVerified = lazy(() => import("./pages/ReferenceVerified"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const PostApplication = lazy(() => import("./pages/PostApplication"));
const BuildReputation = lazy(() => import("./pages/BuildReputation"));
const MyBookings = lazy(() => import("./pages/employer/MyBookings"));
const MyJobs = lazy(() => import("./pages/freelancer/MyJobs"));
const AvailabilityResponse = lazy(() => import("./pages/AvailabilityResponse"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function AppRouter() {
  useAnalytics();

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/jobs/:id" component={JobDetail} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/freelancers" component={Freelancers} />
          <Route path="/ratings" component={RatingDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/contact-us" component={ContactUs} />
          <Route path="/faq" component={FAQ} />
          <Route path="/about" component={About} />
          <Route path="/reference/:token" component={ReferencePage} />
          <Route path="/reference-verified" component={ReferenceVerified} />
          <Route path="/unsubscribe" component={Unsubscribe} />
          <Route path="/application-success/:jobId" component={PostApplication} />
          <Route path="/build-reputation" component={BuildReputation} />
          <Route path="/employer/bookings" component={MyBookings} />
          <Route path="/freelancer/bookings" component={MyJobs} />
          <Route path="/availability/respond/:token" component={AvailabilityResponse} />
          <Route path="/availability/responded" component={AvailabilityResponse} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  useEffect(() => {
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
