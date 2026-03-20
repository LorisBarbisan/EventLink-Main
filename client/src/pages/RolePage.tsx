import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SeoHead from "@/components/SeoHead";
import { Layout } from "@/components/Layout";

const ROLE_LABELS: Record<string, string> = {
  "sound-engineer": "Sound Engineer",
  "lighting-technician": "Lighting Technician",
  "production-manager": "Production Manager",
  "stage-manager": "Stage Manager",
  "av-technician": "AV Technician",
  rigger: "Rigger",
  "video-technician": "Video Technician",
  "event-manager": "Event Manager",
  "technical-director": "Technical Director",
  "broadcast-technician": "Broadcast Technician",
};

export default function RolePage() {
  const { role } = useParams<{ role: string }>();
  const label = ROLE_LABELS[role] || role?.replace(/-/g, " ") || "Freelancer";

  const { data, isLoading } = useQuery<{ freelancers: any[]; jobs: any[] }>({
    queryKey: ["/api/seo/roles", role],
    queryFn: async () => {
      const res = await fetch(`/api/seo/roles/${role}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  return (
    <Layout>
      <SeoHead
        title={`Hire ${label}s for Events | EventLink`}
        description={`Find and hire experienced ${label}s for events across the UK. Browse top-rated ${label} freelancers on EventLink.`}
        canonicalPath={`/roles/${role}`}
      />
      <div className="min-h-screen bg-[#F4F2EE]">
        <section className="bg-[#3D1766] text-white py-16 px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Hire {label}s for Events</h1>
          <p className="text-lg text-purple-200 max-w-2xl mx-auto mb-8">
            Connect with experienced {label} freelancers available for events across the UK.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/jobs">
              <Button variant="secondary">Browse {label} Jobs</Button>
            </Link>
            <Link href="/freelancers">
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#3D1766]">
                Find Freelancers
              </Button>
            </Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-[#3D1766] mb-6 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Available {label}s
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : data?.freelancers?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {data.freelancers.map((f: any) => (
                <Link key={f.id} href={f.slug ? `/freelancers/${f.slug}` : `/profile/${f.user_id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {f.profile_photo_url ? (
                          <img src={f.profile_photo_url} alt={f.first_name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#3D1766] flex items-center justify-center text-white font-bold">
                            {f.first_name?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm">{f.first_name} {f.last_name}</p>
                          <p className="text-xs text-gray-500">{f.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        {f.location || "UK"}
                      </div>
                      {f.availability_status === "available" && (
                        <Badge className="mt-2 text-xs bg-green-100 text-green-700 border-0">Available</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 mb-12">No {label} freelancers found yet.</p>
          )}

          {data?.jobs?.length ? (
            <>
              <h2 className="text-2xl font-bold text-[#3D1766] mb-6 flex items-center gap-2">
                <Briefcase className="w-6 h-6" />
                Open {label} Jobs
              </h2>
              <div className="space-y-3">
                {data.jobs.map((j: any) => (
                  <Link key={j.id} href={j.slug ? `/jobs/${j.slug}` : `/jobs/${j.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold">{j.title}</p>
                          <p className="text-sm text-gray-500">{j.company} · {j.location}</p>
                        </div>
                        <Badge variant="outline">{j.contract_type || "Freelance"}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </Layout>
  );
}
