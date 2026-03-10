import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, CheckCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FreelancerInfo {
  freelancerUserId: number;
  firstName: string | null;
  lastName: string | null;
}

export default function ReferencePage() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [q1, setQ1] = useState<"yes" | "no" | "">("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [comment, setComment] = useState("");
  const [refereeName, setRefereeName] = useState("");
  const [refereeOrg, setRefereeOrg] = useState("");
  const [badge, setBadge] = useState<string | null>(null);

  const { data: freelancer, isLoading, error } = useQuery<FreelancerInfo>({
    queryKey: [`/api/references/form/${token}`],
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/references/submit/${token}`, {
        method: "POST",
        body: JSON.stringify({
          q1_confirmed: q1 === "yes",
          q2_rating: q2 || null,
          q3_would_work_again: q3 || null,
          comment: comment.trim() || null,
          referee_name: refereeName.trim() || null,
          referee_organisation: refereeOrg.trim() || null,
        }),
      });
    },
    onSuccess: (data: any) => {
      setBadge(data.badge_result);
      setSubmitted(true);
    },
  });

  const firstName = freelancer?.firstName || "this person";

  const badgeLabels: Record<string, { label: string; color: string }> = {
    highly_recommended: { label: "Verified & Highly Recommended", color: "text-green-600" },
    recommended: { label: "Verified & Recommended", color: "text-green-600" },
    work_history_confirmed: { label: "Work History Confirmed", color: "text-blue-600" },
    verified_private: { label: "Work History Confirmed", color: "text-blue-600" },
    flagged: { label: "Reference Received", color: "text-gray-600" },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !freelancer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link not found</h1>
          <p className="text-gray-500">This reference link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const badgeInfo = badge ? badgeLabels[badge] : null;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h1>
          <p className="text-gray-600 mb-4">
            Your reference for <strong>{freelancer.firstName}</strong> has been submitted.
          </p>
          {badgeInfo && badge !== "flagged" && (
            <div className={`text-sm font-medium ${badgeInfo.color} bg-gray-50 rounded-lg py-2 px-4`}>
              🏅 {badgeInfo.label}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            This reference will appear on their EventLink profile.
          </p>
        </div>
      </div>
    );
  }

  const canSubmit = q1 !== "";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Star className="w-4 h-4 fill-white" />
            EventLink
          </div>
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 mb-2">
            <Clock className="w-4 h-4" />
            This will take 45 seconds
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reference for{" "}
            <span className="text-orange-600">{freelancer.firstName} {freelancer.lastName}</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your honest feedback helps build a verified professional reputation.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 space-y-8">
            {/* Q1 */}
            <div>
              <p className="text-xs uppercase tracking-wider text-orange-500 font-semibold mb-2">Question 1 of 3</p>
              <p className="font-semibold text-gray-900 mb-4">
                Can you confirm that{" "}
                <span className="text-orange-600">{firstName}</span>{" "}
                worked with you or your organisation?
              </p>
              <RadioGroup value={q1} onValueChange={(v) => setQ1(v as "yes" | "no")}>
                <div className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${q1 === "yes" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <RadioGroupItem value="yes" id="q1-yes" />
                  <Label htmlFor="q1-yes" className="cursor-pointer font-medium">Yes, I can confirm this</Label>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mt-2 ${q1 === "no" ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <RadioGroupItem value="no" id="q1-no" />
                  <Label htmlFor="q1-no" className="cursor-pointer font-medium">No, I can't confirm this</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Q2 — only shown if Q1 = yes */}
            {q1 === "yes" && (
              <div>
                <p className="text-xs uppercase tracking-wider text-orange-500 font-semibold mb-2">Question 2 of 3</p>
                <p className="font-semibold text-gray-900 mb-4">
                  How would you describe{" "}
                  <span className="text-orange-600">{firstName}</span>'s reliability and professionalism?
                </p>
                <RadioGroup value={q2} onValueChange={setQ2}>
                  {[
                    { value: "excellent", label: "⭐⭐⭐⭐⭐ Excellent — I'd hire them again without hesitation" },
                    { value: "good", label: "⭐⭐⭐⭐ Good — solid performer, no major issues" },
                    { value: "mixed", label: "⭐⭐⭐ Mixed — some positives but also some concerns" },
                    { value: "prefer_not_to_say", label: "Would prefer not to say" },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mt-2 first:mt-0 ${q2 === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <RadioGroupItem value={opt.value} id={`q2-${opt.value}`} />
                      <Label htmlFor={`q2-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Q3 — only shown if Q1 = yes */}
            {q1 === "yes" && (
              <div>
                <p className="text-xs uppercase tracking-wider text-orange-500 font-semibold mb-2">Question 3 of 3</p>
                <p className="font-semibold text-gray-900 mb-4">
                  Would you work with{" "}
                  <span className="text-orange-600">{firstName}</span> again?
                </p>
                <RadioGroup value={q3} onValueChange={setQ3}>
                  {[
                    { value: "absolutely", label: "Absolutely — already have / would without hesitation" },
                    { value: "yes", label: "Yes, given the right role" },
                    { value: "unlikely", label: "Unlikely" },
                    { value: "prefer_not_to_say", label: "Prefer not to say" },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors mt-2 first:mt-0 ${q3 === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <RadioGroupItem value={opt.value} id={`q3-${opt.value}`} />
                      <Label htmlFor={`q3-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Optional comment — shown if Q1 = yes */}
            {q1 === "yes" && (
              <div>
                <p className="font-semibold text-gray-900 mb-1">
                  Anything else you'd like to add about working with{" "}
                  <span className="text-orange-600">{firstName}</span>?{" "}
                  <span className="font-normal text-gray-400 text-sm">(Optional)</span>
                </p>
                <p className="text-xs text-gray-400 mb-3">This may be shown on their profile.</p>
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="A short quote about their work, attitude, or a specific project…"
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
              </div>
            )}

            {/* Referee details */}
            {q1 !== "" && (
              <div className="border-t pt-6">
                <p className="text-sm font-medium text-gray-700 mb-4">Your details <span className="text-gray-400 font-normal">(optional — adds credibility)</span></p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ref-name" className="text-sm text-gray-600 mb-1 block">Your name</Label>
                    <Input
                      id="ref-name"
                      value={refereeName}
                      onChange={e => setRefereeName(e.target.value)}
                      placeholder="e.g. Sarah Johnson"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ref-org" className="text-sm text-gray-600 mb-1 block">Your organisation</Label>
                    <Input
                      id="ref-org"
                      value={refereeOrg}
                      onChange={e => setRefereeOrg(e.target.value)}
                      placeholder="e.g. Live Nation UK"
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="px-6 pb-6">
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit || submitMutation.isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 rounded-xl text-base"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Reference"}
            </Button>
            {submitMutation.isError && (
              <p className="text-red-500 text-sm text-center mt-2">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-medium text-orange-500">EventLink</span> · References are securely stored and may appear on the freelancer's profile.
        </p>
      </div>
    </div>
  );
}
