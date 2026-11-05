import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, Mail, Linkedin, Building2, Star } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RATING_LABELS: Record<string, { label: string; stars: number }> = {
  excellent: { label: "Excellent", stars: 5 },
  good: { label: "Good", stars: 4 },
  mixed: { label: "Mixed", stars: 3 },
};

export const BADGE_CONFIG: Record<string, { label: string; colour: string; icon: string }> = {
  highly_recommended: {
    label: "Highly Recommended",
    colour: "bg-green-100 text-green-800 border-green-300",
    icon: "⭐",
  },
  recommended: {
    label: "Recommended",
    colour: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: "✅",
  },
  work_history_confirmed: {
    label: "Work History Confirmed",
    colour: "bg-blue-100 text-blue-800 border-blue-300",
    icon: "🔵",
  },
};

export const VERIFICATION_BADGE: Record<
  string,
  { label: string; colour: string; icon: typeof ShieldCheck }
> = {
  eventlink_member: {
    label: "EventLink Member",
    colour: "bg-green-50 text-green-700 border-green-400",
    icon: UserCheck,
  },
  linkedin: {
    label: "LinkedIn Verified",
    colour: "bg-sky-50 text-sky-700 border-sky-300",
    icon: Linkedin,
  },
  email: {
    label: "Email Verified",
    colour: "bg-amber-50 text-amber-700 border-amber-300",
    icon: Mail,
  },
};

// "EventLink Member" badge that links to that member's EventLink profile.
export function EventLinkMemberBadge({ userId }: { userId: number }) {
  const config = VERIFICATION_BADGE.eventlink_member;
  const Icon = config.icon;
  return (
    <Link
      href={`/profile/${userId}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${config.colour}`}
      title="View their EventLink profile"
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Link>
  );
}

export function VerificationBadge({ reference }: { reference: any }) {
  const vType = reference.verification_type;
  if (!vType || vType === "none") return null;
  if (vType === "eventlink_member" && reference.eventlink_user_id) {
    return <EventLinkMemberBadge userId={reference.eventlink_user_id} />;
  }
  const config = VERIFICATION_BADGE[vType];
  if (!config) return null;
  const Icon = config.icon;

  let detail = "";
  if (vType === "linkedin" && reference.linkedin_name) {
    detail = `${reference.linkedin_name}`;
    if (reference.linkedin_title) detail += `, ${reference.linkedin_title}`;
    if (reference.linkedin_company) detail += ` at ${reference.linkedin_company}`;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.colour}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      {detail && <span className="ml-0.5 font-normal">— {detail}</span>}
    </span>
  );
}

export function DomainTrustIndicator({ level }: { level: string | null }) {
  if (!level) return null;
  if (level === "high") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600">
        <ShieldCheck className="h-2.5 w-2.5" /> Corporate email
      </span>
    );
  }
  return null;
}

function useReferences(freelancerId: number) {
  return useQuery<any[]>({
    queryKey: ["/api/references/freelancer", freelancerId],
    queryFn: async () => {
      const res = await fetch(`/api/references/freelancer/${freelancerId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!freelancerId,
  });
}

// A job review's star rating maps onto the same badges as references:
// 5 stars = Highly Recommended, 4 stars = Recommended, 3 or fewer = no badge
// (matching how a "mixed" reference gets no public badge).
export function ratingBadge(stars: number) {
  return stars >= 5 ? "highly_recommended" : stars === 4 ? "recommended" : null;
}

interface Recommendation {
  key: string;
  badge_result: string;
  source: string;
  stars: number | null;
  fromReview: boolean;
}

// References plus 4-5 star job reviews, as one list of recommendations.
// Must match the Find Crew ranking in storage.searchFreelancers.
function useRecommendations(freelancerId: number) {
  const { data: references = [] } = useReferences(freelancerId);
  const { data: ratings = [] } = useQuery<any[]>({
    queryKey: ["/api/ratings/freelancer", freelancerId],
    queryFn: async () => {
      const res = await fetch(`/api/ratings/freelancer/${freelancerId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!freelancerId,
  });

  const recommendations: Recommendation[] = [
    ...references.map((ref: any) => ({
      key: `ref-${ref.id}`,
      badge_result: ref.badge_result,
      source: ref.referee_organisation || "Organisation not specified",
      stars: RATING_LABELS[ref.q2_rating]?.stars ?? null,
      fromReview: false,
    })),
    ...ratings
      .filter((r: any) => ratingBadge(r.rating))
      .map((r: any) => ({
        key: `review-${r.id}`,
        badge_result: ratingBadge(r.rating) as string,
        source:
          [r.recruiter?.first_name, r.recruiter?.last_name].filter(Boolean).join(" ") ||
          "EventLink employer",
        stars: r.rating,
        fromReview: true,
      })),
  ];
  return { references, recommendations };
}

function ReferenceListPopup({
  recommendations,
  open,
  onOpenChange,
}: {
  recommendations: Recommendation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Recommendations ({recommendations.length})
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {recommendations.map((ref) => {
            const badge = BADGE_CONFIG[ref.badge_result];
            const rating = ref.stars ? { stars: ref.stars } : null;
            const SourceIcon = ref.fromReview ? UserCheck : Building2;
            return (
              <div
                key={ref.key}
                className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <SourceIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{ref.source}</span>
                  </div>
                  {badge && (
                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${badge.colour}`}
                    >
                      {badge.icon} {badge.label}
                    </span>
                  )}
                </div>
                {rating && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {Array.from({ length: rating.stars }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                    {Array.from({ length: 5 - rating.stars }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 text-gray-200" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReferenceBadges({ freelancerId }: { freelancerId: number }) {
  const { references, recommendations } = useRecommendations(freelancerId);
  const [popupOpen, setPopupOpen] = useState(false);

  if (!recommendations.length) return null;

  const counts: Record<string, number> = {};
  for (const ref of recommendations) {
    if (BADGE_CONFIG[ref.badge_result]) {
      counts[ref.badge_result] = (counts[ref.badge_result] || 0) + 1;
    }
  }

  // Reviews come from logged-in EventLink employers, so they count as verified.
  const verifiedCount =
    references.filter((r: any) => r.verification_type && r.verification_type !== "none").length +
    recommendations.filter((r) => r.fromReview).length;
  const topBadge = ["highly_recommended", "recommended", "work_history_confirmed"].find(
    (b) => counts[b]
  );
  if (!topBadge) return null;

  const cfg = BADGE_CONFIG[topBadge];
  const total = recommendations.length;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="mt-1 flex cursor-pointer flex-wrap items-center gap-2 transition-opacity hover:opacity-80"
        onClick={() => setPopupOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPopupOpen(true);
          }
        }}
        title="Click to view recommendations"
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.colour}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {cfg.icon} {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {total} recommendation{total !== 1 ? "s" : ""}
        </span>
        {verifiedCount > 0 && (
          <span className="text-xs font-medium text-green-600">{verifiedCount} verified</span>
        )}
      </div>
      <ReferenceListPopup
        recommendations={recommendations}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      />
    </>
  );
}

export function CompactReferenceBadge({ freelancerId }: { freelancerId: number }) {
  const { recommendations } = useRecommendations(freelancerId);
  const [popupOpen, setPopupOpen] = useState(false);

  if (!recommendations.length) return null;

  const counts: Record<string, number> = {};
  for (const ref of recommendations) {
    if (BADGE_CONFIG[ref.badge_result]) {
      counts[ref.badge_result] = (counts[ref.badge_result] || 0) + 1;
    }
  }

  const topBadge = ["highly_recommended", "recommended", "work_history_confirmed"].find(
    (b) => counts[b]
  );
  if (!topBadge) return null;

  const cfg = BADGE_CONFIG[topBadge];
  const total = recommendations.length;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="mt-1 flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPopupOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setPopupOpen(true);
          }
        }}
        title="Click to view recommendations"
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${cfg.colour}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {cfg.icon} {cfg.label}
        </span>
        <span className="text-[11px] text-muted-foreground">({total})</span>
      </div>
      <ReferenceListPopup
        recommendations={recommendations}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      />
    </>
  );
}
