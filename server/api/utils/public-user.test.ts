import { describe, expect, it } from "vitest";
import { publicUserView } from "./public-user";

const row = {
  id: 18,
  role: "freelancer",
  first_name: "Sam",
  last_name: "Lee",
  profile_photo_url: null,
  email: "sam@example.com",
  pending_email_token: "secret",
  unsubscribe_token: "secret",
  stripe_customer_id: "cus_123",
  subscription_tier: "free",
  last_login_at: "2026-11-23T10:00:00Z",
};

describe("publicUserView", () => {
  it("shows only name, role and photo: no email, tokens or billing ids", () => {
    expect(publicUserView(row)).toEqual({
      id: 18,
      role: "freelancer",
      first_name: "Sam",
      last_name: "Lee",
      profile_photo_url: null,
    });
  });

  it("keeps EventLink's own address so its profile can be recognised", () => {
    expect(publicUserView({ ...row, email: "EventLink@eventlink.one" }).email).toBe(
      "EventLink@eventlink.one"
    );
  });
});
