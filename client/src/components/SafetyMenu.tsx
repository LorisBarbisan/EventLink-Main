import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, MoreHorizontal, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_CATEGORIES, type ReportCategory } from "@shared/safety";

/**
 * Report or block a person. Neither the reported nor the blocked person is
 * told; the reporter gets a confirmation that the report reached us.
 */
export function SafetyMenu({
  userId,
  name,
  conversationId,
  className,
}: {
  userId: number;
  name: string;
  conversationId?: number;
  className?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [details, setDetails] = useState("");

  const blockKey = [`/api/users/${userId}/block`];
  const { data: blockState } = useQuery<{ blocked: boolean; activeBookings: number }>({
    queryKey: blockKey,
  });

  const report = useMutation({
    mutationFn: () =>
      apiRequest(`/api/users/${userId}/report`, {
        method: "POST",
        body: JSON.stringify({ category, details, conversation_id: conversationId ?? null }),
      }) as Promise<{ message: string }>,
    onSuccess: (r) => {
      setReporting(false);
      setCategory("");
      setDetails("");
      toast({ title: "Report sent", description: r.message });
    },
    onError: (e: Error) =>
      toast({ title: "Couldn't send your report", description: e.message, variant: "destructive" }),
  });

  const toggleBlock = useMutation({
    mutationFn: (block: boolean) =>
      apiRequest(`/api/users/${userId}/block`, { method: block ? "POST" : "DELETE" }) as Promise<{
        blocked: boolean;
        activeBookings?: number;
      }>,
    onSuccess: (r) => {
      setConfirmBlock(false);
      qc.invalidateQueries({ queryKey: blockKey });
      toast({
        title: r.blocked ? `${name} is blocked` : `${name} is unblocked`,
        description: r.blocked
          ? r.activeBookings
            ? "They can't start new conversations with you. Messages about your active booking still come through, so you don't miss call times or site details."
            : "Neither of you can message the other. They aren't told."
          : undefined,
      });
    },
    onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
  });

  const blocked = blockState?.blocked ?? false;
  const active = blockState?.activeBookings ?? 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className} aria-label="More options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setReporting(true)} className="cursor-pointer">
            <Flag className="mr-2 h-4 w-4" /> Report {name}
          </DropdownMenuItem>
          {blocked ? (
            <DropdownMenuItem onClick={() => toggleBlock.mutate(false)} className="cursor-pointer">
              <ShieldCheck className="mr-2 h-4 w-4" /> Unblock
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setConfirmBlock(true)}
              className="cursor-pointer text-destructive"
            >
              <Ban className="mr-2 h-4 w-4" /> Block
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reporting} onOpenChange={setReporting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report {name}</DialogTitle>
            <DialogDescription>
              Reports go to the EventLink team. {name} isn&apos;t told who reported them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
              {REPORT_CATEGORIES.map((c) => (
                <div key={c.value} className="flex items-center gap-2">
                  <RadioGroupItem value={c.value} id={`rc-${c.value}`} />
                  <Label htmlFor={`rc-${c.value}`} className="font-normal">
                    {c.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="space-y-1">
              <Label htmlFor="report-details">What happened? (optional)</Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                maxLength={4000}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If anyone is in immediate danger, call 999 first.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReporting(false)}>
              Cancel
            </Button>
            <Button onClick={() => report.mutate()} disabled={!category || report.isPending}>
              Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Block {name}?</DialogTitle>
            <DialogDescription>
              Neither of you will be able to message the other. {name} isn&apos;t told.
            </DialogDescription>
          </DialogHeader>
          {active > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              You have {active === 1 ? "an active booking" : `${active} active bookings`} with{" "}
              {name}. Messages about {active === 1 ? "it" : "them"} will still come through, so you
              don&apos;t miss call times or site details. If you don&apos;t want to do the job,
              cancel the booking from your bookings, and report anything that worries you.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => toggleBlock.mutate(true)}
              disabled={toggleBlock.isPending}
            >
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
