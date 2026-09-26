import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/hooks/usePageSeo";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, ShieldCheck, Star } from "lucide-react";
import { Link, useParams } from "wouter";
import { getCrewLandingPage, getRelatedCrewPages } from "@shared/crewLandingPages";
import NotFound from "@/pages/NotFound";

export default function CrewLanding() {
  const { slug } = useParams();
  const page = getCrewLandingPage(slug);

  // Always call hooks in the same order — resolve SEO to defaults when the slug
  // is unknown, then bail to NotFound below.
  usePageSeo(
    page?.title ?? "EventLink",
    page?.metaDescription ?? "EventLink — freelance events crew network."
  );

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/freelancers/search", "crew-landing", slug],
    enabled: !!page,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page!.role.searchKeyword) params.append("keyword", page!.role.searchKeyword);
      if (page!.city.searchLocation) params.append("location", page!.city.searchLocation);
      params.append("page", "1");
      params.append("limit", "12");
      const response = await fetch(`/api/freelancers/search?${params}`);
      if (!response.ok) throw new Error("Failed to fetch freelancers");
      return response.json();
    },
  });

  if (!page) return <NotFound />;

  const freelancers: any[] = searchResults?.results || [];
  const related = getRelatedCrewPages(page);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-4xl">
          {/* Hero / intro copy */}
          <h1 className="mb-6 text-4xl font-bold">
            <span className="text-primary">Freelance {page.role.heading}</span>{" "}
            <span className="text-accent">in {page.city.name}</span>
          </h1>
          <div className="space-y-4 text-lg text-muted-foreground">
            <p>{page.intro}</p>
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <span>{page.howItWorks}</span>
            </p>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#crew-results">
              <Button className="bg-gradient-primary hover:bg-primary-hover">
                {page.browseCtaLabel}
              </Button>
            </a>
            <Link to="/dashboard?tab=jobs&action=post">
              <Button variant="outline">{page.postCtaLabel}</Button>
            </Link>
          </div>

          {/* Embedded filtered list of real profiles */}
          <div id="crew-results" className="mt-14 scroll-mt-20">
            <h2 className="mb-6 text-2xl font-semibold">
              {page.role.heading} available in {page.city.name}
            </h2>

            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading profiles…
              </div>
            ) : freelancers.length === 0 ? (
              <Card className="p-8 text-center">
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    No {page.role.descLabel} in {page.city.name} have a live profile just yet — new
                    crew join EventLink every week.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link to="/freelancers">
                      <Button variant="outline">Browse all crew</Button>
                    </Link>
                    <Link to="/auth?tab=signup">
                      <Button variant="outline">
                        Join as {page.role.descLabel.replace(/s$/, "")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {freelancers.map((f) => {
                  const name = `${f.first_name || ""} ${f.last_name || ""}`.trim();
                  const initials = name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2);
                  return (
                    <Link key={f.user_id} to={`/profile/${f.user_id}`}>
                      <Card className="h-full border-l-4 border-l-accent transition-shadow hover:shadow-lg">
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-white">
                              {f.profile_photo_url ? (
                                <img
                                  src={f.profile_photo_url}
                                  alt={`${name} profile photo`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold">{initials}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="truncate text-lg">{name}</CardTitle>
                              <p className="truncate text-sm text-muted-foreground">
                                {f.title || "Event Professional"}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            {f.average_rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-current text-yellow-500" />
                                {f.average_rating.toFixed(1)}
                              </span>
                            )}
                            {f.availability_status === "available" && (
                              <Badge className="bg-green-100 text-green-800">Available</Badge>
                            )}
                            {(f.location || f.country) && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {[f.location, f.country].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-6">
              <Link to="/freelancers" className="text-primary underline hover:text-accent">
                See all freelance crew on EventLink →
              </Link>
            </div>
          </div>

          {/* Internal-link cluster to sibling landing pages */}
          {related.length > 0 && (
            <div className="mt-16 border-t pt-8">
              <h2 className="mb-4 text-xl font-semibold">Related searches</h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link to={r.path} className="hover:text-foreground hover:underline">
                      Freelance {r.role.heading} in {r.city.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
