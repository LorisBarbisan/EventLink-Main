import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  PoundSterling,
  Filter,
  MapPin,
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
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Control popover states to prevent overlapping
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);

  // Load initial search parameters from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSearch = urlParams.get("search") || "";
    const urlLocation = urlParams.get("location") || "";
    const urlDateFrom = urlParams.get("date_from") || "";
    const urlDateTo = urlParams.get("date_to") || "";
    const urlPage = parseInt(urlParams.get("page") || "1");
    // Check for jobId to auto-expand
    const urlJobId = urlParams.get("jobId");

    setSearchQuery(urlSearch);
    setLocationFilter(urlLocation);
    if (urlDateFrom) setDateFrom(new Date(urlDateFrom));
    if (urlDateTo) setDateTo(new Date(urlDateTo));
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
    if (dateFrom) urlParams.set("date_from", format(dateFrom, "yyyy-MM-dd"));
    if (dateTo) urlParams.set("date_to", format(dateTo, "yyyy-MM-dd"));

    if (currentPage > 1) urlParams.set("page", currentPage.toString());
    // Persist expanded job ID in URL
    if (expandedJobId) urlParams.set("jobId", expandedJobId);

    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);

    // Scroll to top when page changes
    window.scrollTo(0, 0);
  }, [searchQuery, locationFilter, dateFrom, dateTo, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationFilter, dateFrom, dateTo]);

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
    queryKey: ["/api/jobs", searchQuery, locationFilter, dateFrom, dateTo],
    queryFn: () => {
      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      if (searchQuery) params.set("keyword", searchQuery);
      if (locationFilter) params.set("location", locationFilter);
      if (dateFrom) params.set("start_date", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) params.set("end_date", format(dateTo, "yyyy-MM-dd"));

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
      toast({ title: "Login required", description: "Please log in to apply for jobs.", variant: "destructive" });
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

  // Server-side filtering handles search, location, and date
  const filteredJobs = transformedJobs;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 sm:text-4xl">
            <span className="text-primary">Find</span> <span className="text-accent">Jobs</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Discover exciting opportunities in the events industry. Connect with top companies
            looking for technical crew.
          </p>
        </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="Search jobs, companies, or skills..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="input-search-jobs"
                  />
                </div>
                <div>
                  <UKLocationInput
                    placeholder="Filter by UK location..."
                    value={locationFilter}
                    onChange={value => setLocationFilter(value)}
                    data-testid="input-location-filter"
                  />
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Popover
                    open={fromDateOpen}
                    onOpenChange={open => {
                      setFromDateOpen(open);
                      if (open) setToDateOpen(false); // Close the other popover
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-date-from"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : "Event Date From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={date => {
                          setDateFrom(date);
                          setFromDateOpen(false); // Close popover after selection
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Popover
                    open={toDateOpen}
                    onOpenChange={open => {
                      setToDateOpen(open);
                      if (open) setFromDateOpen(false); // Close the other popover
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-date-to"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : "Event Date To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={date => {
                          setDateTo(date);
                          setToDateOpen(false); // Close popover after selection
                        }}
                        initialFocus
                        disabled={date => (dateFrom ? date < dateFrom : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || locationFilter || dateFrom || dateTo) && (
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setLocationFilter("");
                      setDateFrom(undefined);
                      setDateTo(undefined);
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4" />
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
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sort by: Most Recent</span>
              </div>
            </div>
          </div>

          {/* No Results Message */}
          {filteredJobs.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No jobs match your search</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search criteria or removing some filters.
                </p>
                {(searchQuery || locationFilter) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setLocationFilter("");
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pagination Logic */}
          {filteredJobs.length > 0 &&
            (() => {
              const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);
              const startIndex = (currentPage - 1) * jobsPerPage;
              const endIndex = startIndex + jobsPerPage;
              const currentJobs = filteredJobs.slice(startIndex, endIndex);

              return (
                <>
                  {/* Job Cards */}
                  {currentJobs.map((job: any) => (
                    <Card
                      key={job.id}
                      className={`transition-shadow border-l-4 ${job.status === "closed" ? "opacity-70 border-l-muted" : !job.external_source ? "hover:shadow-lg border-l-primary" : "hover:shadow-lg border-l-muted"}`}
                    >
                      <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <CardTitle className="text-lg sm:text-xl">{job.title}</CardTitle>
                            {job.recruiter_id && !job.external_source ? (
                              <button
                                onClick={() =>
                                  window.open(`/profile/${job.recruiter_id}`, "_blank")
                                }
                                className="text-muted-foreground font-medium hover:text-primary hover:underline cursor-pointer text-left transition-colors"
                                data-testid={`link-company-${job.id}`}
                              >
                                {job.company}
                              </button>
                            ) : (
                              <p className="text-muted-foreground font-medium">{job.company}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 items-start sm:items-end">
                            {job.status === "closed" ? (
                              <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/40">
                                Closed
                              </Badge>
                            ) : !job.external_source ? (
                              <Badge className="bg-gradient-to-r from-[#D8690E] to-[#E97B24] text-white font-semibold">
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

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{job.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <PoundSterling className="h-4 w-4 text-muted-foreground" />
                              <span>{job.rate}</span>
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
                            <div className="border-t pt-4 space-y-4">
                              {job.contract_type && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                                <h4 className="font-medium mb-2">Full Description:</h4>
                                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                  {job.description}
                                </p>
                              </div>

                              {job.skills && job.skills.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-2">Required Skills:</h4>
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
                              <Button disabled variant="outline" className="cursor-not-allowed opacity-50">
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
                                  Apply on {job.external_source}
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
                            <Button
                              variant="outline"
                              onClick={() => toggleJobExpansion(job.id.toString())}
                              data-testid={`button-expand-${job.id}`}
                            >
                              {expandedJobId === job.id.toString() ? (
                                <ChevronUp className="w-4 h-4 mr-1" />
                              ) : (
                                <ChevronDown className="w-4 h-4 mr-1" />
                              )}
                              {expandedJobId === job.id.toString()
                                ? "Less Details"
                                : "More Details"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col items-center gap-4 pt-6 sm:flex-row sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of{" "}
                        {filteredJobs.length} jobs
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>

                        {/* Page Numbers */}
                        <div className="flex gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(
                              pageNum =>
                                pageNum === 1 ||
                                pageNum === totalPages ||
                                Math.abs(pageNum - currentPage) <= 1
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
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              </div>
                            ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </div>
      </div>
      {/* Apply modal */}
      <Dialog open={!!applyModalJob} onOpenChange={open => { if (!open) { setApplyModalJob(null); setCoverLetter(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for this job</DialogTitle>
            <DialogDescription className="truncate">
              {applyModalJob?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Add a short note to the employer — introduce yourself, highlight relevant experience, or ask a question..."
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{coverLetter.length}/1000</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setApplyModalJob(null); setCoverLetter(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => applyToJobMutation.mutate({ jobId: applyModalJob.id, note: coverLetter })}
              disabled={applyToJobMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {applyToJobMutation.isPending ? "Sending..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
