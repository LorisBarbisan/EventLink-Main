import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserCheck, Mail, Linkedin } from "lucide-react";

export const BADGE_CONFIG: Record<string, { label: string; colour: string; icon: string }> = {
  highly_recommended: { label: "Highly Recommended", colour: "bg-green-100 text-green-800 border-green-300", icon: "⭐" },
  recommended: { label: "Recommended", colour: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "✅" },
  work_history_confirmed: { label: "Work History Confirmed", colour: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔵" },
};

export const VERIFICATION_BADGE: Record<string, { label: string; colour: string; icon: typeof ShieldCheck }> = {
  eventlink_member: { label: "EventLink Member Reference", colour: "bg-green-50 text-green-700 border-green-300", icon: UserCheck },
  linkedin: { label: "LinkedIn Verified Reference", colour: "bg-green-50 text-green-700 border-green-300", icon: Linkedin },
  email: { label: "Email Verified Reference", colour: "bg-blue-50 text-blue-700 border-blue-300", icon: Mail },
};

export function VerificationBadge({ reference }: { reference: any }) {
  const vType = reference.verification_type;
  if (!vType || vType === "none") return null;
  const config = VERIFICATION_BADGE[vType];
  if (!config) return null;
  const Icon = config.icon;

  let detail = "";
  if (vType === "linkedin" && reference.linkedin_name) {
    detail = `${reference.linkedin_name}`;
    if (reference.linkedin_title) detail += `, ${reference.linkedin_title}`;
    if (reference.linkedin_company) detail += ` at ${reference.linkedin_company}`;
  }
  if (vType === "eventlink_member" && reference.eventlink_user_id) {
    detail = "";
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.colour}`}>
      <Icon className="h-3 w-3" />
      {config.label}
      {detail && <span className="ml-0.5 font-normal">— {detail}</span>}
    </span>
  );
}

export function DomainTrustIndicator({ level }: { level: string | null }) {
  if (!level) return null;
  if (level === "high") {
    return <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium"><ShieldCheck className="h-2.5 w-2.5" /> Corporate email</span>;
  }
  return null;
}

function useReferences(freelancerId: number) {
  return useQuery<any[]>({
    queryKey: [`/api/references/freelancer/${freelancerId}`],
    enabled: !!freelancerId,
  });
}

export function ReferenceBadges({ freelancerId }: { freelancerId: number }) {
  const { data: references = [] } = useReferences(freelancerId);

  if (!references.length) return null;

  const counts: Record<string, number> = {};
  for (const ref of references) {
    if (BADGE_CONFIG[ref.badge_result]) {
      counts[ref.badge_result] = (counts[ref.badge_result] || 0) + 1;
    }
  }

  const verifiedCount = references.filter((r: any) => r.verification_type && r.verification_type !== "none").length;
  const topBadge = ["highly_recommended", "recommended", "work_history_confirmed"].find(b => counts[b]);
  if (!topBadge) return null;

  const cfg = BADGE_CONFIG[topBadge];
  const total = references.length;

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.colour}`}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {cfg.icon} {cfg.label}
      </span>
      <span className="text-xs text-muted-foreground">{total} reference{total !== 1 ? "s" : ""}</span>
      {verifiedCount > 0 && (
        <span className="text-xs text-green-600 font-medium">{verifiedCount} verified</span>
      )}
    </div>
  );
}

export function CompactReferenceBadge({ freelancerId }: { freelancerId: number }) {
  const { data: references = [] } = useReferences(freelancerId);

  if (!references.length) return null;

  const counts: Record<string, number> = {};
  for (const ref of references) {
    if (BADGE_CONFIG[ref.badge_result]) {
      counts[ref.badge_result] = (counts[ref.badge_result] || 0) + 1;
    }
  }

  const topBadge = ["highly_recommended", "recommended", "work_history_confirmed"].find(b => counts[b]);
  if (!topBadge) return null;

  const cfg = BADGE_CONFIG[topBadge];
  const total = references.length;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.colour}`}>
        <ShieldCheck className="h-3 w-3" />
        {cfg.icon} {cfg.label}
      </span>
      <span className="text-[11px] text-muted-foreground">({total})</span>
    </div>
  );
}
