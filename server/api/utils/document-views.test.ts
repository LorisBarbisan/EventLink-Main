import { describe, it, expect } from "vitest";
import type { FreelancerDocument } from "@shared/schema";
import { documentViewer, ownerDocumentView, publicDocumentView } from "./document-views";

const base = { freelancerId: 7, profileIsPublic: false, shareToken: "tok", presentedToken: null };

describe("documentViewer", () => {
  it("owner and admin get the full view", () => {
    expect(documentViewer({ ...base, requester: { id: 7, role: "freelancer" } }).kind).toBe(
      "owner"
    );
    expect(documentViewer({ ...base, requester: { id: 1, role: "admin" } }).kind).toBe("admin");
  });
  it("employers see credentials whatever the profile visibility", () => {
    expect(documentViewer({ ...base, requester: { id: 3, role: "recruiter" } }).kind).toBe(
      "public"
    );
  });
  it("another freelancer is refused", () => {
    expect(documentViewer({ ...base, requester: { id: 8, role: "freelancer" } }).kind).toBe(
      "denied"
    );
  });
  it("signed out: only a public profile or the right share token", () => {
    expect(documentViewer({ ...base, requester: null }).kind).toBe("denied");
    expect(documentViewer({ ...base, requester: null, profileIsPublic: true }).kind).toBe("public");
    expect(documentViewer({ ...base, requester: null, presentedToken: "tok" }).kind).toBe("public");
    expect(documentViewer({ ...base, requester: null, presentedToken: "nope" }).kind).toBe(
      "denied"
    );
  });
});

describe("document views", () => {
  const doc = {
    id: 1,
    freelancer_id: 7,
    file_url: "objects/secret",
    reference_number: "CSCS-123",
    issuing_body: "CSCS",
  } as unknown as FreelancerDocument;
  it("the public view never carries the reference number or file location", () => {
    const v = publicDocumentView(doc) as Record<string, unknown>;
    expect("reference_number" in v).toBe(false);
    expect("file_url" in v).toBe(false);
    expect(v.issuing_body).toBe("CSCS");
  });
  it("the owner view keeps the reference number but not the file location", () => {
    const v = ownerDocumentView(doc) as Record<string, unknown>;
    expect(v.reference_number).toBe("CSCS-123");
    expect("file_url" in v).toBe(false);
  });
});
