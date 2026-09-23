import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Star,
  User,
} from "lucide-react";

export interface CrewJob {
  job_id: number;
  job_title?: string | null;
  job_company?: string | null;
  status: string;
  applied_at?: string | null;
}

export interface CrewMember {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  location?: string | null;
  country?: string | null;
  skills?: string[] | null;
  average_rating?: number | null;
  profile_photo_url?: string | null;
  profile_image_url?: string | null;
}

interface FreelancerDocument {
  id: number;
  document_type: string;
  custom_type_name?: string | null;
  original_filename: string;
  file_type: string;
}

interface Props {
  freelancer: CrewMember | null;
  jobs: CrewJob[];
  open: boolean;
  onClose: () => void;
  onViewFullProfile: (userId: number) => void;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  certification: "Certification",
  insurance: "Insurance",
  contract: "Contract",
  id_document: "ID Document",
  other: "Other",
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CrewMemberModal({ freelancer, jobs, open, onClose, onViewFullProfile }: Props) {
  const { toast } = useToast();
  const userId = freelancer?.user_id;

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/freelancer", userId],
    queryFn: () => apiRequest(`/api/freelancer/${userId}`),
    enabled: open && !!userId,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<FreelancerDocument[]>({
    queryKey: ["/api/documents", userId],
    queryFn: () => apiRequest(`/api/documents/${userId}`),
    enabled: open && !!userId,
  });

  // Downloads must go through an authenticated fetch (the endpoints accept a
  // Bearer token) and be streamed as a blob — a plain link would be unauthenticated.
  const authedDownload = async (url: string, fallbackType?: string | null) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Download failed");
      }
      const buffer = await res.arrayBuffer();
      const mime = res.headers.get("Content-Type") || fallbackType || "application/octet-stream";
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
      window.open(blobUrl, "_blank");
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  if (!freelancer) return null;

  const name =
    `${freelancer.first_name ?? ""} ${freelancer.last_name ?? ""}`.trim() || "Freelancer";
  const photo =
    freelancer.profile_photo_url || freelancer.profile_image_url || profile?.profile_photo_url;
  const title = freelancer.title ?? profile?.title;
  const locationLabel = [freelancer.location, freelancer.country].filter(Boolean).join(", ");
  const skills: string[] = (freelancer.skills ?? profile?.skills ?? []) as string[];
  const rating = freelancer.average_rating ?? 0;
  const bio = profile?.bio as string | undefined;
  const superpower = profile?.superpower as string | undefined;
  const experienceYears = profile?.experience_years as number | undefined;
  const hasCV = !!profile?.cv_file_url;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{name} — crew preview</DialogTitle>
        </DialogHeader>

        {/* Profile header */}
        <div className="flex items-start gap-4">
          {photo ? (
            <img
              src={photo}
              alt={name}
              className="h-16 w-16 flex-shrink-0 rounded-full bg-white object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
              <User className="h-8 w-8 text-orange-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{name}</h2>
            {title && <p className="text-sm text-muted-foreground">{title}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {locationLabel && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {locationLabel}
                </span>
              )}
              {rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {Number(rating).toFixed(1)}
                </span>
              )}
              {typeof experienceYears === "number" && experienceYears > 0 && (
                <span>
                  {experienceYears} yr{experienceYears === 1 ? "" : "s"} experience
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewFullProfile(freelancer.user_id)}
            className="flex-shrink-0"
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Full profile
          </Button>
        </div>

        {/* Superpower / bio */}
        {(superpower || bio) && (
          <div className="mt-4 space-y-2">
            {superpower && (
              <p className="text-sm">
                <span className="font-medium">Superpower:</span> {superpower}
              </p>
            )}
            {bio && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{bio}</p>}
          </div>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CV & documents */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            CV &amp; documents
          </p>
          {profileLoading || documentsLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !hasCV && documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No CV or documents uploaded.</p>
          ) : (
            <div className="space-y-2">
              {hasCV && (
                <button
                  type="button"
                  onClick={() =>
                    authedDownload(`/api/cv/download/${freelancer.user_id}`, profile?.cv_file_type)
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0 text-orange-600" />
                    <span className="truncate font-medium">
                      {profile?.cv_file_name || "Curriculum Vitae"}
                    </span>
                    <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                      CV
                    </Badge>
                  </span>
                  <Download className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              )}
              {documents.map((doc) => {
                const typeLabel =
                  doc.document_type === "other" && doc.custom_type_name
                    ? doc.custom_type_name
                    : DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() =>
                      authedDownload(`/api/documents/${doc.id}/download`, doc.file_type)
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{doc.original_filename}</span>
                      <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                        {typeLabel}
                      </Badge>
                    </span>
                    <Download className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Jobs done for this employer */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Jobs done for you {jobs.length > 0 && `(${jobs.length})`}
          </p>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed jobs with this freelancer yet.
            </p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const date = formatDate(job.applied_at);
                return (
                  <a
                    key={job.job_id}
                    href={`/jobs/${job.job_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Briefcase className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{job.job_title || "Job"}</span>
                        {(job.job_company || date) && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {[job.job_company, date].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </span>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
