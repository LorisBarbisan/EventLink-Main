import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import SeoHead from "@/components/SeoHead";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function FreelancerPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/freelancers/by-slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/freelancers/by-slug/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (profile?.user_id) {
      setLocation(`/profile/${profile.user_id}`, { replace: true });
    }
  }, [profile, setLocation]);

  if (isError) {
    return (
      <Layout>
        <SeoHead title="Freelancer Not Found | EventLink" description="This freelancer profile could not be found." noindex />
        <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-[#3D1766] mb-4">Profile Not Found</h1>
            <p className="text-gray-500 mb-6">This freelancer profile doesn't exist or has been removed.</p>
            <Link href="/freelancers"><Button>Browse Freelancers</Button></Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#F4F2EE] flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-4">
          {isLoading && (
            <>
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
