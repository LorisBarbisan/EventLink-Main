import { describe, it, expect } from "vitest";

import { generateKeyPairSync, sign } from "crypto";
import { suppressionFor, verifySendgridSignature } from "../utils/sendgrid-events";

describe("suppressionFor", () => {
  it("hard bounces and spam complaints suppress", () => {
    expect(suppressionFor({ event: "bounce", type: "bounce" })).toBe("bounced");
    expect(suppressionFor({ event: "spamreport" })).toBe("spam_complaint");
    expect(suppressionFor({ event: "dropped", reason: "Bounced Address" })).toBe("bounced");
  });
  it("soft bounces, deliveries and opens don't", () => {
    expect(suppressionFor({ event: "bounce", type: "blocked" })).toBeNull();
    expect(suppressionFor({ event: "delivered" })).toBeNull();
    expect(suppressionFor({ event: "dropped", reason: "Unsubscribed Address" })).toBeNull();
  });
});

describe("verifySendgridSignature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const body = Buffer.from('[{"email":"a@b.com","event":"bounce"}]');
  const ts = "1763600000";
  const sig = sign("sha256", Buffer.concat([Buffer.from(ts), body]), privateKey).toString("base64");

  it("accepts a correctly signed payload", () => {
    expect(verifySendgridSignature(pub, body, sig, ts)).toBe(true);
  });
  it("rejects a tampered body, a different timestamp, or garbage", () => {
    expect(verifySendgridSignature(pub, Buffer.from("[]"), sig, ts)).toBe(false);
    expect(verifySendgridSignature(pub, body, sig, "1")).toBe(false);
    expect(verifySendgridSignature("nope", body, sig, ts)).toBe(false);
  });
});
