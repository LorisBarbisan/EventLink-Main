/**
 * Small helpers for Books on a phone, kept out of the big BooksTab chunk.
 */

/** The tax-estimate query the desktop calculator uses, from the same saved settings. */
export function savedTaxQuery(): string {
  const p = new URLSearchParams();
  const get = (k: string) => {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  };
  const pence = (v: string) => Math.max(0, Math.round(parseFloat(v || "0") * 100));
  if (pence(get("books_other_income")) > 0)
    p.set("other_income_pence", String(pence(get("books_other_income"))));
  if (get("books_scotland") === "1") p.set("scotland", "1");
  try {
    const plans = JSON.parse(get("books_student_loan_plans") || "[]") as string[];
    for (const plan of plans) p.append("student_loan_plans", plan);
  } catch {
    /* ignore a malformed saved value */
  }
  if (pence(get("books_pension")) > 0)
    p.set("pension_gross_pence", String(pence(get("books_pension"))));
  const wfh = get("books_wfh_tier");
  if (wfh === "low" || wfh === "mid" || wfh === "high") p.set("wfh_tier", wfh);
  if (pence(get("books_gift_aid")) > 0)
    p.set("gift_aid_net_pence", String(pence(get("books_gift_aid"))));
  if (pence(get("books_losses")) > 0)
    p.set("losses_carried_forward_pence", String(pence(get("books_losses"))));
  if (pence(get("books_child_benefit")) > 0)
    p.set("child_benefit_annual_pence", String(pence(get("books_child_benefit"))));
  const ma = get("books_marriage_allowance");
  if (ma === "giving" || ma === "receiving") p.set("marriage_allowance", ma);
  return p.toString();
}

/** Monthly amount to put aside for a "31 Jan YYYY" deadline (same rule as the desktop card). */
export function monthlySetAside(
  januaryPence: number,
  januaryDate: string,
  now: Date = new Date()
): { monthly: number; months: number; past: boolean } {
  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const [, mon, yr] = januaryDate.split(" ");
  const deadline = new Date(Date.UTC(parseInt(yr, 10), months[mon] ?? 0, 31, 12));
  const m = Math.max(
    1,
    (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth())
  );
  return { monthly: Math.ceil(januaryPence / m), months: m, past: deadline < now };
}

export const gbp = (pence: number) =>
  (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

/**
 * Shrink a phone photo before upload: long edge to 2000px, JPEG. A 6 MB photo
 * becomes a few hundred KB — what matters on a venue's wifi.
 */
export async function shrinkPhoto(
  file: File
): Promise<{ base64: string; type: string; name: string }> {
  const readAsBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { base64: await readAsBase64(file), type: file.type, name: file.name };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode failed");
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { base64: await readAsBase64(blob), type: "image/jpeg", name };
  } catch {
    return { base64: await readAsBase64(file), type: file.type, name: file.name };
  }
}
