import { AdminGuard } from "@/components/AdminGuard";
import { ShareJobButton } from "@/components/ShareJobButton";
import { Layout } from "@/components/Layout";
import { ModerationTable } from "@/components/ModerationTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Briefcase,
  Check,
  Download,
  FileText,
  Mail,
  MessageSquare,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
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
  const [csvDownloading, setCsvDownloading] = useState(false);

  const handleDownloadCSV = async () => {
    setCsvDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/admin/export/xlsx", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `eventlink_admin_export_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not download export. Please try again.", variant: "destructive" });
    } finally {
      setCsvDownloading(false);
    }
  };
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

  // Bulk message state
  const [bulkMsgOpen, setBulkMsgOpen] = useState(false);
  const [bulkMsgText, setBulkMsgText] = useState("");
  const [bulkMsgSubject, setBulkMsgSubject] = useState("");
  const [bulkMsgMode, setBulkMsgMode] = useState<"filtered" | "specific">("filtered");
  const [bulkMsgPickerSearch, setBulkMsgPickerSearch] = useState("");
  const [bulkMsgSelectedUsers, setBulkMsgSelectedUsers] = useState<User[]>([]);

  // Jobs Tab State
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [jobSortBy, setJobSortBy] = useState("company");
  const [jobSortOrder, setJobSortOrder] = useState<"asc" | "desc">("desc");
  const [jobCurrentPage, setJobCurrentPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/admin/users/${userId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserToDelete(null);
      toast({ title: "Account removed", description: "The account has been permanently deleted." });
    },
    onError: () => {
      toast({ title: "Deletion failed", description: "Failed to remove the account.", variant: "destructive" });
    },
  });

  const bulkMessageMutation = useMutation({
    mutationFn: async ({ message, filters, userIds, emailSubject }: { message: string; filters?: object; userIds?: number[]; emailSubject?: string }) =>
      apiRequest("/api/admin/bulk-message", {
        method: "POST",
        body: JSON.stringify({ message, filters, userIds, emailSubject }),
      }),
    onSuccess: (data: { sent: number; failed: number; total: number }) => {
      setBulkMsgOpen(false);
      setBulkMsgText("");
      setBulkMsgSubject("");
      setBulkMsgSelectedUsers([]);
      setBulkMsgPickerSearch("");
      setBulkMsgMode("filtered");
      toast({
        title: "Messages sent",
        description: `Sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.`,
      });
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Could not send bulk messages. Please try again.", variant: "destructive" });
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

  // User picker query for bulk message "specific users" mode
  const { data: bulkMsgPickerData, isLoading: bulkMsgPickerLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users", "bulkpicker", bulkMsgPickerSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "30");
      if (bulkMsgPickerSearch.trim()) params.append("search", bulkMsgPickerSearch.trim());
      params.append("sortBy", "created_at");
      params.append("sortOrder", "desc");
      return apiRequest(`/api/admin/users?${params.toString()}`);
    },
    enabled: bulkMsgOpen && bulkMsgMode === "specific",
    staleTime: 10000,
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

  const { data: jobDetailData, isLoading: jobDetailLoading } = useQuery<{
    job: {
      id: number;
      title: string;
      company: string;
      location: string;
      type: string;
      rate: string;
      description: string;
      status: string;
      event_date?: string;
      end_date?: string;
      start_time?: string;
      end_time?: string;
      duration_type?: string;
      days?: number;
      hours?: number;
      external_source?: string | null;
      external_url?: string | null;
      created_at: string;
      updated_at: string;
      application_count: number;
      hired_count: number;
      recruiter_id?: number;
      recruiter_email?: string;
      recruiter_name?: string;
    };
    applications: Array<{
      id: number;
      freelancer_id: number;
      status: string;
      applied_at: string;
      freelancer_name: string;
      freelancer_email: string;
      freelancer_title?: string | null;
    }>;
  }>({
    queryKey: ["/api/admin/jobs", selectedJobId, "detail"],
    queryFn: () => apiRequest(`/api/admin/jobs/${selectedJobId}`),
    enabled: selectedJobId !== null,
    retry: 1,
  });

  // Send job alert emails mutation
  const sendAlertsMutation = useMutation({
    mutationFn: (jobId: number) =>
      apiRequest(`/api/admin/jobs/${jobId}/send-alerts`, { method: "POST" }),
    onSuccess: (data: any) => {
      toast({ title: "Alerts sent", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send alerts", variant: "destructive" });
    },
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
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage feedback, users, and monitor platform analytics
          </p>
        </div>
        <Button
          onClick={handleDownloadCSV}
          disabled={csvDownloading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 shrink-0 mt-1"
        >
          <Download className="w-4 h-4" />
          {csvDownloading ? "Exporting…" : "Download Excel"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full grid grid-cols-7 p-1">
          <TabsTrigger value="overview" className="flex items-center justify-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Feedback
            <TabBadge count={counts.feedback} />
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Moderation
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Contact
            <TabBadge count={counts.contact_messages} />
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center justify-center gap-2">
            <Briefcase className="w-4 h-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="admin-management" className="flex items-center justify-center gap-2">
            <UserCheck className="w-4 h-4" />
            Admin Management
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 min-[600px]:grid-cols-4 gap-3 sm:gap-6">
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 sm:p-6 pb-0 sm:pb-2">
                <Users className="h-4 w-4 text-muted-foreground block" />
                <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{analytics?.users?.total || 0}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                  +{analytics?.users?.thisMonth || 0} this month
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 sm:p-6 pb-0 sm:pb-2">
                <Briefcase className="h-4 w-4 text-muted-foreground block" />
                <CardTitle className="text-xs sm:text-sm font-medium">Active Jobs</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{analytics?.jobs?.active || 0}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                  of {analytics?.jobs?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 sm:p-6 pb-0 sm:pb-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground block" />
                <CardTitle className="text-xs sm:text-sm font-medium">Feedback</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{feedbackStats?.pending || 0}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                  {feedbackStats?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 sm:p-6 pb-0 sm:pb-2">
                <FileText className="h-4 w-4 text-muted-foreground block" />
                <CardTitle className="text-xs sm:text-sm font-medium">Applications</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{analytics?.applications?.total || 0}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
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
                      <div key={item.id} className="border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <Badge variant="outline" className="text-[10px] sm:text-xs">
                                {getFeedbackTypeLabel(item.feedback_type)}
                              </Badge>
                              <Badge className={cn("text-[10px] sm:text-xs", getStatusColor(item.status))}>
                                {item.status}
                              </Badge>
                              {item.priority === "high" && (
                                <Badge variant="destructive" className="text-[10px] sm:text-xs">High Priority</Badge>
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
                          <div className="flex flex-row sm:flex-row gap-2 w-full sm:w-auto">
                            <Select onValueChange={value => updateFeedbackStatus(item.id, value)}>
                              <SelectTrigger className="flex-1 sm:w-32 h-8 sm:h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Status" />
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
                                  className="flex-1 sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
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
                      </SelectContent>
                    </Select>

                    <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={jobSortBy} onValueChange={setJobSortBy}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Search by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="location">Location</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={jobSortOrder} onValueChange={(v) => setJobSortOrder(v as "asc" | "desc")}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Most Popular</SelectItem>
                        <SelectItem value="asc">Least Popular</SelectItem>
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
                          <TableHead>Applications</TableHead>
                          <TableHead>Hired</TableHead>
                          <TableHead>Event Date</TableHead>
                          <TableHead>Posted By</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(jobsData?.jobs || []).length > 0 ? (
                          (jobsData?.jobs || []).map((job) => (
                            <TableRow key={job.id} className="h-10 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedJobId(job.id)}>
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
                              <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                {job.status === "active" && (
                                  <div className="flex items-center gap-1">
                                    <ShareJobButton job={job as any} size="sm" variant="ghost" />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                                      disabled={sendAlertsMutation.isPending && sendAlertsMutation.variables === job.id}
                                      onClick={() => sendAlertsMutation.mutate(job.id)}
                                    >
                                      <Mail className="w-3 h-3 mr-1" />
                                      {sendAlertsMutation.isPending && sendAlertsMutation.variables === job.id ? "Sending..." : "Notify"}
                                    </Button>
                                  </div>
                                )}
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

                  <Dialog open={selectedJobId !== null} onOpenChange={(open) => { if (!open) setSelectedJobId(null); }}>
                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-xl">
                          {jobDetailLoading ? "Loading..." : jobDetailData?.job?.title || "Job Details"}
                        </DialogTitle>
                      </DialogHeader>
                      {jobDetailLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : jobDetailData ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Company</p>
                              <p className="font-medium">{jobDetailData.job.company}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Location</p>
                              <p className="font-medium">{jobDetailData.job.location}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Rate</p>
                              <p className="font-medium">{jobDetailData.job.rate}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Status</p>
                              <Badge
                                variant={jobDetailData.job.status === "active" ? "default" : jobDetailData.job.status === "paused" ? "secondary" : jobDetailData.job.status === "closed" ? "destructive" : "outline"}
                                className={jobDetailData.job.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {jobDetailData.job.status}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Event Date</p>
                              <p className="font-medium">
                                {jobDetailData.job.event_date || "Not set"}
                                {jobDetailData.job.end_date ? ` - ${jobDetailData.job.end_date}` : ""}
                              </p>
                            </div>
                            {jobDetailData.job.start_time && (
                              <div>
                                <p className="text-sm text-muted-foreground">Time</p>
                                <p className="font-medium">
                                  {jobDetailData.job.start_time}
                                  {jobDetailData.job.end_time ? ` - ${jobDetailData.job.end_time}` : ""}
                                </p>
                              </div>
                            )}
                            {jobDetailData.job.duration_type === "days" && jobDetailData.job.days && (
                              <div>
                                <p className="text-sm text-muted-foreground">Duration</p>
                                <p className="font-medium">{jobDetailData.job.days} days</p>
                              </div>
                            )}
                            {jobDetailData.job.duration_type === "hours" && jobDetailData.job.hours && (
                              <div>
                                <p className="text-sm text-muted-foreground">Duration</p>
                                <p className="font-medium">{jobDetailData.job.hours} hours</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-muted-foreground">Posted By</p>
                              <p className="font-medium">{jobDetailData.job.recruiter_name || "External"}</p>
                              {jobDetailData.job.recruiter_email && (
                                <p className="text-xs text-muted-foreground">
                                  {jobDetailData.job.recruiter_id ? (
                                    <a
                                      href={`/profile/${jobDetailData.job.recruiter_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      {jobDetailData.job.recruiter_email}
                                    </a>
                                  ) : (
                                    jobDetailData.job.recruiter_email
                                  )}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Created</p>
                              <p className="font-medium">{new Date(jobDetailData.job.created_at).toLocaleDateString()}</p>
                            </div>
                            {jobDetailData.job.external_source && (
                              <div>
                                <p className="text-sm text-muted-foreground">Source</p>
                                <p className="font-medium capitalize">{jobDetailData.job.external_source}</p>
                                {jobDetailData.job.external_url && (
                                  <a href={jobDetailData.job.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                    View original listing
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Description</p>
                            <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{jobDetailData.job.description}</p>
                          </div>

                          {jobDetailData.job.status === "active" && !jobDetailData.job.external_source && (
                            <div className="flex items-center gap-3 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium">Job Alert Emails</p>
                                <p className="text-xs text-muted-foreground">Send this job to all freelancers whose alert preferences match it.</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => sendAlertsMutation.mutate(jobDetailData.job.id)}
                                disabled={sendAlertsMutation.isPending}
                                className="bg-gradient-primary text-white hover:bg-primary-hover shrink-0"
                              >
                                {sendAlertsMutation.isPending ? "Sending..." : "Send Alerts"}
                              </Button>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="font-semibold">Applications</h3>
                              <Badge variant="secondary">{jobDetailData.job.application_count} total</Badge>
                              {jobDetailData.job.hired_count > 0 && (
                                <Badge className="bg-green-600 hover:bg-green-700">{jobDetailData.job.hired_count} hired</Badge>
                              )}
                            </div>
                            {jobDetailData.applications.length > 0 ? (
                              <div className="rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Freelancer</TableHead>
                                      <TableHead>Title</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Applied</TableHead>
                                      <TableHead>Profile</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {jobDetailData.applications.map((app) => (
                                      <TableRow key={app.id} className={app.status === "hired" ? "bg-green-50 dark:bg-green-950/20" : ""}>
                                        <TableCell className="py-2">
                                          <p className="font-medium text-sm">{app.freelancer_name}</p>
                                          <a
                                            href={`/profile/${app.freelancer_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {app.freelancer_email}
                                          </a>
                                        </TableCell>
                                        <TableCell className="py-2 text-sm">{app.freelancer_title || "-"}</TableCell>
                                        <TableCell className="py-2">
                                          <Badge
                                            variant={app.status === "hired" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}
                                            className={app.status === "hired" ? "bg-green-600 hover:bg-green-700" : ""}
                                          >
                                            {app.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="py-2 text-xs">
                                          {new Date(app.applied_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="py-2">
                                          <a
                                            href={`/profile/${app.freelancer_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline text-xs"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            View Profile
                                          </a>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No applications yet.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>
                  User Management {usersData?.total ? `(${usersData.total})` : ""}
                </CardTitle>
                <Dialog
                  open={bulkMsgOpen}
                  onOpenChange={open => {
                    setBulkMsgOpen(open);
                    if (!open) {
                      setBulkMsgText("");
                      setBulkMsgSubject("");
                      setBulkMsgMode("filtered");
                      setBulkMsgPickerSearch("");
                      setBulkMsgSelectedUsers([]);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                      Send Bulk Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Send Bulk Message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      {/* Mode toggle */}
                      <div className="flex rounded-md border overflow-hidden text-sm">
                        <button
                          type="button"
                          className={cn(
                            "flex-1 px-3 py-2 transition-colors",
                            bulkMsgMode === "filtered"
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          )}
                          onClick={() => setBulkMsgMode("filtered")}
                        >
                          All Filtered Users
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex-1 px-3 py-2 transition-colors border-l",
                            bulkMsgMode === "specific"
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-background hover:bg-muted text-muted-foreground"
                          )}
                          onClick={() => setBulkMsgMode("specific")}
                        >
                          Select Specific Users
                        </button>
                      </div>

                      {bulkMsgMode === "filtered" ? (
                        <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
                          <p className="font-medium text-muted-foreground">Recipients based on current filters:</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {roleFilter !== "all" && (
                              <Badge variant="secondary">Role: {roleFilter === "recruiter" ? "employer" : roleFilter}</Badge>
                            )}
                            {statusFilter !== "all" && (
                              <Badge variant="secondary">Status: {statusFilter}</Badge>
                            )}
                            {profileStatusFilter !== "all" && (
                              <Badge variant="secondary">Profile: {profileStatusFilter.replace("_", " ")}</Badge>
                            )}
                            {searchTerm && (
                              <Badge variant="secondary">Search: "{searchTerm}"</Badge>
                            )}
                            {roleFilter === "all" && statusFilter === "all" && profileStatusFilter === "all" && !searchTerm && (
                              <span className="text-muted-foreground">All non-admin users</span>
                            )}
                          </div>
                          <p className="text-muted-foreground pt-1">
                            Approx. <span className="font-semibold text-foreground">{usersData?.total ?? "..."}</span> user{(usersData?.total ?? 0) !== 1 ? "s" : ""} will receive this message. Admin accounts are excluded.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Selected users chips */}
                          {bulkMsgSelectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/40 p-2">
                              {bulkMsgSelectedUsers.map(u => {
                                const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
                                return (
                                  <span
                                    key={u.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-1 font-medium"
                                  >
                                    {name}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setBulkMsgSelectedUsers(prev => prev.filter(s => s.id !== u.id))
                                      }
                                      className="rounded-full hover:bg-primary/20 p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Search input */}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              placeholder="Search users by name or email..."
                              value={bulkMsgPickerSearch}
                              onChange={e => setBulkMsgPickerSearch(e.target.value)}
                              className="pl-8 h-8 text-sm"
                            />
                          </div>

                          {/* User list */}
                          <div className="border rounded-md overflow-y-auto max-h-44">
                            {bulkMsgPickerLoading ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                              </div>
                            ) : (bulkMsgPickerData?.users ?? []).filter(u => u.role !== "admin").length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                            ) : (
                              (bulkMsgPickerData?.users ?? [])
                                .filter(u => u.role !== "admin")
                                .map(u => {
                                  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
                                  const isSelected = bulkMsgSelectedUsers.some(s => s.id === u.id);
                                  return (
                                    <button
                                      key={u.id}
                                      type="button"
                                      onClick={() =>
                                        setBulkMsgSelectedUsers(prev =>
                                          isSelected ? prev.filter(s => s.id !== u.id) : [...prev, u]
                                        )
                                      }
                                      className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted transition-colors border-b last:border-b-0",
                                        isSelected && "bg-primary/5"
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {u.role === "recruiter" ? "employer" : u.role}
                                        </Badge>
                                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                                      </div>
                                    </button>
                                  );
                                })
                            )}
                          </div>

                          {bulkMsgSelectedUsers.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Select at least one user from the list above.
                            </p>
                          )}
                          {bulkMsgSelectedUsers.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{bulkMsgSelectedUsers.length}</span> user{bulkMsgSelectedUsers.length !== 1 ? "s" : ""} selected.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">
                          Email subject <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <Input
                          placeholder={`New message from EventLink`}
                          value={bulkMsgSubject}
                          onChange={e => setBulkMsgSubject(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave blank to use the default subject line.
                        </p>
                      </div>
                      <Textarea
                        placeholder="Write your message here..."
                        className="min-h-[120px] resize-none"
                        value={bulkMsgText}
                        onChange={e => setBulkMsgText(e.target.value)}
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setBulkMsgOpen(false);
                            setBulkMsgText("");
                            setBulkMsgSubject("");
                            setBulkMsgMode("filtered");
                            setBulkMsgPickerSearch("");
                            setBulkMsgSelectedUsers([]);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={
                            bulkMsgText.trim().length === 0 ||
                            bulkMessageMutation.isPending ||
                            (bulkMsgMode === "specific" && bulkMsgSelectedUsers.length === 0)
                          }
                          onClick={() => {
                            const emailSubject = bulkMsgSubject.trim() || undefined;
                            if (bulkMsgMode === "specific") {
                              bulkMessageMutation.mutate({
                                message: bulkMsgText,
                                userIds: bulkMsgSelectedUsers.map(u => u.id),
                                emailSubject,
                              });
                            } else {
                              bulkMessageMutation.mutate({
                                message: bulkMsgText,
                                emailSubject,
                                filters: {
                                  search: searchTerm || undefined,
                                  role: roleFilter,
                                  status: statusFilter,
                                  profileStatus: profileStatusFilter,
                                },
                              });
                            }
                          }}
                        >
                          {bulkMessageMutation.isPending ? "Sending..." : "Send Message"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="w-full md:max-w-sm">
                      <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 min-[450px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
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
                        <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
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
                        <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
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
                        <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
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

                      <Select value={sortOrder} onValueChange={v => setSortOrder(v as "asc" | "desc")}>
                        <SelectTrigger className="w-full h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Order" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Newest</SelectItem>
                          <SelectItem value="asc">Oldest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                              <TableCell className="py-2">
                                {rowUser.role !== "admin" ? (
                                  <a
                                    href={`/profile/${rowUser.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {rowUser.email}
                                  </a>
                                ) : (
                                  rowUser.email
                                )}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge variant={rowUser.role === "admin" ? "default" : "outline"}>
                                  {rowUser.role === "recruiter" ? "employer" : rowUser.role}
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
                                <div className="flex items-center justify-end gap-1">
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
                                  {rowUser.status !== "active" && rowUser.id !== user?.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                      onClick={() => setUserToDelete(rowUser)}
                                      title="Permanently remove account"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
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
                <Shield className="w-5 h-5 shrink-0" />
                <span>First Admin Setup</span>
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
                  <Badge variant="secondary" data-testid="text-admin-count" className="whitespace-nowrap shrink-0">
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
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex-shrink-0 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-admin-email-${admin.id}`} title={admin.email}>
                            {admin.email}
                          </p>
                          {(admin.first_name || admin.last_name) && (
                            <p className="text-sm text-muted-foreground truncate">
                              {admin.first_name} {admin.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="default" className="text-[10px] sm:text-xs">Admin</Badge>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">{admin.auth_provider || "Email"}</Badge>
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

      {/* Confirm permanent account deletion */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently remove account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will completely delete the account for{" "}
              <strong>{userToDelete?.first_name} {userToDelete?.last_name || userToDelete?.email}</strong>.
              All their data will be removed and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Removing…" : "Remove permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
