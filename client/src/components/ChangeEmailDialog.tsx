import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/**
 * Change the account's email address. Nothing changes until the person opens
 * the link we send to the new address; their password is asked for so a
 * borrowed or stolen session can't move the account.
 */
export function ChangeEmailDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const change = useMutation({
    mutationFn: () =>
      apiRequest("/api/me/email", { method: "POST", body: JSON.stringify({ email, password }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/email-status"] });
      toast({
        title: "Check your new inbox",
        description: `We've sent a link to ${email.trim()}. Your address changes when you open it.`,
      });
      setOpen(false);
      setEmail("");
      setPassword("");
      setError(null);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message.replace(/^[0-9]+:\s*/, "") : "Try again.");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your email address</DialogTitle>
          <DialogDescription>
            We&apos;ll send a link to the new address. Until you open it, we keep using your current
            one.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            change.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="change-email-new">New email address</Label>
            <Input
              id="change-email-new"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="change-email-password">Your password</Label>
            <Input
              id="change-email-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={change.isPending || !email || !password}>
              {change.isPending ? "Sending link…" : "Send confirmation link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
