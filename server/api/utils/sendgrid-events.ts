import { createPublicKey, verify } from "crypto";

export type SuppressionReason = "bounced" | "spam_complaint";

/** SendGrid events that mean "stop emailing this address". */
export function suppressionFor(event: {
  event?: string;
  type?: string;
  reason?: string;
}): SuppressionReason | null {
  if (event.event === "spamreport") return "spam_complaint";
  // "bounce" is a hard bounce ("blocked" is the soft kind — ignore it)
  if (event.event === "bounce" && event.type !== "blocked") return "bounced";
  // SendGrid refusing to send because the address bounced before
  if (event.event === "dropped" && /bounced address/i.test(event.reason ?? "")) return "bounced";
  return null;
}

/**
 * SendGrid's signed event webhook: ECDSA over (timestamp + raw body), public
 * key from the SendGrid settings page (base64 DER). Fails closed.
 */
export function verifySendgridSignature(
  publicKeyB64: string,
  rawBody: Buffer,
  signatureB64: string,
  timestamp: string
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(
      "sha256",
      Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]),
      key,
      Buffer.from(signatureB64, "base64")
    );
  } catch {
    return false;
  }
}
