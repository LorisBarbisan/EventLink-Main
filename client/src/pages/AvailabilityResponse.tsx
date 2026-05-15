import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, CalendarDays, Clock, MapPin, Briefcase, DollarSign, AlertCircle } from "lucide-react";

type ResponseValue = "yes" | "no" | "maybe" | null;

interface TokenData {
  response: {
    id: number;
    response: ResponseValue;
    respondedAt: string | null;
    responseNote: string | null;
  };
  enquiry: {
    id: number;
    eventTitle: string;
    eventDate: string;
    eventEndDate: string | null;
    callTime: string | null;
    venueAddress: string | null;
    roleRequired: string | null;
    agreedRate: string | null;
    additionalNotes: string | null;
    status: string;
  };
  freelancer: { firstName: string };
}

const RESPONSE_LABELS: Record<string, string> = {
  yes: "Yes, I'm available",
  no: "Not available",
  maybe: "Maybe / Need more info",
};

// ── Confirmation page (/availability/responded) ───────────
function RespondedPage() {
  const [searchParams] = typeof window !== "undefined"
    ? [new URLSearchParams(window.location.search)]
    : [new URLSearchParams()];
  const r = searchParams.get("r") as ResponseValue;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-[#D8690E] to-[#ff8c42] px-6 py-5">
        <h1 className="text-2xl font-bold text-white text-center">EventLink</h1>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <CheckCircle className="mb-5 h-16 w-16 text-green-500" />
        <h2 className="mb-2 text-2xl font-bold">Response recorded</h2>
        {r && (
          <p className="mb-4 text-lg text-muted-foreground">
            <span className="font-medium text-foreground">{RESPONSE_LABELS[r] ?? r}</span> — we've
            let the employer know.
          </p>
        )}
        <p className="text-sm text-muted-foreground">You can close this page.</p>
        <div className="mt-10 text-xs text-muted-foreground">
          EventLink — The UK Events Industry Network
        </div>
      </main>
    </div>
  );
}

// ── Main response page (/availability/respond/:token) ─────
export default function AvailabilityResponse() {
  const [location] = useLocation();

  // Handle the confirmation-only route
  if (location === "/availability/responded" || location.startsWith("/availability/responded?")) {
    return <RespondedPage />;
  }

  return <ResponseForm />;
}

function ResponseForm() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const searchParams = new URLSearchParams(window.location.search);
  const oneClickR = searchParams.get("r") as ResponseValue;

  const [data, setData] = useState<TokenData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [selected, setSelected] = useState<ResponseValue>(null);
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "pending" | "done">("idle");
  const [confirmedResponse, setConfirmedResponse] = useState<ResponseValue>(null);

  // Fetch token details
  useEffect(() => {
    if (!token) return;
    fetch(`/api/enquiries/respond/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: TokenData) => {
        setData(d);
        setLoadState("ready");
        // If already responded, pre-fill selected
        if (d.response.response) setSelected(d.response.response);
      })
      .catch(() => setLoadState("error"));
  }, [token]);

  // One-click from email: auto-submit
  useEffect(() => {
    if (loadState !== "ready" || !oneClickR || submitState !== "idle") return;
    if (!["yes", "no", "maybe"].includes(oneClickR)) return;
    submitResponse(oneClickR, undefined, true);
  }, [loadState]);

  async function submitResponse(
    response: ResponseValue,
    noteText?: string,
    redirect = false
  ) {
    if (!response) return;
    setSubmitState("pending");
    try {
      const res = await fetch(`/api/enquiries/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, note: noteText }),
      });
      if (!res.ok) throw new Error("failed");
      setConfirmedResponse(response);
      setSubmitState("done");
      if (redirect) {
        window.location.href = `/availability/responded?r=${response}`;
      }
    } catch {
      setSubmitState("idle");
    }
  }

  // ── Loading ──────────────────────────────────────────────
  if (loadState === "loading" || (oneClickR && submitState === "pending")) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-gradient-to-r from-[#D8690E] to-[#ff8c42] px-6 py-5">
          <h1 className="text-2xl font-bold text-white text-center">EventLink</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
          <p className="text-muted-foreground">Loading event details…</p>
        </main>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (loadState === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-gradient-to-r from-[#D8690E] to-[#ff8c42] px-6 py-5">
          <h1 className="text-2xl font-bold text-white text-center">EventLink</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-xl font-bold">This link has expired or is invalid</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            If you received an availability check, please contact the employer directly.
          </p>
        </main>
      </div>
    );
  }

  // ── Confirmed / done ─────────────────────────────────────
  if (submitState === "done" && confirmedResponse) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-gradient-to-r from-[#D8690E] to-[#ff8c42] px-6 py-5">
          <h1 className="text-2xl font-bold text-white text-center">EventLink</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <CheckCircle className="mb-5 h-16 w-16 text-green-500" />
          <h2 className="mb-2 text-2xl font-bold">Response recorded</h2>
          <p className="mb-4 text-lg text-muted-foreground">
            <span className="font-medium text-foreground">
              {RESPONSE_LABELS[confirmedResponse]}
            </span>{" "}
            — we've let the employer know.
          </p>
          <p className="text-sm text-muted-foreground">You can close this page.</p>
          <div className="mt-10 text-xs text-muted-foreground">
            EventLink — The UK Events Industry Network
          </div>
        </main>
      </div>
    );
  }

  const { enquiry, freelancer } = data!;
  const alreadyResponded = !!data!.response.response;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-[#D8690E] to-[#ff8c42] px-6 py-5">
        <h1 className="text-2xl font-bold text-white text-center">EventLink</h1>
      </header>

      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {/* Already-responded notice */}
        {alreadyResponded && (
          <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            You already responded:{" "}
            <Badge className="ml-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
              {RESPONSE_LABELS[data!.response.response!] ?? data!.response.response}
            </Badge>
            <span className="ml-1 text-amber-700">— you can change it below.</span>
          </div>
        )}

        {/* Greeting */}
        <h2 className="mb-5 text-xl font-bold">
          Hi {freelancer.firstName}, are you available for this event?
        </h2>

        {/* Event details card */}
        <div className="mb-6 rounded-lg border bg-white overflow-hidden shadow-sm">
          <div className="bg-orange-50 px-4 py-3 border-b">
            <h3 className="font-semibold text-base">{enquiry.eventTitle}</h3>
          </div>
          <div className="divide-y text-sm">
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Date" value={enquiry.eventDate} />
            {enquiry.callTime && (
              <DetailRow icon={<Clock className="h-4 w-4" />} label="Call time" value={enquiry.callTime} />
            )}
            {enquiry.venueAddress && (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label="Venue" value={enquiry.venueAddress} />
            )}
            {enquiry.roleRequired && (
              <DetailRow icon={<Briefcase className="h-4 w-4" />} label="Role" value={enquiry.roleRequired} />
            )}
            {enquiry.agreedRate && (
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Rate" value={enquiry.agreedRate} />
            )}
          </div>
          {enquiry.additionalNotes && (
            <div className="px-4 py-3 border-t bg-blue-50 text-sm text-blue-800">
              {enquiry.additionalNotes}
            </div>
          )}
        </div>

        {/* Response buttons — stacked for mobile-first */}
        <div className="flex flex-col gap-3 mb-4">
          <Button
            size="lg"
            className={`w-full justify-start gap-3 text-base font-semibold ${
              selected === "yes"
                ? "bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-300"
                : "bg-green-600 hover:bg-green-700 text-white opacity-90"
            }`}
            onClick={() => setSelected("yes")}
            disabled={submitState === "pending"}
          >
            ✓ Yes, I'm available
          </Button>
          <Button
            size="lg"
            className={`w-full justify-start gap-3 text-base font-semibold ${
              selected === "maybe"
                ? "bg-orange-500 hover:bg-orange-600 text-white ring-2 ring-orange-300"
                : "bg-orange-500 hover:bg-orange-600 text-white opacity-90"
            }`}
            onClick={() => setSelected("maybe")}
            disabled={submitState === "pending"}
          >
            ? Maybe / I need more info
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className={`w-full justify-start gap-3 text-base font-semibold ${
              selected === "no" ? "ring-2 ring-gray-400" : ""
            }`}
            onClick={() => setSelected("no")}
            disabled={submitState === "pending"}
          >
            <XCircle className="h-5 w-5" /> Not available
          </Button>
        </div>

        {/* Optional note (always shown when maybe is selected, also available for others) */}
        {selected === "maybe" && (
          <div className="mb-4">
            <Textarea
              placeholder="Add a note for the employer (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full"
            />
          </div>
        )}

        {/* Submit button */}
        {selected && (
          <Button
            size="lg"
            className="w-full bg-[#1E3A5F] hover:bg-[#152d4a] text-white text-base font-semibold"
            disabled={submitState === "pending"}
            onClick={() => submitResponse(selected, note || undefined)}
          >
            {submitState === "pending" && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Confirm: {RESPONSE_LABELS[selected]}
          </Button>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-white">
        EventLink — The UK Events Industry Network
      </footer>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
