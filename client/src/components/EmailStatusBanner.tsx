import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const CHANGE_ERRORS: Record<string, string> = {
  invalid: "That link has expired or was already used. Ask for a new one from Settings.",
  email_taken: "Another account now uses that address, so we kept your old one.",
  failed: "We couldn't change your address. Try again from Settings.",
};

/**
 * Shown when email to the signed-in person's address is failing (a hard
 * bounce or a spam complaint reported by our email provider). Until they
 * clear it, EventLink stops emailing them — so without this they'd never know.
 * Also reports the result of opening an email-change confirmation link.
 */
export function EmailStatusBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{
    suppressed: boolean;
    reason: string | null;
    pendingEmail: string | null;
  }>({
    queryKey: ["/api/me/email-status"],
    enabled: !!user,
  });
  const reset = useMutation({
    mutationFn: () => apiRequest("/api/me/email-status/reset", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/email-status"] });
      toast({ title: "We'll start emailing you again" });
    },
    onError: (err: unknown) => {
      toast({
        title: "Not this time",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  // Landing here from the confirmation link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const changed = params.get("email_changed");
    const failed = params.get("email_change_error");
    if (!changed && !failed) return;
    if (changed) {
      toast({
        title: "Email address changed",
        description: "We'll use your new address from now on.",
      });
      // A full page load from the email link, so the session (and the
      // address shown everywhere) is already fresh
      qc.invalidateQueries({ queryKey: ["/api/me/email-status"] });
    } else {
      toast({
        title: "Email address not changed",
        description: CHANGE_ERRORS[failed!] ?? CHANGE_ERRORS.failed,
        variant: "destructive",
      });
    }
    params.delete("email_changed");
    params.delete("email_change_error");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
  }, [qc, toast]);

  if (!data?.suppressed) return null;
  const complaint = data.reason === "spam_complaint";
  const social = !!user?.auth_provider && user.auth_provider !== "email";
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {complaint ? (
            <>
              An email from us to <strong>{user?.email}</strong> was marked as spam, so we&apos;ve
              stopped emailing you. You&apos;ll miss hire notifications and reminders.
            </>
          ) : (
            <>
              Emails to <strong>{user?.email}</strong> are bouncing, so we&apos;ve stopped sending
              them. You&apos;ll miss hire notifications and reminders.{" "}
              {social
                ? "If the address is wrong, contact support to change it."
                : "If the address is wrong or no longer works, change it."}
            </>
          )}
          {data.pendingEmail && (
            <>
              {" "}
              We&apos;ve sent a link to <strong>{data.pendingEmail}</strong> — open it to switch.
            </>
          )}
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!complaint && !social && (
          <ChangeEmailDialog
            trigger={
              <Button size="sm" variant="outline">
                Change address
              </Button>
            }
          />
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          {complaint ? "Email me again" : "It's fixed — try again"}
        </Button>
      </div>
    </div>
  );
}
