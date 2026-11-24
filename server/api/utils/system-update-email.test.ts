import { describe, expect, it } from "vitest";
import { systemUpdateEmail } from "./emailTemplates";

// The admin broadcast reuses systemUpdateEmail but must read as the sender's own
// email, not a system notification: a verbatim subject (no 🔔) and no repeated
// heading above the greeting.
describe("systemUpdateEmail", () => {
  it("defaults to the 🔔 subject and renders the heading", () => {
    const { subject, html } = systemUpdateEmail({
      recipientName: "Alan",
      title: "Scheduled maintenance",
      message: "Back at 2am.",
    });
    expect(subject).toBe("🔔 Scheduled maintenance");
    expect(html).toContain("<h2>🔔 Scheduled maintenance</h2>");
  });

  it("uses a verbatim subject and hides the heading when asked", () => {
    const { subject, html } = systemUpdateEmail({
      recipientName: "Alan",
      title: "New Books features",
      message: "Have a look.",
      subjectOverride: "New Books features",
      hideHeading: true,
    });
    expect(subject).toBe("New Books features");
    expect(subject).not.toContain("🔔");
    expect(html).not.toContain("<h2>");
  });

  it("includes an unsubscribe link only when a URL is given", () => {
    const withUrl = systemUpdateEmail({
      recipientName: "Alan",
      title: "x",
      message: "y",
      unsubscribeUrl: "https://eventlink.one/unsubscribe?token=abc",
    });
    expect(withUrl.html).toContain("https://eventlink.one/unsubscribe?token=abc");
    const without = systemUpdateEmail({ recipientName: "Alan", title: "x", message: "y" });
    expect(without.html).not.toContain("/unsubscribe?token=");
  });
});
