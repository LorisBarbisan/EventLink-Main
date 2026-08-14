import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, CountrySelect } from "@/components/ui/country-select";
import { GlobalLocationInput } from "@/components/ui/global-location-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Banknote,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Jobs() {
  const { toast } = useToast();
  const { user: currentUser, loading: userLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Apply modal state
  const [applyModalJob, setApplyModalJob] = useState<any | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 10;

  // Initialize search state from URL parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [freelancerPostedFilter, setFreelancerPostedFilter] = useState(false);

  // Load initial search parameters from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSearch = urlParams.get("search") || "";
    const urlLocation = urlParams.get("location") || "";
    const urlCountry = urlParams.get("country") || "";
    const urlPage = parseInt(urlParams.get("page") || "1");
    // Check for jobId to auto-expand
    const urlJobId = urlParams.get("jobId");

    setSearchQuery(urlSearch);
    setLocationFilter(urlLocation);
    setCountryFilter(urlCountry);
    setCurrentPage(urlPage);

    if (urlJobId) {
      setExpandedJobId(urlJobId);
      // Optional: scroll to the job card once loaded - requires refs, skipping for now as expansion is main goal
    }
  }, []);

  // Update URL when search parameters change
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (searchQuery) urlParams.set("search", searchQuery);
    if (locationFilter) urlParams.set("location", locationFilter);
    if (countryFilter) urlParams.set("country", countryFilter);

    if (currentPage > 1) urlParams.set("page", currentPage.toString());
    // Persist expanded job ID in URL
    if (expandedJobId) urlParams.set("jobId", expandedJobId);

    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);

    // Scroll to top when page changes
    window.scrollTo(0, 0);
  }, [searchQuery, locationFilter, countryFilter, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationFilter, countryFilter]);

  // Update URL when expansion changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (expandedJobId) {
      urlParams.set("jobId", expandedJobId);
    } else {
      urlParams.delete("jobId");
    }
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [expandedJobId]);

  // Fetch real jobs data from API with server-side filtering
  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/jobs", searchQuery, locationFilter, countryFilter],
    queryFn: () => {
      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      if (searchQuery) params.set("keyword", searchQuery);
      if (locationFilter) params.set("location", locationFilter);
      if (countryFilter) params.set("country", countryFilter);

      const queryString = params.toString();
      const url = queryString ? `/api/jobs?${queryString}` : "/api/jobs";

      console.log("🔄 Fetching jobs with filters:", url);
      return apiRequest(url);
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Log whenever jobs data changes
  useEffect(() => {
    console.log(`📊 Jobs data updated! Found ${jobs?.length || 0} jobs`);
  }, [jobs]);

  // Auto-sync external jobs when page loads
  useEffect(() => {
    const autoSync = async () => {
      try {
        console.log("🔄 Auto-syncing external jobs on page load...");
        await apiRequest("/api/jobs/sync-external", {
          method: "POST",
        });
        // Refresh jobs after sync
        await refetch();
        console.log("✅ Auto-sync completed successfully");
      } catch (error) {
        console.warn("⚠️ Auto-sync failed:", error);
        // Don't show error toast for automatic sync - silent fail
      }
    };

    // Only auto-sync if we haven't synced recently
    const lastSync = localStorage.getItem("lastJobSync");
    const now = Date.now();
    const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

    if (!lastSync || now - parseInt(lastSync) > SYNC_INTERVAL) {
      autoSync();
      localStorage.setItem("lastJobSync", now.toString());
    }
  }, [refetch]);

  // Current user is now available from useAuth hook
  console.log("Current user from useAuth:", currentUser);

  // Manual refresh: re-triggers the external job sync on demand, bypassing
  // the 30-minute localStorage throttle used for the automatic on-mount sync.
  const refreshJobsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/jobs/sync-external", { method: "POST" });
    },
    onSuccess: async (result: { newJobsAdded?: number; errors?: string[] }) => {
      await refetch();
      if (result?.errors?.length) {
        toast({
          title: "Refresh completed with issues",
          description: result.errors.join("; "),
          variant: "destructive",
        });
      } else {
        const added = result?.newJobsAdded ?? 0;
        toast({
          title: "Jobs refreshed",
          description:
            added > 0 ? `${added} new job${added !== 1 ? "s" : ""} added.` : "No new jobs found.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Refresh failed",
        description: error?.message || "Failed to refresh jobs.",
        variant: "destructive",
      });
    },
  });

  // Job application mutation
  const applyToJobMutation = useMutation({
    mutationFn: async ({ jobId, note }: { jobId: number; note: string }) => {
      if (!currentUser?.id) throw new Error("Please log in to apply for jobs");
      return await apiRequest(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        body: JSON.stringify({ cover_letter: note || undefined }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/freelancer/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setApplyModalJob(null);
      setCoverLetter("");
      setLocation(`/application-success/${jobId}`);
    },
    onError: (error: any) => {
      if (error.message.includes("log in")) {
        toast({
          title: "Authentication required",
          description: "Please log in to apply for jobs.",
          variant: "destructive",
        });
        setLocation("/auth");
      } else if (error.message.includes("create a profile") || error.code === "NO_PROFILE") {
        toast({
          title: "Profile required",
          description: "You need to create your profile before applying for jobs.",
          variant: "destructive",
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Application failed",
          description: error.message || "Failed to submit job application.",
          variant: "destructive",
        });
      }
    },
  });

  const handleApplyNow = (job: any) => {
    if (job.external_url) {
      window.open(job.external_url, "_blank");
      return;
    }
    if (userLoading) {
      toast({ title: "Please wait", description: "Loading user information..." });
      return;
    }
    if (!currentUser || !currentUser.id) {
      toast({
        title: "Login required",
        description: "Please log in to apply for jobs.",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }
    // Open the apply modal
    setApplyModalJob(job);
    setCoverLetter("");
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

  // Transform jobs for consistent format
  const transformedJobs = jobs.map((job: any) => ({
    ...job,
    posted: job.created_at ? new Date(job.created_at).toLocaleDateString() : "Recently posted",
  }));

  // Server-side filtering handles search, location, and date; client-side for freelancer toggle
  const filteredJobs = freelancerPostedFilter
    ? transformedJobs.filter((job: any) => job.is_freelancer_posted)
    : transformedJobs;

  const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
  const startIndex = (currentPage - 1) * jobsPerPage;
  const endIndex = startIndex + jobsPerPage;
  const currentJobs = filteredJobs.slice(startIndex, endIndex);

  const renderPaginationControls = () =>
    totalPages > 1 && (
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of{" "}
          {filteredJobs.length} jobs
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          {/* Page Numbers */}
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (pageNum) =>
                  pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1
              )
              .map((pageNum, index, array) => (
                <div key={pageNum} className="flex items-center">
                  {index > 0 && array[index - 1] !== pageNum - 1 && (
                    <span className="px-2 text-muted-foreground">...</span>
                  )}
                  <Button
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                </div>
              ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
            <span className="text-primary">Find</span> <span className="text-accent">Jobs</span>
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Discover exciting opportunities in the events industry. Connect with top companies
            looking for technical crew.
          </p>
        </div>

        {/* Post-a-Job CTA — shown to guests and freelancers */}
        {(!currentUser || currentUser.role !== "recruiter") && (
          <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-foreground">Hiring for an event?</p>
              <p className="text-sm text-muted-foreground">
                Post a job in minutes — no account required.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href="/post-job">
                <Briefcase className="mr-2 h-4 w-4" />
                Post a Job
              </a>
            </Button>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search & Filter Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Input
                    placeholder="Search jobs, companies, or skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="input-search-jobs"
                  />
                </div>
                <div>
                  <CountrySelect
                    value={countryFilter}
                    onChange={setCountryFilter}
                    placeholder="All countries"
                  />
                </div>
                <div>
                  <GlobalLocationInput
                    placeholder="Filter by location..."
                    value={locationFilter}
                    onChange={(value) => setLocationFilter(value)}
                    countryCode={COUNTRIES.find((c) => c.name === countryFilter)?.code}
                    data-testid="input-location-filter"
                  />
                </div>
              </div>

              {/* Freelancer-posted toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={freelancerPostedFilter}
                  onClick={() => {
                    setFreelancerPostedFilter((v) => !v);
                    setCurrentPage(1);
                  }}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                    freelancerPostedFilter ? "bg-[#7B5EA7]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                      freelancerPostedFilter ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">Posted by Freelancers only</span>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || locationFilter || countryFilter || freelancerPostedFilter) && (
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setLocationFilter("");
                      setCountryFilter("");
                      setFreelancerPostedFilter(false);
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Jobs List */}
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold sm:text-2xl">
              {filteredJobs.length} Job{filteredJobs.length !== 1 ? "s" : ""} Found
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshJobsMutation.mutate()}
              disabled={refreshJobsMutation.isPending}
              className="flex items-center gap-2"
              data-testid="button-refresh-jobs"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshJobsMutation.isPending ? "animate-spin" : ""}`}
              />
              {refreshJobsMutation.isPending ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Pagination Controls (top) */}
          {renderPaginationControls()}

          {/* No Results Message */}
          {filteredJobs.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No jobs match your search</h3>
                <p className="mb-4 text-muted-foreground">
                  Try adjusting your search criteria or removing some filters.
                </p>
                {(searchQuery || locationFilter || countryFilter) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setLocationFilter("");
                      setCountryFilter("");
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job Cards */}
          {filteredJobs.length > 0 &&
            (() => {
              return (
                <>
                  {/* Job Cards */}
                  {currentJobs.map((job: any) => (
                    <Card
                      key={job.id}
                      className={`border-l-4 transition-shadow ${job.status === "closed" ? "border-l-muted opacity-70" : !job.external_source ? "border-l-primary hover:shadow-lg" : "border-l-muted hover:shadow-lg"}`}
                    >
                      <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <CardTitle className="text-lg sm:text-xl">{job.title}</CardTitle>
                            {job.is_freelancer_posted && job.posted_by_user_id ? (
                              <button
                                onClick={() =>
                                  window.open(`/profile/${job.posted_by_user_id}`, "_blank")
                                }
                                className="cursor-pointer text-left font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
                                data-testid={`link-company-${job.id}`}
                              >
                                {job.company}
                              </button>
                            ) : job.recruiter_id && !job.external_source ? (
                              <button
                                onClick={() =>
                                  window.open(`/profile/${job.recruiter_id}`, "_blank")
                                }
                                className="cursor-pointer text-left font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
                                data-testid={`link-company-${job.id}`}
                              >
                                {job.company}
                              </button>
                            ) : (
                              <p className="font-medium text-muted-foreground">{job.company}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            {job.status === "closed" ? (
                              <Badge
                                variant="outline"
                                className="border-muted-foreground/40 text-xs text-muted-foreground"
                              >
                                Closed
                              </Badge>
                            ) : job.is_freelancer_posted ? (
                              <Badge className="bg-gradient-to-r from-[#7B5EA7] to-[#9B7DC7] font-semibold text-white">
                                Posted by Freelancer
                              </Badge>
                            ) : !job.external_source ? (
                              <Badge className="bg-gradient-to-r from-[#D8690E] to-[#E97B24] font-semibold text-white">
                                EventLink Opportunity
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                External • {job.external_source}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-muted-foreground">{job.description}</p>

                          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {[(job as any).location, (job as any).country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Banknote className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {(job as any).currency && (job as any).currency !== "GBP"
                                  ? `${(job as any).currency} `
                                  : ""}
                                {job.rate}
                              </span>
                            </div>
                            {job.event_date && (
                              <div className="flex items-center gap-2 font-medium text-primary">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                <span>
                                  {new Date(job.event_date).toLocaleDateString()}
                                  {job.end_date &&
                                    ` - ${new Date(job.end_date).toLocaleDateString()}`}
                                </span>
                              </div>
                            )}
                            {(job.start_time || job.end_time) && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {job.start_time && job.end_time
                                    ? `${job.start_time} - ${job.end_time}`
                                    : job.start_time || job.end_time}
                                </span>
                              </div>
                            )}
                            {job.duration_type === "days" && job.days && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {job.days} day{job.days !== 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                            {job.duration_type === "hours" && job.hours && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {job.hours} hour{job.hours !== 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Expanded details - shown when expanded */}
                          {expandedJobId === job.id.toString() && (
                            <div className="space-y-4 border-t pt-4">
                              {job.contract_type && (
                                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span>Contract Type: {job.contract_type}</span>
                                  </div>
                                  {job.duration && (
                                    <div className="flex items-center gap-2">
                                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                      <span>Duration: {job.duration}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Additional job details */}
                              <div>
                                <h4 className="mb-2 font-medium">Full Description:</h4>
                                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                  {job.description}
                                </p>
                              </div>

                              {job.skills && job.skills.length > 0 && (
                                <div>
                                  <h4 className="mb-2 font-medium">Required Skills:</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {job.skills.map((skill: string, index: number) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-3 pt-4">
                            {job.status === "closed" ? (
                              <Button
                                disabled
                                variant="outline"
                                className="cursor-not-allowed opacity-50"
                              >
                                Applications Closed
                              </Button>
                            ) : job.external_url ? (
                              <Button
                                asChild
                                className="bg-gradient-primary hover:bg-primary-hover"
                              >
                                <a
                                  href={job.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Find out more
                                </a>
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleApplyNow(job)}
                                disabled={applyToJobMutation.isPending}
                                className="bg-gradient-primary hover:bg-primary-hover"
                                data-testid={`button-apply-${job.id}`}
                              >
                                {applyToJobMutation.isPending ? "Applying..." : "Apply Now"}
                              </Button>
                            )}
                            {!job.external_source && (
                              <Button
                                variant="outline"
                                onClick={() => toggleJobExpansion(job.id.toString())}
                                data-testid={`button-expand-${job.id}`}
                              >
                                {expandedJobId === job.id.toString() ? (
                                  <ChevronUp className="mr-1 h-4 w-4" />
                                ) : (
                                  <ChevronDown className="mr-1 h-4 w-4" />
                                )}
                                {expandedJobId === job.id.toString()
                                  ? "Less Details"
                                  : "More Details"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination Controls (bottom) */}
                  <div className="pt-6">{renderPaginationControls()}</div>
                </>
              );
            })()}
        </div>
      </div>
      {/* Apply modal */}
      <Dialog
        open={!!applyModalJob}
        onOpenChange={(open) => {
          if (!open) {
            setApplyModalJob(null);
            setCoverLetter("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for this job</DialogTitle>
            <DialogDescription className="truncate">{applyModalJob?.title}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              placeholder="Add a short note to the employer — introduce yourself, highlight relevant experience, or ask a question..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {coverLetter.length}/1000
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setApplyModalJob(null);
                setCoverLetter("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                applyToJobMutation.mutate({ jobId: applyModalJob.id, note: coverLetter })
              }
              disabled={applyToJobMutation.isPending}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {applyToJobMutation.isPending ? "Sending..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
