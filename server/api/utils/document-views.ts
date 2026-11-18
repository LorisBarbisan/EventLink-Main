import type { FreelancerDocument } from "@shared/schema";

/**
 * The only shapes in which credential rows leave the server.
 *
 * reference_number (a CSCS card or PLI policy number) is something a person
 * could present as their own, so it goes to the owner and admins only. The
 * file location never leaves at all — files are served by the download
 * endpoint, which applies its own access rule.
 */
export function ownerDocumentView(d: FreelancerDocument): Omit<FreelancerDocument, "file_url"> {
  const out: Partial<FreelancerDocument> = { ...d };
  delete out.file_url;
  return out as Omit<FreelancerDocument, "file_url">;
}

export function publicDocumentView(
  d: FreelancerDocument
): Omit<FreelancerDocument, "file_url" | "reference_number"> {
  const out: Partial<FreelancerDocument> = { ...d };
  delete out.file_url;
  delete out.reference_number;
  return out as Omit<FreelancerDocument, "file_url" | "reference_number">;
}

export type DocumentViewer =
  | { kind: "owner" }
  | { kind: "admin" }
  | { kind: "public" }
  | { kind: "denied" };

/**
 * Who may list a freelancer's credentials — the download endpoint's rule:
 * signed-in employers and admins may; a freelancer only their own; someone
 * signed out only when the profile is public or they hold its share token.
 */
export function documentViewer(opts: {
  requester: { id: number; role: string } | null | undefined;
  freelancerId: number;
  profileIsPublic: boolean;
  shareToken: string | null | undefined;
  presentedToken: string | null | undefined;
}): DocumentViewer {
  const { requester, freelancerId } = opts;
  if (requester) {
    if (requester.id === freelancerId) return { kind: "owner" };
    if (requester.role === "admin") return { kind: "admin" };
    if (requester.role === "recruiter") return { kind: "public" };
    return { kind: "denied" };
  }
  if (opts.profileIsPublic) return { kind: "public" };
  if (opts.presentedToken && opts.shareToken && opts.presentedToken === opts.shareToken) {
    return { kind: "public" };
  }
  return { kind: "denied" };
}
