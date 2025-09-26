import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { OptimizedAuthProvider } from "@/hooks/useOptimizedAuth";
import { queryClient } from "@/lib/queryClient";
import { TabNotificationManager } from "@/components/TabNotificationManager";
import { LiveNotificationPopups } from "@/components/LiveNotificationPopups";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Jobs from "./pages/Jobs";
import Freelancers from "./pages/Freelancers";
import { RatingDashboard } from "./pages/RatingDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route path="/auth" component={Auth} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/freelancers" component={Freelancers} />
      <Route path="/ratings" component={RatingDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OptimizedAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <TabNotificationManager />
          <LiveNotificationPopups />
          <AppRouter />
        </TooltipProvider>
      </OptimizedAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
