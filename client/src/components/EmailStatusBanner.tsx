import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * Shown when email to the signed-in person's address is failing (a hard
 * bounce or a spam complaint reported by our email provider). Until they
 * clear it, EventLink stops emailing them — so without this they'd never know.
 */
export function EmailStatusBanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ suppressed: boolean; reason: string | null }>({
    queryKey: ["/api/me/email-status"],
    enabled: !!user,
  });
  const reset = useMutation({
    mutationFn: () => apiRequest("/api/me/email-status/reset", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/email-status"] });
      toast({ title: "We'll start emailing you again" });
    },
  });
  if (!data?.suppressed) return null;
  const complaint = data.reason === "spam_complaint";
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
              them. You&apos;ll miss hire notifications and reminders. Check the address is right
              and the mailbox isn&apos;t full.
            </>
          )}
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => reset.mutate()}
        disabled={reset.isPending}
      >
        {complaint ? "Email me again" : "It's fixed — try again"}
      </Button>
    </div>
  );
}
