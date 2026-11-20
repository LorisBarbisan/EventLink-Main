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
 * The signature covers the timestamp, so it can't be altered — but without
 * an age limit a captured genuine event could be replayed for ever (e.g. to
 * re-suppress an address right after its owner clears it). SendGrid signs
 * each delivery attempt when it makes it, retries included.
 */
export const SENDGRID_MAX_AGE_SECONDS = 600;
export function isFreshTimestamp(
  timestamp: string,
  nowSeconds = Date.now() / 1000,
  maxAgeSeconds = SENDGRID_MAX_AGE_SECONDS
): boolean {
  if (!/^[0-9]+$/.test(timestamp)) return false;
  return Math.abs(nowSeconds - Number(timestamp)) <= maxAgeSeconds;
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
