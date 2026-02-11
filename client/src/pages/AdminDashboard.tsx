import { AdminGuard } from "@/components/AdminGuard";
import { Layout } from "@/components/Layout";
import { ModerationTable } from "@/components/ModerationTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabBadge } from "@/components/ui/tab-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { trackAdminAnalytics } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Briefcase,
  FileText,
  Mail,
  MessageSquare,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface FeedbackItem {
  id: number;
  feedback_type: "malfunction" | "feature-missing" | "suggestion" | "other";
  message: string;
  status: "pending" | "in_review" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  page_url?: string;
  source?: "header" | "popup";
  user_name?: string;
  user_email?: string;
  created_at: string;
  admin_response?: string;
  user?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "pending" | "replied" | "resolved";
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  role: "freelancer" | "recruiter" | "admin";
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  status: "pending" | "active" | "deactivated";
  auth_provider: string;
  created_at: string;
  last_login_at?: string;
  profile_status?: "no_profile" | "incomplete" | "complete";
}

interface UsersResponse {
  users: User[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

interface AnalyticsData {
  users: {
    total: number;
    freelancers: number;
    recruiters: number;
    verified: number;
    thisMonth: number;
  };
  jobs: {
    total: number;
    active: number;
    thisMonth: number;
  };
  applications: {
    total: number;
    applied: number;
    hired: number;
    thisMonth: number;
  };
  recentActivity: Array<{
    type: "feedback" | "user" | "application";
    message: string;
    time: string;
  }>;
}

function AdminDashboardContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  // const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [feedbackFilters, setFeedbackFilters] = useState({
    status: "all",
    type: "all",
  });

  // Contact message reply state
  const [selectedContactMessage, setSelectedContactMessage] = useState<ContactMessage | null>(null);
  const [contactReply, setContactReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Admin management state
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const [, setLocation] = useLocation();

  // Users Tab State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profileStatusFilter, setProfileStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Jobs Tab State
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [jobSortBy, setJobSortBy] = useState("created_at");
  const [jobSortOrder, setJobSortOrder] = useState<"asc" | "desc">("desc");
  const [jobCurrentPage, setJobCurrentPage] = useState(1);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      await apiRequest(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Status updated",
        description: "User status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  const { counts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
  });

  // Sync activeTab with URL hash for deep linking from notifications
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash.replace("#", "");
      const validTabs = ["overview", "users", "jobs", "feedback", "contact", "admin-management"];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(prev => (prev !== hash ? hash : prev));
      }
    };

    // Initial check
    handleHashSync();

    // Listen for both hashchange and popstate (wouter/back button)
    window.addEventListener("hashchange", handleHashSync);
    window.addEventListener("popstate", handleHashSync);

    return () => {
      window.removeEventListener("hashchange", handleHashSync);
      window.removeEventListener("popstate", handleHashSync);
    };
  }, []); // Run only on mount

  // Track Google Analytics when tab changes and update hash
  useEffect(() => {
    trackAdminAnalytics(activeTab);
    // Update URL hash when tab changes manually
    if (window.location.hash.replace("#", "") !== activeTab) {
      window.history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab]);

  // Analytics query
  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics/overview"],
    queryFn: () => apiRequest("/api/admin/analytics/overview"),
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Feedback query
  const {
    data: feedbackData,
    isLoading: feedbackLoading,
    refetch: refetchFeedback,
  } = useQuery({
    queryKey: ["/api/admin/feedback", feedbackFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feedbackFilters.status !== "all") params.append("status", feedbackFilters.status);
      if (feedbackFilters.type !== "all") params.append("type", feedbackFilters.type);

      return await apiRequest(`/api/admin/feedback?${params.toString()}`);
    },
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Feedback stats query
  const { data: feedbackStats } = useQuery({
    queryKey: ["/api/admin/feedback/stats"],
    queryFn: () => apiRequest("/api/admin/feedback/stats"),
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  // Users query
  const { data: usersData, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", currentPage, searchTerm, roleFilter, statusFilter, profileStatusFilter, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());
      if (searchTerm) params.append("search", searchTerm);
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (profileStatusFilter !== "all") params.append("profileStatus", profileStatusFilter);
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);
      return apiRequest(`/api/admin/users?${params.toString()}`);
    },
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });

  // Jobs query
  const { data: jobsData, isLoading: jobsLoading } = useQuery<{
    jobs: Array<{
      id: number;
      title: string;
      company: string;
      location: string;
      type: string;
      rate: string;
      status: string;
      external_source?: string | null;
      created_at: string;
      event_date?: string;
      end_date?: string;
      application_count: number;
      hired_count: number;
      recruiter_email?: string;
      recruiter_name?: string;
    }>;
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/admin/jobs", jobCurrentPage, jobSearch, jobStatusFilter, jobTypeFilter, jobSortBy, jobSortOrder],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("page", jobCurrentPage.toString());
      params.append("limit", itemsPerPage.toString());
      if (jobSearch) params.append("search", jobSearch);
      if (jobStatusFilter !== "all") params.append("status", jobStatusFilter);
      if (jobTypeFilter !== "all") params.append("type", jobTypeFilter);
      params.append("sortBy", jobSortBy);
      params.append("sortOrder", jobSortOrder);
      return apiRequest(`/api/admin/jobs?${params.toString()}`);
    },
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });

  // Admin users query
  const {
    data: adminUsers,
    isLoading: adminUsersLoading,
    refetch: refetchAdminUsers,
  } = useQuery({
    queryKey: ["/api/admin/users/admins"],
    queryFn: () => apiRequest("/api/admin/users/admins"),
    retry: 1,
  });

  // Users Tab State

  // Contact messages query
  const { data: contactMessages, isLoading: contactMessagesLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contact-messages"],
    queryFn: () => apiRequest("/api/admin/contact-messages"),
    retry: 1,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const totalPages = usersData?.totalPages || 1;
  const paginatedUsers = usersData?.users || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter, profileStatusFilter, sortBy, sortOrder]);

  useEffect(() => {
    setJobCurrentPage(1);
  }, [jobSearch, jobStatusFilter, jobTypeFilter, jobSortBy, jobSortOrder]);

  // Automatically mark notifications as read when the relevant tab is active
  useEffect(() => {
    // Trigger mark as read if we are on the tab AND there are pending notifications
    // counts is updated instantly by WebSocket context
    if (activeTab === "feedback" && (counts as any)?.feedback > 0) {
      markCategoryAsRead("feedback");
    } else if (activeTab === "contact" && (counts as any)?.contact_messages > 0) {
      markCategoryAsRead("contact_messages");
    }
  }, [activeTab, counts, user?.id, markCategoryAsRead]);

  const updateFeedbackStatus = async (id: number, status: string) => {
    try {
      await apiRequest(`/api/admin/feedback/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      toast({
        title: "Status Updated",
        description: "Feedback status has been updated successfully.",
      });

      refetchFeedback();
    } catch {
      toast({
        title: "Update Failed",
        description: "Failed to update feedback status.",
        variant: "destructive",
      });
    }
  };

  const submitAdminResponse = async (id: number) => {
    if (!adminResponse.trim()) return;

    try {
      await apiRequest(`/api/admin/feedback/${id}/response`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: adminResponse }),
      });

      toast({
        title: "Response Added",
        description: "Your response has been added to the feedback.",
      });

      setAdminResponse("");
      setSelectedFeedback(null);
      refetchFeedback();
    } catch {
      toast({
        title: "Response Failed",
        description: "Failed to add response to feedback.",
        variant: "destructive",
      });
    }
  };

  const submitContactReply = async (id: number) => {
    if (!contactReply.trim()) return;

    setIsSendingReply(true);
    try {
      console.log(`📧 Sending reply for message ID: ${id}`);
      console.log(`📧 Reply content: ${contactReply.substring(0, 50)}...`);

      const result = await apiRequest(`/api/admin/contact-messages/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: contactReply }),
      });

      console.log("✅ Reply sent successfully:", result);

      toast({
        title: "Reply Sent",
        description: "Your reply has been sent via email to the user.",
      });

      setContactReply("");
      setSelectedContactMessage(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
    } catch (error: any) {
      toast({
        title: "Reply Failed",
        description: error?.message || "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  // Bootstrap admin creation function
  const handleBootstrapAdmin = async () => {
    if (!user?.email) return;

    setIsBootstrapping(true);
    try {
      const result = await apiRequest("/api/admin/create-first-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      // Store JWT token and updated user data from bootstrap response
      if (result && result.token && result.user) {
        localStorage.setItem("auth_token", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));
      }

      toast({
        title: "Bootstrap Successful",
        description: "You have been granted admin privileges!",
      });

      // Invalidate and refetch admin users list to ensure immediate update
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users/admins"] });
      refetchAdminUsers();

      // Refresh the page to update authentication state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      toast({
        title: "Bootstrap Failed",
        description: error.response?.data?.error || "Failed to create first admin",
        variant: "destructive",
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "in_review":
        return "bg-blue-100 text-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFeedbackTypeLabel = (type: string) => {
    switch (type) {
      case "malfunction":
        return "Bug Report";
      case "feature-missing":
        return "Feature Request";
      case "suggestion":
        return "Suggestion";
      case "other":
        return "Other";
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage feedback, users, and monitor platform analytics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Feedback
            <TabBadge count={counts.feedback} />
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Moderation
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Contact
            <TabBadge count={counts.contact_messages} />
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="admin-management" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Admin Management
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.users?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{analytics?.users?.thisMonth || 0} this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.jobs?.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {analytics?.jobs?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Feedback</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feedbackStats?.pending || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {feedbackStats?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Applications</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.applications?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.applications?.hired || 0} hired
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.recentActivity?.map((activity, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          activity.type === "feedback"
                            ? "bg-blue-500"
                            : activity.type === "user"
                              ? "bg-green-500"
                              : "bg-purple-500"
                        }`}
                      ></div>
                      <span className="text-sm">{activity.message}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </span>
                  </div>
                ))}
                {(!analytics?.recentActivity || analytics.recentActivity.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Management Tab */}
        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <CardTitle>Feedback Management</CardTitle>
                <div className="flex gap-2">
                  <Select
                    value={feedbackFilters.status}
                    onValueChange={value =>
                      setFeedbackFilters(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={feedbackFilters.type}
                    onValueChange={value => setFeedbackFilters(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="malfunction">Bug Reports</SelectItem>
                      <SelectItem value="feature-missing">Feature Requests</SelectItem>
                      <SelectItem value="suggestion">Suggestions</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedbackLoading && !feedbackData ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackData?.feedback?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No feedback found matching your filters.
                    </div>
                  ) : (
                    feedbackData?.feedback?.map((item: FeedbackItem) => (
                      <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {getFeedbackTypeLabel(item.feedback_type)}
                              </Badge>
                              <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                              {item.priority === "high" && (
                                <Badge variant="destructive">High Priority</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From:{" "}
                              {item.user_name ||
                                item.user?.first_name ||
                                item.user_email ||
                                "Anonymous"}{" "}
                              •{new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Select onValueChange={value => updateFeedbackStatus(item.id, value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Update Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_review">In Review</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedFeedback(item)}
                                >
                                  Respond
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Respond to Feedback</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm font-medium mb-2">Original Message:</p>
                                    <p className="text-sm">{item.message}</p>
                                  </div>

                                  {item.admin_response && (
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                      <p className="text-sm font-medium mb-2">Previous Response:</p>
                                      <p className="text-sm">{item.admin_response}</p>
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Your Response:</label>
                                    <Textarea
                                      value={adminResponse}
                                      onChange={e => setAdminResponse(e.target.value)}
                                      placeholder="Enter your response to this feedback..."
                                      rows={4}
                                    />
                                  </div>

                                  <Button
                                    onClick={() => submitAdminResponse(item.id)}
                                    disabled={!adminResponse.trim()}
                                  >
                                    Send Response
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>

                        <p className="text-sm">{item.message}</p>

                        {item.page_url && (
                          <p className="text-xs text-muted-foreground">Page: {item.page_url}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review reported ratings and moderate content
              </p>
            </CardHeader>
            <CardContent>
              <ModerationTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Messages Tab */}
        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Messages</CardTitle>
              <p className="text-sm text-muted-foreground">
                Messages submitted through the Contact Us form
              </p>
            </CardHeader>
            <CardContent>
              {contactMessagesLoading && !contactMessages ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!contactMessages || contactMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No contact messages yet.
                    </div>
                  ) : (
                    contactMessages.map((message: ContactMessage) => (
                      <div
                        key={message.id}
                        className="border border-border rounded-lg p-4 space-y-3"
                        data-testid={`contact-message-${message.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{message.subject}</span>
                              <Badge
                                className={
                                  message.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : message.status === "replied"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                }
                              >
                                {message.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: {message.name} ({message.email}) •
                              {new Date(message.created_at).toLocaleDateString()} at{" "}
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        </div>

                        {message.ip_address && (
                          <p className="text-xs text-muted-foreground">IP: {message.ip_address}</p>
                        )}

                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedContactMessage(message)}
                                data-testid={`button-reply-${message.id}`}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Reply
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Reply to Contact Message</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                  <p className="text-sm font-medium mb-2">Original Message:</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    From: {message.name} ({message.email})
                                  </p>
                                  <p className="text-sm font-semibold mb-1">{message.subject}</p>
                                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Your Reply:</label>
                                  <Textarea
                                    value={contactReply}
                                    onChange={e => setContactReply(e.target.value)}
                                    placeholder="Enter your reply message here... This will be sent via email to the user."
                                    rows={6}
                                    data-testid="textarea-contact-reply"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Reply will be sent to: {message.email}
                                  </p>
                                </div>

                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setContactReply("");
                                      setSelectedContactMessage(null);
                                    }}
                                    disabled={isSendingReply}
                                    data-testid="button-cancel-reply"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => submitContactReply(message.id)}
                                    disabled={!contactReply.trim() || isSendingReply}
                                    data-testid="button-send-reply"
                                  >
                                    {isSendingReply ? "Sending..." : "Send Reply"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                All Jobs
                {jobsData && (
                  <Badge variant="secondary" className="ml-2">
                    {jobsData.total} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder="Search by title, company, or location..."
                        value={jobSearch}
                        onChange={e => setJobSearch(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="internal">EventLink</SelectItem>
                        <SelectItem value="external">External</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={jobSortBy} onValueChange={setJobSortBy}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Date Created</SelectItem>
                        <SelectItem value="title">Title</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={jobSortOrder} onValueChange={(v) => setJobSortOrder(v as "asc" | "desc")}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest</SelectItem>
                        <SelectItem value="asc">Oldest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Applications</TableHead>
                          <TableHead>Hired</TableHead>
                          <TableHead>Event Date</TableHead>
                          <TableHead>Posted By</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(jobsData?.jobs || []).length > 0 ? (
                          (jobsData?.jobs || []).map((job) => (
                            <TableRow key={job.id} className="h-10">
                              <TableCell className="py-2 font-medium max-w-[200px] truncate" title={job.title}>
                                {job.title}
                              </TableCell>
                              <TableCell className="py-2 max-w-[150px] truncate" title={job.company}>
                                {job.company}
                              </TableCell>
                              <TableCell className="py-2 max-w-[120px] truncate" title={job.location}>
                                {job.location}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge
                                  variant={
                                    job.status === "active"
                                      ? "default"
                                      : job.status === "paused"
                                        ? "secondary"
                                        : job.status === "closed"
                                          ? "destructive"
                                          : "outline"
                                  }
                                  className={
                                    job.status === "active"
                                      ? "bg-green-600 hover:bg-green-700"
                                      : ""
                                  }
                                >
                                  {job.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                {job.external_source ? (
                                  <Badge variant="outline" className="text-xs">
                                    {job.external_source}
                                  </Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs bg-orange-600 hover:bg-orange-700">
                                    EventLink
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <Badge variant="secondary">{job.application_count}</Badge>
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {job.hired_count > 0 ? (
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                    {job.hired_count}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-xs">
                                {job.event_date || "-"}
                                {job.end_date ? ` - ${job.end_date}` : ""}
                              </TableCell>
                              <TableCell className="py-2 text-xs max-w-[150px] truncate" title={job.recruiter_name || job.recruiter_email || "External"}>
                                {job.recruiter_name || job.recruiter_email || "External"}
                              </TableCell>
                              <TableCell className="py-2 text-xs">
                                {new Date(job.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={10} className="h-24 text-center">
                              No jobs found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {(jobsData?.totalPages || 1) > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setJobCurrentPage(prev => Math.max(prev - 1, 1))}
                            className={
                              jobCurrentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from({ length: jobsData?.totalPages || 1 }, (_, i) => i + 1).map(page => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setJobCurrentPage(page)}
                              isActive={jobCurrentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setJobCurrentPage(prev => Math.min(prev + 1, jobsData?.totalPages || 1))}
                            className={
                              jobCurrentPage === (jobsData?.totalPages || 1)
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                User Management {usersData?.total ? `(${usersData.total})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="freelancer">Freelancer</SelectItem>
                        <SelectItem value="recruiter">Employer</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="deactivated">Deactivated</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={profileStatusFilter} onValueChange={setProfileStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Profile status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Profiles</SelectItem>
                        <SelectItem value="no_profile">No Profile</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Joined Date</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="first_name">First Name</SelectItem>
                        <SelectItem value="last_name">Last Name</SelectItem>
                        <SelectItem value="role">Role</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Newest</SelectItem>
                        <SelectItem value="asc">Oldest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Profile</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Last Login</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.length > 0 ? (
                          paginatedUsers.map((rowUser: User) => (
                            <TableRow key={rowUser.id} className="h-10">
                              <TableCell className="py-2 font-medium">
                                {rowUser.first_name || rowUser.last_name
                                  ? `${rowUser.first_name || ""} ${rowUser.last_name || ""}`.trim()
                                  : "N/A"}
                              </TableCell>
                              <TableCell className="py-2">{rowUser.email}</TableCell>
                              <TableCell className="py-2">
                                <Badge variant={rowUser.role === "admin" ? "default" : "outline"}>
                                  {rowUser.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                {rowUser.role === "freelancer" ? (
                                  rowUser.profile_status === "complete" ? (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                      Complete
                                    </Badge>
                                  ) : rowUser.profile_status === "incomplete" ? (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                      Incomplete
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      No Profile
                                    </Badge>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                {rowUser.status === "active" ? (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <UserCheck className="w-4 h-4" />
                                    <span className="text-xs capitalize">{rowUser.status}</span>
                                  </div>
                                ) : rowUser.status === "pending" ? (
                                  <div className="flex items-center gap-1 text-yellow-600">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs capitalize">{rowUser.status}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {rowUser.status}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                {new Date(rowUser.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="py-2">
                                {rowUser.last_login_at
                                  ? new Date(rowUser.last_login_at).toLocaleString([], {
                                      year: "numeric",
                                      month: "numeric",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "Never"}
                              </TableCell>
                              <TableCell className="text-right py-2">
                                {rowUser.status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-auto"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        userId: rowUser.id,
                                        status: "deactivated",
                                      })
                                    }
                                    disabled={
                                      updateStatusMutation.isPending || rowUser.id === user?.id
                                    }
                                    title={
                                      rowUser.id === user?.id
                                        ? "You cannot deactivate your own account"
                                        : "Deactivate user"
                                    }
                                  >
                                    Deactivate
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        userId: rowUser.id,
                                        status: "active",
                                      })
                                    }
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    Activate
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                              No users found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Management Tab */}
        <TabsContent value="admin-management" className="space-y-6">
          {/* Bootstrap Admin Creation - Top Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                First Admin Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Need to create the first admin user?
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        exist yet, use this bootstrap button to make yourself the first admin. This
                        only works if you&apos;re logged in with a pre-approved email address.
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Current user:</strong> {user?.email || "Not logged in"}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleBootstrapAdmin}
                  data-testid="button-bootstrap-admin"
                  disabled={isBootstrapping || !user?.email}
                  className="w-full"
                  variant="outline"
                >
                  {isBootstrapping ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating First Admin...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Create First Admin ({user?.email || "No user"})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Admin Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Current Admin Users
                </span>
                {adminUsers && (
                  <Badge variant="secondary" data-testid="text-admin-count">
                    {adminUsers.length} {adminUsers.length === 1 ? "Admin" : "Admins"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminUsersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Loading admin users...</span>
                </div>
              ) : adminUsers && adminUsers.length > 0 ? (
                <div className="space-y-3">
                  {adminUsers.map((admin: User) => (
                    <div
                      key={admin.id}
                      data-testid={`card-admin-${admin.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-admin-email-${admin.id}`}>
                            {admin.email}
                          </p>
                          {(admin.first_name || admin.last_name) && (
                            <p className="text-sm text-muted-foreground">
                              {admin.first_name} {admin.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Admin</Badge>
                        <Badge variant="outline">{admin.auth_provider || "Email"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No admin users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <Layout>
        <AdminDashboardContent />
      </Layout>
    </AdminGuard>
  );
}
