import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Globe, Linkedin, MapPin, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SeoHead from "@/components/SeoHead";
import { Layout } from "@/components/Layout";

export default function EmployerPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading } = useQuery<{ profile: any; user: any; jobs: any[] }>({
    queryKey: ["/api/employers/by-slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/employers/by-slug/${slug}`);
      if (!res.ok) throw new Error("Employer not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#F4F2EE] py-12 px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!data?.profile) {
    return (
      <Layout>
        <SeoHead title="Employer Not Found | EventLink" description="This employer profile could not be found." noindex />
        <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#3D1766] mb-4">Employer Not Found</h1>
            <p className="text-gray-500 mb-6">This employer profile doesn't exist or has been removed.</p>
            <Link href="/jobs"><Button>Browse Jobs</Button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  const { profile, jobs } = data;
  const companyName = profile.company_name || "Event Company";

  return (
    <Layout>
      <SeoHead
        title={`${companyName} | Event Employer | EventLink`}
        description={`View ${companyName}'s profile and open event job listings on EventLink. ${profile.description?.slice(0, 120) || ""}`}
        canonicalPath={`/employers/${slug}`}
        ogImage={profile.company_logo_url || undefined}
      />
      <div className="min-h-screen bg-[#F4F2EE]">
        <section className="bg-[#3D1766] text-white py-16 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-6 flex-wrap">
            {profile.company_logo_url ? (
              <img src={profile.company_logo_url} alt={companyName} className="w-20 h-20 rounded-xl object-contain bg-white p-2" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-purple-600 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{companyName}</h1>
              {profile.company_type && <p className="text-purple-200 mt-1">{profile.company_type}</p>}
              {profile.location && (
                <div className="flex items-center gap-1 text-purple-200 mt-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </div>
              )}
              <div className="flex gap-3 mt-3">
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-purple-200 hover:text-white">
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {profile.linkedin_url && (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-purple-200 hover:text-white">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12">
          {profile.description && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-[#3D1766] mb-3">About {companyName}</h2>
                <p className="text-gray-700 leading-relaxed">{profile.description}</p>
              </CardContent>
            </Card>
          )}

          <h2 className="text-2xl font-bold text-[#3D1766] mb-6 flex items-center gap-2">
            <Briefcase className="w-6 h-6" />
            Open Jobs at {companyName}
          </h2>

          {jobs?.length ? (
            <div className="space-y-3">
              {jobs.map((j: any) => (
                <Link key={j.id} href={j.slug ? `/jobs/${j.slug}` : `/jobs/${j.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold">{j.title}</p>
                        <p className="text-sm text-gray-500">{j.location}</p>
                        {j.event_date && <p className="text-xs text-gray-400">Event: {new Date(j.event_date).toLocaleDateString()}</p>}
                      </div>
                      <Badge variant="outline">{j.contract_type || "Freelance"}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-xl">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No open jobs at the moment.</p>
              <Link href="/jobs"><Button className="mt-4" variant="outline">Browse All Jobs</Button></Link>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
