import { ContactModal } from "@/components/ContactModal";
import { Layout } from "@/components/Layout";
import { CompactReferenceBadge } from "@/components/ReferenceBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Star,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const EVENTLINK_PROMOTIONAL_EMAIL = "eventlink@eventlink.one";

export default function Freelancers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [, setLocation] = useLocation();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const [highlightedFreelancer, setHighlightedFreelancer] = useState<string | null>(null);
  const isRecruiter = currentUser?.role === "recruiter" || currentUser?.role === "admin";
  const resultsRef = useRef<HTMLDivElement>(null);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { data: savedIds = [] } = useQuery<number[]>({
    queryKey: ["/api/saved-freelancers"],
    enabled: isRecruiter,
  });

  const saveMutation = useMutation({
    mutationFn: async (freelancerId: number) => {
      return apiRequest("/api/saved-freelancers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freelancerId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-crew"] });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (freelancerId: number) => {
      return apiRequest(`/api/saved-freelancers/${freelancerId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-crew"] });
    },
  });

  // Check for highlight parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlight = urlParams.get("highlight");
    if (highlight) {
      setHighlightedFreelancer(highlight);
      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightedFreelancer(null), 3000);
    }
  }, []);

  // Reset to page 1 when search filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationFilter, countryFilter]);

  // Fetch freelancers using server-side search
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/freelancers/search", searchQuery, locationFilter, countryFilter, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("keyword", searchQuery);
      if (locationFilter) params.append("location", locationFilter);
      if (countryFilter) params.append("country", countryFilter);
      params.append("page", currentPage.toString());
      params.append("limit", "21");

      const response = await fetch(`/api/freelancers/search?${params}`);
      if (!response.ok) throw new Error("Failed to fetch freelancers");
      return await response.json();
    },
  });

  const freelancers = searchResults?.results || [];
  const totalResults = searchResults?.total || 0;
  const totalPages = Math.ceil(totalResults / 21);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Transform freelancer data to match display format
  const transformedFreelancers = freelancers.map((profile: any) => ({
    id: `real-${profile.user_id}`,
    name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
    title: profile.title || "Event Professional",
    superpower: profile.superpower,
    location: profile.location || "",
    country: profile.country || "",
    experience: profile.experience_years
      ? `${profile.experience_years} years`
      : "Experience not specified",
    rating: profile.average_rating || 0,
    availability:
      profile.availability_status === "available"
        ? "Available"
        : profile.availability_status === "busy"
          ? "Busy"
          : "Unavailable",
    skills: profile.skills || [],
    bio: profile.bio || "Professional event crew member",
    recentProjects: Math.floor(Math.random() * 5) + 1,
    avatar: profile.profile_photo_url || null,
    isReal: true,
    relevanceScore: profile.relevance_score || 0,
    userEmail: profile.user_email || "",
    isPromotional: profile.user_email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL,
  }));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 text-4xl font-bold">
            <span className="text-primary">Find</span> <span className="text-accent">Crew</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Connect with skilled technical professionals for your events. Browse profiles and hire
            the best crew for your projects.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search & Filter Freelancers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <Input
                  placeholder="Search freelancers, skills, or specializations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="input-search-freelancers"
                />
              </div>
              <div>
                <Select
                  value={countryFilter || "all"}
                  onValueChange={(v) => {
                    setCountryFilter(v === "all" ? "" : v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-country-filter">
                    <SelectValue placeholder="Filter by country..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <UKLocationInput
                  placeholder="Filter by city..."
                  value={locationFilter}
                  onChange={(value) => setLocationFilter(value)}
                  data-testid="input-location-filter"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="space-y-6" ref={resultsRef}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Searching...
                </span>
              ) : (
                <>
                  {totalResults} Freelancer{totalResults !== 1 ? "s" : ""} Found
                  {totalResults > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (Page {currentPage} of {totalPages})
                    </span>
                  )}
                </>
              )}
            </h2>
          </div>

          {/* Error State */}
          {error && (
            <Card className="border-red-200 bg-red-50 p-8 text-center">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-4xl text-red-600">⚠️</div>
                  <h3 className="text-xl font-semibold text-red-900">Search Error</h3>
                  <p className="mx-auto max-w-md text-red-700">
                    We encountered an error while searching for freelancers. Please try again in a
                    moment.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="mt-4"
                    data-testid="button-retry-search"
                  >
                    Retry Search
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Results Message */}
          {!isLoading && !error && transformedFreelancers.length === 0 && (
            <Card className="p-8 text-center">
              <CardContent>
                <div className="space-y-4">
                  <User className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="text-xl font-semibold">No Freelancers Found</h3>
                  <p className="mx-auto max-w-md text-muted-foreground">
                    {searchQuery || locationFilter
                      ? `No freelancers match your search criteria. Try adjusting your filters or search terms.`
                      : `There are currently no freelancer profiles available. Freelancers need to complete their profiles before appearing in search results.`}
                  </p>
                  <div className="flex justify-center gap-4 pt-4">
                    {(searchQuery || locationFilter) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          setLocationFilter("");
                        }}
                        data-testid="button-clear-filters"
                      >
                        Clear Filters
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setLocation("/auth?tab=signup")}>
                      Join as Freelancer
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/jobs")}>
                      Browse Jobs Instead
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Pagination Controls */}
          {!isLoading && !error && totalPages > 1 && (
            <Card className="mb-4">
              <CardContent className="py-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="text-center text-sm text-muted-foreground sm:text-left">
                    Showing {(currentPage - 1) * 20 + 1} –{" "}
                    {Math.min(currentPage * 20, totalResults)} of {totalResults} results
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p - 1)}
                      disabled={!hasPrevPage}
                      className="hidden sm:flex"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p - 1)}
                      disabled={!hasPrevPage}
                      className="w-10 px-0 sm:hidden"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-10 px-0 sm:w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!hasNextPage}
                      className="hidden sm:flex"
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={!hasNextPage}
                      className="w-10 px-0 sm:hidden"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Freelancers Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {transformedFreelancers.map((freelancer: any) => (
              <Card
                key={freelancer.id}
                className={`border-l-4 border-l-accent transition-shadow hover:shadow-lg ${
                  highlightedFreelancer && freelancer.id === `real-${highlightedFreelancer}`
                    ? "bg-blue-50 ring-2 ring-blue-500"
                    : ""
                }`}
                data-testid={`freelancer-card-${freelancer.id}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-primary flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-2xl">
                      {freelancer.avatar &&
                      (freelancer.avatar.startsWith("data:image/") ||
                        freelancer.avatar.startsWith("https://") ||
                        freelancer.avatar.startsWith("http://")) ? (
                        <img
                          src={freelancer.avatar}
                          alt={`${freelancer.name} profile photo`}
                          className="h-full w-full rounded-full bg-white object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-600">
                          <span className="text-lg font-bold text-white">
                            {freelancer.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{freelancer.name}</CardTitle>
                      <p className="font-medium text-muted-foreground">{freelancer.title}</p>
                      {freelancer.superpower && (
                        <div className="mt-1 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Superpower:
                          </span>
                          <Badge className="h-auto max-w-full truncate whitespace-normal border-0 bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 hover:from-purple-600 hover:to-pink-600">
                            ⚡ {freelancer.superpower}
                          </Badge>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        {freelancer.rating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-current text-yellow-500" />
                            <span>{freelancer.rating.toFixed(1)}</span>
                          </div>
                        )}
                        <Badge
                          variant={
                            freelancer.availability === "Available" ? "default" : "secondary"
                          }
                          className={
                            freelancer.availability === "Available"
                              ? "bg-green-100 text-green-800"
                              : ""
                          }
                        >
                          {freelancer.availability}
                        </Badge>
                        {(freelancer.location || freelancer.country) && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {[
                                freelancer.location,
                                freelancer.country || (freelancer.location ? "United Kingdom" : ""),
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <CompactReferenceBadge
                        freelancerId={parseInt(freelancer.id.replace("real-", ""), 10)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-3">
                    <Button
                      className="bg-gradient-primary hover:bg-primary-hover h-8 text-sm"
                      onClick={() => {
                        if (!currentUser && !freelancer.isPromotional) {
                          alert("Please log in to contact freelancers");
                          return;
                        }
                        if (!currentUser && freelancer.isPromotional) {
                          const userId = freelancer.id.replace("real-", "");
                          setLocation(`/profile/${userId}?action=contact`);
                          return;
                        }
                        setSelectedFreelancer(freelancer);
                        setContactModalOpen(true);
                      }}
                      data-testid={`button-contact-${freelancer.id}`}
                    >
                      Contact
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 text-sm"
                      onClick={() => {
                        const userId = freelancer.id.replace("real-", "");
                        setLocation(`/profile/${userId}`);
                      }}
                      data-testid={`button-view-profile-${freelancer.id}`}
                    >
                      View Profile
                    </Button>
                    {isRecruiter &&
                      (() => {
                        const freelancerUserId = parseInt(freelancer.id.replace("real-", ""), 10);
                        const isSaved = savedIds.includes(freelancerUserId);
                        return (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`ml-auto h-8 w-8 ${isSaved ? "text-orange-500" : "text-muted-foreground"}`}
                            onClick={() => {
                              if (isSaved) {
                                unsaveMutation.mutate(freelancerUserId);
                              } else {
                                saveMutation.mutate(freelancerUserId);
                              }
                            }}
                            disabled={saveMutation.isPending || unsaveMutation.isPending}
                            title={isSaved ? "Remove from My Crew" : "Save to My Crew"}
                          >
                            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                          </Button>
                        );
                      })()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {!isLoading && !error && totalPages > 1 && (
            <Card className="mt-8">
              <CardContent className="py-4">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="text-center text-sm text-muted-foreground sm:text-left">
                    Showing {(currentPage - 1) * 20 + 1} -{" "}
                    {Math.min(currentPage * 20, totalResults)} of {totalResults} results
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={!hasPrevPage}
                      data-testid="button-prev-page"
                      className="hidden sm:flex"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={!hasPrevPage}
                      data-testid="button-prev-page-mobile"
                      className="w-10 px-0 sm:hidden"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="w-10 px-0 sm:w-10"
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={!hasNextPage}
                      data-testid="button-next-page"
                      className="hidden sm:flex"
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={!hasNextPage}
                      data-testid="button-next-page-mobile"
                      className="w-10 px-0 sm:hidden"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Contact Modal */}
      {selectedFreelancer && currentUser && (
        <ContactModal
          isOpen={contactModalOpen}
          onClose={() => {
            setContactModalOpen(false);
            setSelectedFreelancer(null);
          }}
          freelancer={{
            id: parseInt(selectedFreelancer.id.replace("real-", "")),
            user_id: parseInt(selectedFreelancer.id.replace("real-", "")),
            first_name: selectedFreelancer.name.split(" ")[0] || "",
            last_name: selectedFreelancer.name.split(" ").slice(1).join(" ") || "",
            title: selectedFreelancer.title,
            photo_url: selectedFreelancer.avatar,
          }}
          currentUser={currentUser}
        />
      )}
    </Layout>
  );
}
