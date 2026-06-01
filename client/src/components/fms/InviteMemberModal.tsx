import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, UserPlus } from "lucide-react";
import { Link } from "wouter";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberModal({ open, onOpenChange }: InviteMemberModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager">("manager");
  const [seatError, setSeatError] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/team/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      toast({ title: `Invitation sent to ${email}` });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setEmail("");
      setRole("manager");
      setSeatError(null);
      onOpenChange(false);
    },
    onError: async (err: any) => {
      let body: any = {};
      try {
        body = await err.response?.json();
      } catch {}
      if (body?.error === "SEAT_LIMIT_REACHED") {
        setSeatError(body.message ?? "Seat limit reached.");
      } else if (body?.error === "User is already a team member") {
        toast({ title: "This person is already on your team", variant: "destructive" });
      } else {
        toast({ title: "Failed to send invitation", variant: "destructive" });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-orange-500" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Invite a colleague to join your team on EventLink FMS.
          </DialogDescription>
        </DialogHeader>

        {seatError ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              {seatError} <Link href="/pricing" className="underline font-medium">Upgrade</Link> to add more members.
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setSeatError(null); onOpenChange(false); }}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as "admin" | "manager")} className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-orange-300 transition-colors">
                  <RadioGroupItem value="admin" id="role-admin" className="mt-0.5" />
                  <div>
                    <Label htmlFor="role-admin" className="font-medium cursor-pointer">Admin</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Can manage team members and company profile
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-orange-300 transition-colors">
                  <RadioGroupItem value="manager" id="role-manager" className="mt-0.5" />
                  <div>
                    <Label htmlFor="role-manager" className="font-medium cursor-pointer">Manager</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Can manage bookings, enquiries, and briefs
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600"
                disabled={!email || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
