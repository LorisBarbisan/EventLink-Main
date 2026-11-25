import { Button } from "@/components/ui/button";
import { ukToday } from "@shared/job-dates";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TabBadge } from "@/components/ui/tab-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import MyPostedJobs from "@/pages/freelancer/MyPostedJobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useHelpComplete } from "@/help/useHelp";
import { CredentialBacklogBanner } from "@/pages/CredentialBackfill";
import type { FreelancerFormData, JobApplication } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFreelancerJobs, type FreelancerJob } from "@/hooks/useFreelancerJobs";
import {
  AlertCircle,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Check,
  Clock,
  Copy,
  Download,
  Mail,
  MapPin,
  Pencil,
  Plus,
  PoundSterling,
  QrCode,
  Send,
  ExternalLink,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// Books is fetched only when it's about to be shown — behind the same
// useBooksAccess gate as the tab — so nobody who can't open it downloads it.
const BooksTab = lazy(() => import("./BooksTab").then((m) => ({ default: m.BooksTab })));
// On a phone: a small Books view instead of the desktop one
const BooksMobile = lazy(() => import("./BooksMobile").then((m) => ({ default: m.BooksMobile })));
import { useLocation } from "wouter";
import { ApplicationCard } from "./ApplicationCard";
import { JobDetailsDialog } from "./JobDetailsDialog";
import { BooksHiddenNotice } from "@/components/BooksRecordsNotice";
import { useBooksAccess } from "@/hooks/useBooksAccess";

import { MessagingInterface } from "./MessagingInterface";
import { ProfileForm } from "./ProfileForm";
import { BADGE_CONFIG, VerificationBadge } from "./ReferenceBadges";
import { VanityUrlEditor } from "./VanityUrlEditor";

type DashLogPaymentForm = {
  amount: string;
  datePaid: string;
  note: string;
};

function DashLogPaymentDialog({
  job,
  open,
  onClose,
}: {
  job: FreelancerJob;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = ukToday();
  const digits = (job.booking.agreedRate ?? "").match(/\d+(?:\.\d+)?/);

  const [form, setForm] = useState<DashLogPaymentForm>({
    amount: digits ? digits[0] : "",
    datePaid: today,
    note: "",
  });

  useEffect(() => {
    if (open) {
      const d = (job.booking.agreedRate ?? "").match(/\d+(?:\.\d+)?/);
      setForm({ amount: d ? d[0] : "", datePaid: today, note: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job.booking.id]);

  const set = (k: keyof DashLogPaymentForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const entryId = job.booking.earnings_entry_id;
      if (!entryId) throw new Error("No earnings entry");
      return apiRequest(`/api/earnings/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paid_date: form.datePaid,
          paid_amount_pence: Math.round(parseFloat(form.amount) * 100),
          ...(form.note.trim() ? { notes: form.note.trim() } : {}),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Payment logged", description: "Added to your earnings." });
      onClose();
    },
    onError: () => toast({ title: "Failed to log payment", variant: "destructive" }),
  });

  const valid = form.datePaid && parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log payment received</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {job.job.title}
            {job.employer.companyName ? ` · ${job.employer.companyName}` : ""}
            {job.job.eventDate
              ? ` · ${new Date(job.job.eventDate).toLocaleDateString("en-GB")}`
              : ""}
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="freelancerdashboard-amount-received-148">Amount received (£) *</Label>
            <Input
              id="freelancerdashboard-amount-received-148"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="freelancerdashboard-date-paid-159">Date paid *</Label>
            <Input
              id="freelancerdashboard-date-paid-159"
              type="date"
              value={form.datePaid}
              onChange={(e) => set("datePaid", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="freelancerdashboard-note-167">Note (optional)</Label>
            <Input
              id="freelancerdashboard-note-167"
              placeholder="e.g. invoice ref, bank transfer"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <PoundSterling className="mr-1 h-3 w-3" />
            Log payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HiredJobsSection() {
  const { data: jobs = [], isLoading } = useFreelancerJobs();
  const [logPaymentFor, setLogPaymentFor] = useState<FreelancerJob | null>(null);
  const [detailsJobId, setDetailsJobId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed", note: "Accepted by freelancer" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      toast({ title: "Enquiry accepted", description: "It's now a confirmed booking." });
    },
    onError: () => toast({ title: "Couldn't accept the enquiry", variant: "destructive" }),
  });
  const declineMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiRequest(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "cancelled",
          cancellationReason: "Declined by freelancer",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
      toast({ title: "Enquiry declined" });
    },
    onError: () => toast({ title: "Couldn't decline the enquiry", variant: "destructive" }),
  });

  if (isLoading)
    return <div className="py-8 text-center text-muted-foreground">Loading bookings…</div>;

  const enquiries = jobs.filter((j) => j.phase === "enquiry");
  const upcoming = jobs.filter((j) => j.phase === "upcoming");
  const awaitingPayment = jobs.filter((j) => j.phase === "awaiting_payment");
  const paid = jobs.filter((j) => j.phase === "paid");

  const renderJob = (hb: FreelancerJob) => (
    <div key={hb.booking.id} className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{hb.job.title}</h4>
            {hb.phase === "enquiry" && (
              <Badge className="bg-purple-600 text-xs text-white">
                <Clock className="mr-1 h-3 w-3" />
                Enquiry · needs your response
              </Badge>
            )}
            {hb.phase === "upcoming" && (
              <Badge className="bg-green-600 text-xs text-white">
                <CheckCircle className="mr-1 h-3 w-3" />
                Confirmed
              </Badge>
            )}
            {hb.phase === "awaiting_payment" && (
              <Badge className="bg-amber-500 text-xs text-white">
                <Clock className="mr-1 h-3 w-3" />
                Awaiting payment
              </Badge>
            )}
            {hb.phase === "paid" && (
              <Badge className="bg-blue-600 text-xs text-white">
                <CheckCircle className="mr-1 h-3 w-3" />
                Paid
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {hb.job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {hb.job.location}
              </span>
            )}
            {hb.job.eventDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(hb.job.eventDate).toLocaleDateString("en-GB")}
              </span>
            )}
            {hb.booking.agreedRate && (
              <span className="flex items-center gap-1">
                <Banknote className="h-3 w-3" />
                {hb.booking.agreedRate}
              </span>
            )}
          </div>
          {hb.employer.companyName && (
            <p className="mt-1 text-sm font-medium text-foreground">{hb.employer.companyName}</p>
          )}
        </div>
        {hb.phase === "paid" && (
          <span className="text-xs text-muted-foreground">Logged in Books</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setDetailsJobId(hb.job.id)}>
          View details
        </Button>
        {hb.phase === "enquiry" && (
          <>
            <Button
              size="sm"
              disabled={acceptMutation.isPending || declineMutation.isPending}
              onClick={() => acceptMutation.mutate(hb.booking.id)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={acceptMutation.isPending || declineMutation.isPending}
              onClick={() => declineMutation.mutate(hb.booking.id)}
            >
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <JobDetailsDialog
        jobId={detailsJobId}
        open={detailsJobId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailsJobId(null);
        }}
      />
      {logPaymentFor && (
        <DashLogPaymentDialog
          job={logPaymentFor}
          open={!!logPaymentFor}
          onClose={() => setLogPaymentFor(null)}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            My Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {jobs.length === 0 ? (
            <div className="py-8 text-center">
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No Bookings Yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When you get hired for jobs, they&apos;ll appear here as confirmed bookings.
              </p>
            </div>
          ) : (
            <>
              {enquiries.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-purple-600">
                    Enquiries · needs your response ({enquiries.length})
                  </p>
                  <div className="space-y-3">{enquiries.map(renderJob)}</div>
                </div>
              )}
              {awaitingPayment.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-amber-600">
                    Completed · Awaiting payment ({awaitingPayment.length})
                  </p>
                  <div className="space-y-3">{awaitingPayment.map(renderJob)}</div>
                </div>
              )}
              {upcoming.length > 0 && (
                <div>
                  {awaitingPayment.length > 0 && (
                    <p className="mb-3 text-sm font-medium text-muted-foreground">Upcoming</p>
                  )}
                  <div className="space-y-3">{upcoming.map(renderJob)}</div>
                </div>
              )}
              {paid.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-muted-foreground">
                    Paid ({paid.length})
                  </p>
                  <div className="space-y-3">{paid.map(renderJob)}</div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

const RATING_LABELS: Record<string, { label: string; stars: number }> = {
  excellent: { label: "Excellent", stars: 5 },
  good: { label: "Good", stars: 4 },
  mixed: { label: "Mixed", stars: 3 },
};

export default function SimplifiedFreelancerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get rating data for current user
  const { data: averageRating } = useFreelancerAverageRating(user?.id || 0);

  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showJobLinkModal, setShowJobLinkModal] = useState(false);
  const [jobLinkQr, setJobLinkQr] = useState<string>("");

  // Check URL parameters for initial tab and react to location changes
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const search = location.includes("?")
      ? location.split("?")[1]
      : window.location.search.replace(/^\?/, "");
    const urlParams = new URLSearchParams(search);
    const tabParam = urlParams.get("tab");
    if (tabParam) return tabParam;
    // Landing on the dashboard opens Books on its Overview, not the last section visited.
    if (!urlParams.get("section")) {
      try {
        sessionStorage.removeItem("booksTab.section");
      } catch {
        /* sessionStorage unavailable */
      }
    }
    // On a phone, land on Edit Profile → Card & Appearance; Books is for a computer
    if (window.innerWidth < 768) return "profile";
    return "books";
  });

  const completeHelpMain = useHelpComplete();

  // Track active conversation ID from URL
  const [activeConversationId, setActiveConversationId] = useState<number | null>(() => {
    const search = location.includes("?")
      ? location.split("?")[1]
      : window.location.search.replace(/^\?/, "");
    const urlParams = new URLSearchParams(search);
    const convParam =
      urlParams.get("conversation") ||
      urlParams.get("conversationId") ||
      urlParams.get("recipientId");
    return convParam ? parseInt(convParam, 10) : null;
  });

  // Handle URL parameter changes (e.g., from notifications)
  useEffect(() => {
    const handleSearchParams = () => {
      const search = window.location.search.replace(/^\?/, "");
      const urlParams = new URLSearchParams(search);
      const tabParam = urlParams.get("tab");
      if (tabParam && tabParam !== activeTab) {
        setActiveTab(tabParam);
      }

      // Update active conversation if present
      const convParam =
        urlParams.get("conversation") ||
        urlParams.get("conversationId") ||
        urlParams.get("recipientId");
      const newConvId = convParam ? parseInt(convParam, 10) : null;
      if (newConvId !== activeConversationId) {
        setActiveConversationId(newConvId);
      }
    };

    // Check on mount
    handleSearchParams();

    // Listen for navigation events
    const handlePopState = () => handleSearchParams();
    window.addEventListener("popstate", handlePopState);

    // Poll for search param changes since wouter might not trigger on them
    let lastSearch = window.location.search;
    const intervalId = setInterval(() => {
      if (window.location.search !== lastSearch) {
        lastSearch = window.location.search;
        handleSearchParams();
      }
    }, 100);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearInterval(intervalId);
    };
  }, [activeTab]);

  // Get badge counts for tabs
  const { roleSpecificCounts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
    refetchInterval: activeTab === "messages" ? 1000 : 1500, // Poll faster when on messages tab
  });

  // Fetch freelancer profile data
  // profileHasEverLoaded prevents "Loading profile..." from re-appearing during
  // re-fetches after invalidation, which would cause ProfileForm/CVParsingReview
  // to unmount/remount and trigger an infinite toast/request loop for new users.
  const profileHasEverLoaded = useRef(false);
  const { data: profile, isLoading: profileQueryLoading } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const data = await apiRequest(`/api/freelancer/${user.id}`);
      return data;
    },
    retry: false,
    enabled: !!user?.id,
  });
  if (!profileQueryLoading) profileHasEverLoaded.current = true;
  const booksAccess = useBooksAccess();
  const isMobile = useIsMobile();
  // Books is hidden outside the UK; don't leave those freelancers on an empty tab.
  useEffect(() => {
    if (activeTab === "books" && booksAccess === "unavailable") setActiveTab("profile");
  }, [activeTab, booksAccess]);
  const profileLoading = profileQueryLoading && !profileHasEverLoaded.current;

  const [profileIsPublic, setProfileIsPublic] = useState<boolean>(true);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  useEffect(() => {
    if (profile?.profile_is_public !== undefined) {
      setProfileIsPublic(!!profile.profile_is_public);
    }
  }, [profile?.profile_is_public]);

  const toggleProfilePrivacy = async () => {
    if (!user?.id) return;
    setTogglingPrivacy(true);
    const newValue = !profileIsPublic;
    try {
      await apiRequest(`/api/freelancer/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ profile_is_public: newValue }),
      });
      setProfileIsPublic(newValue);
      toast({
        title: newValue ? "Profile set to public" : "Profile set to private",
        description: newValue
          ? "Anyone can now view your CV and documents without logging in."
          : "Only signed-in employers can view your CV and documents.",
      });
    } catch {
      toast({ title: "Failed to update privacy setting", variant: "destructive" });
    } finally {
      setTogglingPrivacy(false);
    }
  };

  // Opt-in public calendar (profile + card). Off by default.
  const [showCalendar, setShowCalendar] = useState(false);
  const [togglingCalendar, setTogglingCalendar] = useState(false);
  useEffect(() => {
    const v = (profile as { show_calendar_publicly?: boolean } | undefined)?.show_calendar_publicly;
    if (v !== undefined) setShowCalendar(!!v);
  }, [profile]);
  const toggleShowCalendar = async () => {
    if (!user?.id) return;
    setTogglingCalendar(true);
    const next = !showCalendar;
    try {
      await apiRequest(`/api/freelancer/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ show_calendar_publicly: next }),
      });
      setShowCalendar(next);
      toast({
        title: next ? "Your calendar is now on your profile and card" : "Calendar hidden",
        description: next
          ? "Clients see which days you're free, tentative or busy for the next 90 days — never your notes, synced events or booking details. Days you're booked through EventLink show as busy. Mark days in the Calendar tab."
          : "Your profile and card no longer show your availability.",
      });
    } catch {
      toast({ title: "Failed to update the calendar setting", variant: "destructive" });
    } finally {
      setTogglingCalendar(false);
    }
  };

  // "Send me a job" direct offers. On by default.
  const [acceptsOffers, setAcceptsOffers] = useState(true);
  const [togglingOffers, setTogglingOffers] = useState(false);
  useEffect(() => {
    const v = (profile as { accepts_direct_offers?: boolean } | undefined)?.accepts_direct_offers;
    if (v !== undefined) setAcceptsOffers(!!v);
  }, [profile]);
  const toggleAcceptsOffers = async () => {
    if (!user?.id) return;
    setTogglingOffers(true);
    const next = !acceptsOffers;
    try {
      await apiRequest(`/api/freelancer/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ accepts_direct_offers: next }),
      });
      setAcceptsOffers(next);
      toast({
        title: next ? "Job link is on" : "Job link is off",
        description: next
          ? "Clients can send you a job directly through your link."
          : "Your 'Send me a job' link now shows as unavailable.",
      });
    } catch {
      toast({ title: "Failed to update the job link setting", variant: "destructive" });
    } finally {
      setTogglingOffers(false);
    }
  };

  // The public "Send me a job" slug, if the profile has one.
  const sendJobSlug =
    (profile as { custom_slug?: string | null; slug?: string | null } | undefined)?.custom_slug ||
    (profile as { custom_slug?: string | null; slug?: string | null } | undefined)?.slug ||
    null;
  useEffect(() => {
    if (!showJobLinkModal || !sendJobSlug) return;
    QRCode.toDataURL(`${window.location.origin}/send-job/${sendJobSlug}`, { width: 256 })
      .then(setJobLinkQr)
      .catch(() => setJobLinkQr(""));
  }, [showJobLinkModal, sendJobSlug]);

  const [cardShareUrl, setCardShareUrl] = useState("");

  useEffect(() => {
    if (!showQrModal || !user) return;
    apiRequest("/api/freelancer/card-token")
      .then((data: { token: string }) => {
        const url = `${window.location.origin}/card/${user.id}?pt=${encodeURIComponent(data.token)}`;
        setCardShareUrl(url);
        return QRCode.toDataURL(url, { width: 256 });
      })
      .then(setQrDataUrl);
  }, [showQrModal, user]);

  // Get user's job applications
  const { data: jobApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/freelancer/applications", user?.id],
    queryFn: async () => {
      return await apiRequest(`/api/freelancer/${user?.id}/applications`);
    },
    retry: false,
    enabled: !!user?.id,
  });

  // Fetch unread message count with optimized polling
  useQuery({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update URL to reflect tab change so polling doesn't revert it
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    // Remove conversation params when switching away from messages
    if (tab !== "messages") {
      url.searchParams.delete("conversation");
      url.searchParams.delete("conversationId");
      url.searchParams.delete("recipientId");
    }
    // A Books section only means something on the Books tab.
    if (tab !== "books") url.searchParams.delete("section");
    window.history.pushState({}, "", url.toString());

    // Mark category notifications as read when tab is opened
    // Note: Messages notifications are NOT marked as read automatically
    // They remain unread until user explicitly views/reads them
    if (tab === "jobs") {
      markCategoryAsRead("applications");
    } else if (tab === "bookings") {
      markCategoryAsRead("ratings");
      // Opening the Ratings tab counts as using it — stop prompting about it.
      completeHelpMain("dashboard.tab.pendingRatings");
    }
    // Removed: markCategoryAsRead('messages') - keep message notifications unread until user reads them
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  const getProfileUrl = (includeToken = false) => {
    const base = window.location.origin;
    const slug = profile?.custom_slug || profile?.slug;
    const path = slug ? `${base}/profile/${slug}` : `${base}/profile/${user.id}`;
    if (includeToken && (profile as any)?.reference_token) {
      return `${path}?pt=${encodeURIComponent((profile as any).reference_token)}`;
    }
    return path;
  };

  const handleShareProfile = async () => {
    try {
      await navigator.clipboard.writeText(getProfileUrl(true));
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Your profile link is in the clipboard." });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  // The public "Send me a job" link. Needs a slug; empty otherwise so the
  // button only shows when there's a legible slug to share.
  const getSendJobUrl = () =>
    sendJobSlug ? `${window.location.origin}/send-job/${sendJobSlug}` : "";

  // Simplified notification check
  return (
    <div className="container mx-auto min-w-0 max-w-full px-1 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 px-3 sm:px-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Freelancer Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage your profile, applications, and messages
        </p>
      </div>

      {/* Prompts the freelancer to date any certificates still missing an expiry */}
      <CredentialBacklogBanner />

      {/* Share bar */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Your public profile
            </p>
            <p className="truncate text-sm text-muted-foreground">{getProfileUrl()}</p>
          </div>
          <Button
            size="sm"
            data-help="action.profile.customizeUrl"
            onClick={() => setShowUrlEditor(true)}
            className="h-7 w-7 shrink-0 border-0 bg-primary/10 p-0 text-primary hover:bg-primary/20"
            title="Customize URL"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              id="profile-visibility-bar"
              checked={profileIsPublic}
              onCheckedChange={toggleProfilePrivacy}
              disabled={togglingPrivacy}
            />
            <label
              htmlFor="profile-visibility-bar"
              className="cursor-pointer select-none text-xs font-medium text-muted-foreground"
            >
              {profileIsPublic ? "Public" : "Private"}
            </label>
          </div>
          <div className="flex items-center gap-1.5" data-help="form.profile.showCalendar">
            <Switch
              id="show-calendar-bar"
              checked={showCalendar}
              onCheckedChange={toggleShowCalendar}
              disabled={togglingCalendar}
            />
            <label
              htmlFor="show-calendar-bar"
              className="cursor-pointer select-none text-xs font-medium text-muted-foreground"
            >
              Show calendar
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              id="accepts-offers-bar"
              data-help="action.profile.acceptsOffers"
              checked={acceptsOffers}
              onCheckedChange={toggleAcceptsOffers}
              disabled={togglingOffers}
            />
            <label
              htmlFor="accepts-offers-bar"
              className="cursor-pointer select-none text-xs font-medium text-muted-foreground"
            >
              Accept offers
            </label>
          </div>
          <Button
            size="sm"
            data-help="action.freelancer.postJob"
            onClick={() => {
              handleTabChange("posted-jobs");
              const url = new URL(window.location.href);
              url.searchParams.set("openForm", "1");
              window.history.replaceState({}, "", url.toString());
            }}
            className="bg-gradient-to-r from-[#7B5EA7] to-[#9B7DC7] text-white hover:from-[#6a4f94] hover:to-[#8a6cb6]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Post a Job
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-help="action.profile.shareLink"
            onClick={handleShareProfile}
            title="Copy profile link"
          >
            {linkCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600 sm:mr-1.5" />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Copy Link</span>
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-help="action.profile.cardQr"
            onClick={() => setShowQrModal(true)}
            title="Card QR code"
          >
            <QrCode className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Card QR</span>
          </Button>
          {sendJobSlug && (
            <Button
              size="sm"
              data-help="action.profile.sendJobLink"
              onClick={() => setShowJobLinkModal(true)}
              title="Your 'Send me a job' link"
              className="border-0 bg-orange-600 text-white hover:bg-orange-700"
            >
              <Send className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Send Me Jobs</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            data-help="action.profile.viewPublic"
            asChild
            title="View public profile"
          >
            <a href={getProfileUrl(true)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Profile</span>
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        {/* Mobile: prominent dropdown tab selector */}
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={handleTabChange}>
            <SelectTrigger className="h-12 w-full border-2 border-primary bg-primary/5 text-base font-semibold text-primary focus:ring-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {booksAccess !== "unavailable" && <SelectItem value="books">Books</SelectItem>}
              <SelectItem value="profile">Edit Profile</SelectItem>
              <SelectItem value="jobs">
                My Applications
                {(roleSpecificCounts.applications ?? 0) > 0
                  ? ` (${roleSpecificCounts.applications})`
                  : ""}
              </SelectItem>
              <SelectItem value="messages">
                Messages
                {(roleSpecificCounts.messages ?? 0) > 0 ? ` (${roleSpecificCounts.messages})` : ""}
              </SelectItem>
              <SelectItem value="bookings">
                Bookings
                {(roleSpecificCounts.ratings ?? 0) > 0 ? ` (${roleSpecificCounts.ratings})` : ""}
              </SelectItem>
              <SelectItem value="references">References</SelectItem>
              <SelectItem value="posted-jobs">My Jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TabsList className="hidden w-full grid-cols-4 sm:grid md:grid-cols-6">
          {booksAccess !== "unavailable" && (
            <TabsTrigger value="books" data-help="dashboard.tab.books">
              Books
            </TabsTrigger>
          )}
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
          <TabsTrigger
            value="jobs"
            className="gap-2"
            data-help="dashboard.tab.freelancerApplications"
          >
            My Applications
            <TabBadge count={roleSpecificCounts.applications || 0} />
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            Messages
            <TabBadge count={roleSpecificCounts.messages || 0} />
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2" data-help="dashboard.tab.pendingRatings">
            Bookings
            <TabBadge count={roleSpecificCounts.ratings || 0} />
          </TabsTrigger>
          <TabsTrigger value="references" className="gap-2" data-help="profile.references">
            <ShieldCheck className="h-4 w-4" />
            References
          </TabsTrigger>
          <TabsTrigger value="posted-jobs" data-help="dashboard.tab.freelancerPostedJobs">
            My Jobs
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          {booksAccess === "unavailable" && <BooksHiddenNotice />}
          {profileLoading ? (
            <div className="flex justify-center p-8">Loading profile...</div>
          ) : (
            <ProfileForm
              profile={profile}
              userType="freelancer"
              onSave={async (formData) => {
                try {
                  console.log("🚀 SAVE CLICKED! Saving freelancer profile data:", formData);

                  // Use the correct API endpoint for freelancer profiles
                  // Build update data excluding CV fields (managed separately by CV upload/delete)
                  const freelancerData = formData as FreelancerFormData;

                  const processedData: any = {
                    user_id: user.id,
                    first_name: freelancerData.first_name,
                    last_name: freelancerData.last_name,
                    title: freelancerData.title,
                    bio: freelancerData.bio,
                    superpower: freelancerData.superpower,
                    location: freelancerData.location,
                    country: freelancerData.country,
                    state_province: freelancerData.state_province,
                    skills: freelancerData.skills,
                    linkedin_url: freelancerData.linkedin_url,
                    website_url: freelancerData.website_url,
                    availability_status: freelancerData.availability_status,
                    profile_photo_url: freelancerData.profile_photo_url,
                    experience_years: freelancerData.experience_years
                      ? parseInt(freelancerData.experience_years.toString())
                      : undefined,
                    phone: freelancerData.phone ?? null,
                    contact_email: freelancerData.contact_email ?? null,
                    card_dark_mode: freelancerData.card_dark_mode ?? false,
                    profile_theme: freelancerData.profile_theme ?? null,
                  };
                  console.log("📤 Sending processed data (CV fields excluded):", processedData);

                  const savedProfile = await apiRequest(`/api/freelancer/${user.id}`, {
                    method: "PUT",
                    body: JSON.stringify(processedData),
                  });
                  console.log("✅ Profile saved successfully:", savedProfile);

                  // Force refetch to update UI with saved data
                  console.log("🔄 Forcing refetch for user:", user?.id);
                  await queryClient.refetchQueries({
                    queryKey: ["/api/freelancer/profile", user?.id],
                    exact: true,
                    type: "active",
                  });
                  console.log("🔄 Profile refetched with saved data!");

                  // Show success message with toast
                  toast({
                    title: "Profile saved successfully!",
                    description: "Your changes have been updated.",
                  });
                } catch (error) {
                  console.error("Error saving profile:", error);
                  toast({
                    title: "Failed to save profile",
                    description: `${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
                    variant: "destructive",
                  });
                }
              }}
              isSaving={false}
            />
          )}
        </TabsContent>

        {/* Jobs/Applications Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Job Applications</h2>
            <p className="text-muted-foreground">Track your application status and responses</p>
          </div>

          {/* Application Status Summary - Always show if there are applications */}
          {!applicationsLoading && jobApplications.length > 0 && (
            <Card data-testid="card-application-summary">
              <CardContent className="p-6">
                <h3 className="mb-4 font-medium">Application Summary</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "applied")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "reviewed")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "hired")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Hired</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "rejected")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Declined</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                      <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">{averageRating?.count || 0}</div>
                    <div className="text-sm text-muted-foreground">Ratings</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Applications List */}
          {applicationsLoading ? (
            <div className="flex justify-center p-8">Loading applications...</div>
          ) : jobApplications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No Applications Yet</h3>
                <p className="text-muted-foreground">
                  Start applying to jobs to see your applications here.
                </p>
              </CardContent>
            </Card>
          ) : (
            (() => {
              // Once hired or completed, the job lives in My Bookings — don't
              // also list it as an open application.
              const visible = jobApplications.filter(
                (a: JobApplication) => !["hired", "completed"].includes(a.status)
              );
              return visible.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No active applications. Jobs you were hired for have moved to{" "}
                    <span className="font-medium">My Bookings</span>.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {visible.map((application: JobApplication) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      userType="freelancer"
                      currentUserId={user.id}
                    />
                  ))}
                </div>
              );
            })()
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Messages</h2>
              <p className="text-muted-foreground">Create new connections and grow your network</p>
            </div>
          </div>
          {user && <MessagingInterface initialConversationId={activeConversationId} />}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <HiredJobsSection />
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="references" className="space-y-6">
          <ReferenceRequestsSection userId={user.id} />
        </TabsContent>

        {/* Books Tab */}
        {booksAccess !== "unavailable" && (
          <TabsContent value="books">
            {booksAccess === "needs-country" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
                <h3 className="mb-2 font-semibold text-amber-900 dark:text-amber-200">
                  Where are you based?
                </h3>
                <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">
                  The Books tab is available to UK freelancers. Add your country in your profile to
                  unlock it.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200"
                  onClick={() => setActiveTab("profile")}
                >
                  Go to Edit Profile
                </Button>
              </div>
            ) : booksAccess === "loading" ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <Suspense
                fallback={
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Loading your books…
                  </div>
                }
              >
                {isMobile ? <BooksMobile /> : <BooksTab />}
              </Suspense>
            )}
          </TabsContent>
        )}

        {/* Post a Job Tab */}
        <TabsContent value="posted-jobs">
          <MyPostedJobs />
        </TabsContent>
      </Tabs>

      <Dialog open={showUrlEditor} onOpenChange={setShowUrlEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-purple-600" />
              Customize your profile URL
            </DialogTitle>
          </DialogHeader>
          <VanityUrlEditor
            userId={user.id}
            currentCustomSlug={profile?.custom_slug}
            currentSlug={profile?.slug}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-purple-600" />
              Scan to view profile
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl ? (
              <a
                href={cardShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-help="action.profile.openCard"
                title="Click to open card"
              >
                <img
                  src={qrDataUrl}
                  alt="Profile QR code"
                  className="h-56 w-56 cursor-pointer rounded-lg transition-opacity hover:opacity-80"
                />
              </a>
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Generating...</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(cardShareUrl);
                  toast({ title: "Link copied!" });
                }}
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
              {qrDataUrl && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = qrDataUrl;
                    a.download = "eventlink-qr-code.png";
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showJobLinkModal} onOpenChange={setShowJobLinkModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-purple-600" />
              Your &ldquo;Send me a job&rdquo; link
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-center text-sm text-muted-foreground">
              Share this with a client who&rsquo;s just agreed work. They fill in a few fields and
              the job lands in your dashboard — no account needed.
            </p>
            {jobLinkQr ? (
              <img src={jobLinkQr} alt="Job link QR code" className="h-56 w-56 rounded-lg" />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Generating…</p>
              </div>
            )}
            <p className="w-full truncate rounded bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
              {getSendJobUrl()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(getSendJobUrl());
                  toast({ title: "Job link copied!" });
                }}
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
              {jobLinkQr && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = jobLinkQr;
                    a.download = "eventlink-job-link-qr.png";
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReferenceRequestsSection({ userId }: { userId: number }) {
  const { toast } = useToast();
  const completeHelp = useHelpComplete();
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data: referenceData, isLoading } = useQuery<{
    requests: any[];
    summary: { total: number; completed: number; pending: number };
  }>({
    queryKey: ["/api/references/requests"],
  });

  const { data: tokenData } = useQuery<{ token: string; url: string }>({
    queryKey: ["/api/references/my-token"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/references/requests", {
        method: "POST",
        body: JSON.stringify({
          referee_email: newEmail.trim(),
          referee_name: newName.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      completeHelp("profile.references");
      toast({ title: "Request sent", description: "Reference request email has been sent." });
      setNewEmail("");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to send request",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/references/requests/${id}/cancel`, { method: "PATCH" });
    },
    onSuccess: () => {
      toast({ title: "Cancelled", description: "Reference request has been cancelled." });
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/references/requests/${id}/remind`, { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Reminder sent", description: "A polite reminder has been sent." });
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Could not send reminder",
        variant: "destructive",
      });
    },
  });

  const { data: receivedRefs = [] } = useQuery<any[]>({
    queryKey: ["/api/references/freelancer", userId],
    queryFn: async () => {
      const res = await fetch(`/api/references/freelancer/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!userId,
  });

  const summary = referenceData?.summary || { total: 0, completed: 0, pending: 0 };
  const requests = referenceData?.requests || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My References</h2>
        <p className="text-muted-foreground">
          Request and track professional references from past employers
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Requests Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" />
            Send Reference Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label htmlFor="freelancerdashboard-referee-1214" className="text-sm">
                Referee&apos;s email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="freelancerdashboard-referee-1214"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. manager@company.com"
              />
            </div>
            <div>
              <Label htmlFor="freelancerdashboard-referee-1225" className="text-sm">
                Referee&apos;s name <span className="text-xs text-gray-400">(Optional)</span>
              </Label>
              <Input
                id="freelancerdashboard-referee-1225"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
              />
            </div>
            <Button
              onClick={() => createRequestMutation.mutate()}
              disabled={!newEmail.trim() || createRequestMutation.isPending}
              data-help="action.reference.request"
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
            >
              {createRequestMutation.isPending ? "Sending..." : "Send Reference Request"}
            </Button>
          </div>

          {tokenData?.url && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Or share your reference link directly:
              </p>
              <div className="flex gap-2">
                <Input readOnly value={tokenData.url} className="text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(tokenData.url);
                    toast({ title: "Copied!", description: "Reference link copied to clipboard." });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">Loading requests...</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No Reference Requests Yet</h3>
            <p className="text-muted-foreground">
              Send reference requests to previous employers to build your professional reputation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{req.referee_name || req.referee_email}</p>
                      {req.status === "completed" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {req.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {req.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <X className="h-3 w-3" /> Cancelled
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{req.referee_email}</p>
                    {req.reminder_sent && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Reminder sent</p>
                    )}
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      {!req.reminder_sent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reminderMutation.mutate(req.id)}
                          disabled={reminderMutation.isPending}
                        >
                          Remind
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate(req.id)}
                        disabled={cancelMutation.isPending}
                        className="text-red-500 hover:text-red-600"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Received References
        </h3>
        {receivedRefs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No references received yet. Send requests above to start building your reputation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {receivedRefs.map((ref: any) => {
              const badge = BADGE_CONFIG[ref.badge_result];
              const rating = RATING_LABELS[ref.q2_rating];
              return (
                <Card key={ref.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {ref.referee_organisation && (
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {ref.referee_organisation}
                            </span>
                          )}
                          {ref.referee_name && (
                            <span className="text-xs text-muted-foreground">
                              — {ref.referee_name}
                            </span>
                          )}
                        </div>
                        {ref.comment && (
                          <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">
                            &ldquo;{ref.comment}&rdquo;
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {badge && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.colour}`}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          )}
                          <VerificationBadge reference={ref} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: rating.stars }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            ))}
                            {Array.from({ length: 5 - rating.stars }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 text-gray-200" />
                            ))}
                          </div>
                        )}
                        {ref.created_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(ref.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
