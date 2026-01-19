import { ContactModal } from "@/components/ContactModal";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Star,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Freelancers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [, setLocation] = useLocation();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const { user: currentUser } = useAuth();
  const [highlightedFreelancer, setHighlightedFreelancer] = useState<string | null>(null);

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
  }, [searchQuery, locationFilter]);

  // Fetch freelancers using server-side search
  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/freelancers/search", searchQuery, locationFilter, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("keyword", searchQuery);
      if (locationFilter) params.append("location", locationFilter);
      params.append("page", currentPage.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/freelancers/search?${params}`);
      if (!response.ok) throw new Error("Failed to fetch freelancers");
      return await response.json();
    },
  });

  const freelancers = searchResults?.results || [];
  const totalResults = searchResults?.total || 0;
  const totalPages = Math.ceil(totalResults / 20);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // Transform freelancer data to match display format
  const transformedFreelancers = freelancers.map((profile: any) => ({
    id: `real-${profile.user_id}`,
    name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
    title: profile.title || "Event Professional",
    superpower: profile.superpower,
    location: profile.location || "Location not specified",
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
  }));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-primary">Find</span> <span className="text-accent">Crew</span>
          </h1>
          <p className="text-muted-foreground text-lg">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search freelancers, skills, or specializations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full"
                  data-testid="input-search-freelancers"
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
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="space-y-6">
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
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (Page {currentPage} of {totalPages})
                    </span>
                  )}
                </>
              )}
            </h2>
          </div>

          {/* Error State */}
          {error && (
            <Card className="p-8 text-center border-red-200 bg-red-50">
              <CardContent>
                <div className="space-y-4">
                  <div className="text-red-600 text-4xl">⚠️</div>
                  <h3 className="text-xl font-semibold text-red-900">Search Error</h3>
                  <p className="text-red-700 max-w-md mx-auto">
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
                  <User className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="text-xl font-semibold">No Freelancers Found</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {searchQuery || locationFilter
                      ? `No freelancers match your search criteria. Try adjusting your filters or search terms.`
                      : `There are currently no freelancer profiles available. Freelancers need to complete their profiles before appearing in search results.`}
                  </p>
                  <div className="pt-4 flex gap-4 justify-center">
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

          {/* Freelancers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {transformedFreelancers.map((freelancer: any) => (
              <Card
                key={freelancer.id}
                className={`hover:shadow-lg transition-shadow border-l-4 border-l-accent ${
                  highlightedFreelancer && freelancer.id === `real-${highlightedFreelancer}`
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : ""
                }`}
                data-testid={`freelancer-card-${freelancer.id}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-2xl overflow-hidden">
                      {freelancer.avatar &&
                      (freelancer.avatar.startsWith("data:image/") ||
                        freelancer.avatar.startsWith("https://") ||
                        freelancer.avatar.startsWith("http://")) ? (
                        <img
                          src={freelancer.avatar}
                          alt={`${freelancer.name} profile photo`}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {freelancer.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">
                        {freelancer.name}
                        {freelancer.isReal && (
                          <Badge variant="default" className="ml-2 bg-green-600 text-white text-xs">
                            VERIFIED
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-muted-foreground font-medium">{freelancer.title}</p>
                      {freelancer.superpower && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-medium text-muted-foreground">
                            Superpower:
                          </span>
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0">
                            ⚡ {freelancer.superpower}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {freelancer.rating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
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
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-sm">{freelancer.bio}</p>

                    <div className="flex flex-wrap gap-2">
                      {freelancer.skills.map((skill: any, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{freelancer.experience}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        className="bg-gradient-primary hover:bg-primary-hover"
                        onClick={() => {
                          if (!currentUser) {
                            alert("Please log in to contact freelancers");
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
                        onClick={() => {
                          const userId = freelancer.id.replace("real-", "");
                          setLocation(`/profile/${userId}`);
                        }}
                        data-testid={`button-view-profile-${freelancer.id}`}
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {!isLoading && !error && totalPages > 1 && (
            <Card className="mt-8">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * 20 + 1} -{" "}
                    {Math.min(currentPage * 20, totalResults)} of {totalResults} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={!hasPrevPage}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
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
                            className="w-10"
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
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!hasNextPage}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
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
