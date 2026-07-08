import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, CheckCircle, Clock, Shield, UserCheck, Mail, Linkedin, LogIn } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface FreelancerInfo {
  freelancerUserId: number;
  firstName: string | null;
  lastName: string | null;
}

interface SavedFormState {
  q1: "yes" | "no" | "";
  q2: string;
  q3: string;
  comment: string;
  refereeName: string;
  refereeOrg: string;
  refereeEmail: string;
  refereeRole: string;
  verifyMethod: "email" | "linkedin" | "eventlink";
}

function getSavedForm(token: string): SavedFormState | null {
  try {
    const raw = sessionStorage.getItem(`ref_form_${token}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSavedForm(token: string) {
  sessionStorage.removeItem(`ref_form_${token}`);
}

export default function ReferencePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const saved = token ? getSavedForm(token) : null;
  const [submitted, setSubmitted] = useState(false);
  const [q1, setQ1] = useState<"yes" | "no" | "">(saved?.q1 || "");
  const [q2, setQ2] = useState(saved?.q2 || "");
  const [q3, setQ3] = useState(saved?.q3 || "");
  const [comment, setComment] = useState(saved?.comment || "");
  const [refereeName, setRefereeName] = useState(
    user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : saved?.refereeName || ""
  );
  const [refereeOrg, setRefereeOrg] = useState(saved?.refereeOrg || "");
  const [refereeEmail, setRefereeEmail] = useState(user?.email || saved?.refereeEmail || "");
  const [refereeRole, setRefereeRole] = useState(saved?.refereeRole || "");
  const [badge, setBadge] = useState<string | null>(null);
  const [verificationType, setVerificationType] = useState<string>("none");
  const [verifyMethod, setVerifyMethod] = useState<"email" | "linkedin" | "eventlink">(
    user ? "eventlink" : saved?.verifyMethod || "email"
  );
  const autoSubmitTriggered = useRef(false);

  const saveFormState = useCallback(() => {
    if (!token) return;
    const state: SavedFormState = {
      q1,
      q2,
      q3,
      comment,
      refereeName,
      refereeOrg,
      refereeEmail,
      refereeRole,
      verifyMethod,
    };
    sessionStorage.setItem(`ref_form_${token}`, JSON.stringify(state));
  }, [
    token,
    q1,
    q2,
    q3,
    comment,
    refereeName,
    refereeOrg,
    refereeEmail,
    refereeRole,
    verifyMethod,
  ]);

  const {
    data: freelancer,
    isLoading,
    error,
  } = useQuery<FreelancerInfo>({
    queryKey: [`/api/references/form/${token}`],
    retry: false,
  });

  const isEventLinkMember = !!user;

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
          referee_email: verifyMethod === "email" ? refereeEmail.trim() || null : null,
          referee_role: refereeRole.trim() || null,
        }),
      });
    },
    onSuccess: (data: any) => {
      if (token) clearSavedForm(token);
      setBadge(data.badge_result);
      setVerificationType(data.verification_type);
      if (verifyMethod === "linkedin" && data.reference_id) {
        window.location.href = `/api/references/linkedin-auth?reference_id=${data.reference_id}`;
        return;
      }
      setSubmitted(true);
    },
  });

  useEffect(() => {
    if (saved && user && !autoSubmitTriggered.current && !submitted && freelancer) {
      autoSubmitTriggered.current = true;
      submitMutation.mutate();
    }
  }, [user, saved, submitted, freelancer]);

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !freelancer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <div className="mb-4 text-4xl">🔗</div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Link not found</h1>
          <p className="text-gray-500">This reference link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (autoSubmitTriggered.current && !submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Submitting your reference...</h1>
          <p className="text-sm text-gray-500">
            You signed in successfully. Submitting your reference now.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const badgeInfo = badge ? badgeLabels[badge] : null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Thank you!</h1>
          <p className="mb-4 text-gray-600">
            Your reference for <strong>{freelancer.firstName}</strong> has been submitted.
          </p>

          {badgeInfo && badge !== "flagged" && (
            <div
              className={`text-sm font-medium ${badgeInfo.color} mb-4 rounded-lg bg-gray-50 px-4 py-2`}
            >
              🏅 {badgeInfo.label}
            </div>
          )}

          {verificationType === "eventlink_member" && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-700">
                <UserCheck className="h-4 w-4" />
                EventLink Member Verified
              </div>
              <p className="mt-1 text-xs text-green-600">
                Your reference is linked to your EventLink profile
              </p>
            </div>
          )}

          {verificationType === "none" && refereeEmail && verifyMethod === "email" && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-700">
                <Mail className="h-4 w-4" />
                Verification Email Sent
              </div>
              <p className="mt-1 text-xs text-blue-600">
                Check your inbox at <strong>{refereeEmail}</strong> to verify your email and
                strengthen this reference
              </p>
            </div>
          )}

          <div className="mt-4 border-t pt-6">
            <p className="mb-3 text-sm text-gray-500">
              You&apos;re already helping build trust in the events industry. EventLink helps
              companies find verified crew faster.
            </p>
            {!isEventLinkMember && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setLocation("/about")}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Learn About EventLink
                </Button>
                <Button
                  onClick={() => setLocation("/auth")}
                  size="sm"
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                >
                  Sign Up as an Employer
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const canSubmit = q1 !== "" && refereeName.trim() !== "" && refereeOrg.trim() !== "";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white">
            <Star className="h-4 w-4 fill-white" />
            EventLink
          </div>
          <div className="mb-2 flex items-center justify-center gap-1.5 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            This will take 45 seconds
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reference for{" "}
            <span className="text-orange-600">
              {freelancer.firstName} {freelancer.lastName}
            </span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Your honest feedback helps build a verified professional reputation.
          </p>
        </div>

        {isEventLinkMember && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <UserCheck className="h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Submitting as EventLink Member</p>
              <p className="text-xs text-green-600">
                Your reference will be linked to your profile for maximum credibility
              </p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="space-y-8 p-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-500">
                Question 1 of 3
              </p>
              <p className="mb-4 font-semibold text-gray-900">
                Can you confirm that <span className="text-orange-600">{firstName}</span> worked
                with you or your organisation?
              </p>
              <RadioGroup value={q1} onValueChange={(v) => setQ1(v as "yes" | "no")}>
                <div
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${q1 === "yes" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <RadioGroupItem value="yes" id="q1-yes" />
                  <Label htmlFor="q1-yes" className="cursor-pointer font-medium">
                    Yes, I can confirm this
                  </Label>
                </div>
                <div
                  className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${q1 === "no" ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <RadioGroupItem value="no" id="q1-no" />
                  <Label htmlFor="q1-no" className="cursor-pointer font-medium">
                    No, I can&apos;t confirm this
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {q1 === "yes" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-500">
                  Question 2 of 3
                </p>
                <p className="mb-4 font-semibold text-gray-900">
                  How would you describe <span className="text-orange-600">{firstName}</span>
                  &apos;s reliability and professionalism?
                </p>
                <RadioGroup value={q2} onValueChange={setQ2}>
                  {[
                    {
                      value: "excellent",
                      label: "⭐⭐⭐⭐⭐ Excellent — I'd hire them again without hesitation",
                    },
                    { value: "good", label: "⭐⭐⭐⭐ Good — solid performer, no major issues" },
                    {
                      value: "mixed",
                      label: "⭐⭐⭐ Mixed — some positives but also some concerns",
                    },
                    { value: "prefer_not_to_say", label: "Would prefer not to say" },
                  ].map((opt) => (
                    <div
                      key={opt.value}
                      className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors first:mt-0 ${q2 === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <RadioGroupItem value={opt.value} id={`q2-${opt.value}`} />
                      <Label htmlFor={`q2-${opt.value}`} className="cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {q1 === "yes" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-500">
                  Question 3 of 3
                </p>
                <p className="mb-4 font-semibold text-gray-900">
                  Would you work with <span className="text-orange-600">{firstName}</span> again?
                </p>
                <RadioGroup value={q3} onValueChange={setQ3}>
                  {[
                    {
                      value: "absolutely",
                      label: "Absolutely — already have / would without hesitation",
                    },
                    { value: "yes", label: "Yes, given the right role" },
                    { value: "unlikely", label: "Unlikely" },
                    { value: "prefer_not_to_say", label: "Prefer not to say" },
                  ].map((opt) => (
                    <div
                      key={opt.value}
                      className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors first:mt-0 ${q3 === opt.value ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <RadioGroupItem value={opt.value} id={`q3-${opt.value}`} />
                      <Label htmlFor={`q3-${opt.value}`} className="cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {q1 === "yes" && (
              <div>
                <p className="mb-1 font-semibold text-gray-900">
                  Anything else you&apos;d like to add about working with{" "}
                  <span className="text-orange-600">{firstName}</span>?{" "}
                  <span className="text-sm font-normal text-gray-400">(Optional)</span>
                </p>
                <p className="mb-3 text-xs text-gray-400">This may be shown on their profile.</p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="A short quote about their work, attitude, or a specific project..."
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
              </div>
            )}

            {q1 !== "" && (
              <div className="border-t pt-6">
                <p className="mb-1 text-sm font-medium text-gray-700">Your details</p>
                <p className="mb-4 text-xs text-gray-400">
                  Required so the recipient knows who this reference is from.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ref-name" className="mb-1 block text-sm text-gray-600">
                      Your name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ref-name"
                      value={refereeName}
                      onChange={(e) => setRefereeName(e.target.value)}
                      placeholder="e.g. Sarah Johnson"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ref-org" className="mb-1 block text-sm text-gray-600">
                      Your organisation <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ref-org"
                      value={refereeOrg}
                      onChange={(e) => setRefereeOrg(e.target.value)}
                      placeholder="e.g. Live Nation"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ref-role" className="mb-1 block text-sm text-gray-600">
                      Your role <span className="text-xs text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      id="ref-role"
                      value={refereeRole}
                      onChange={(e) => setRefereeRole(e.target.value)}
                      placeholder="e.g. Production Manager"
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            )}

            {q1 !== "" && !isEventLinkMember && (
              <div className="border-t pt-6">
                <p className="mb-1 text-sm font-medium text-gray-700">Verify your identity</p>
                <p className="mb-4 text-xs text-gray-400">
                  Verified references carry more weight. Choose how you&apos;d like to verify.
                </p>
                <div className="space-y-2">
                  <div
                    onClick={() => setVerifyMethod("email")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${verifyMethod === "email" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${verifyMethod === "email" ? "border-orange-500" : "border-gray-300"}`}
                    >
                      {verifyMethod === "email" && (
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">Verify by email</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        We&apos;ll send a one-click verification link to your email
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setVerifyMethod("linkedin")}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${verifyMethod === "linkedin" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${verifyMethod === "linkedin" ? "border-orange-500" : "border-gray-300"}`}
                    >
                      {verifyMethod === "linkedin" && (
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                        <span className="text-sm font-medium text-gray-900">
                          Verify with LinkedIn
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Sign in with LinkedIn to attach your professional profile
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      saveFormState();
                      const redirect = encodeURIComponent(`/reference/${token}`);
                      setLocation(`/auth?redirect=${redirect}`);
                    }}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-200 p-3 transition-colors hover:border-gray-300"
                  >
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-gray-300" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <LogIn className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          Sign in to EventLink
                        </span>
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                          Strongest
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Already have an EventLink account? Sign in for maximum credibility
                      </p>
                    </div>
                  </div>
                </div>

                {verifyMethod === "email" && (
                  <div className="mt-4">
                    <Label htmlFor="ref-email" className="mb-1 block text-sm text-gray-600">
                      Your email
                    </Label>
                    <Input
                      id="ref-email"
                      type="email"
                      value={refereeEmail}
                      onChange={(e) => setRefereeEmail(e.target.value)}
                      placeholder="e.g. sarah@livenation.com"
                      maxLength={200}
                    />
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      <Shield className="h-3 w-3" />
                      Your email won&apos;t be displayed publicly.
                    </p>
                  </div>
                )}

                {verifyMethod === "linkedin" && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">
                      After submitting, you&apos;ll be redirected to LinkedIn to verify your
                      identity. Your name will be attached to this reference.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit || submitMutation.isPending}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-base font-semibold text-white hover:from-orange-600 hover:to-amber-600"
            >
              {submitMutation.isPending
                ? "Submitting..."
                : verifyMethod === "linkedin"
                  ? "Submit & Verify with LinkedIn"
                  : "Submit Reference"}
            </Button>
            {submitMutation.isError && (
              <p className="mt-2 text-center text-sm text-red-500">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by <span className="font-medium text-orange-500">EventLink</span> · References are
          securely stored and may appear on the freelancer&apos;s profile.
        </p>
      </div>
    </div>
  );
}
