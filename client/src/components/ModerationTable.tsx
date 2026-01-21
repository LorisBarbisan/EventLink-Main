import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Rating, useAdminRatings, useModerationAction } from "@/hooks/useRatings";
import { format } from "date-fns";
import { CheckCircle, EyeOff, Flag } from "lucide-react";
import { useState } from "react";

export function ModerationTable() {
  const [filterStatus, setFilterStatus] = useState<string>("flagged");
  const { data: ratings, isLoading } = useAdminRatings(
    filterStatus === "all" ? undefined : filterStatus
  );
  const { mutate: moderateRating, isPending: isModerating } = useModerationAction();

  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [moderationAction, setModerationAction] = useState<
    "remove" | "approve" | "flag" | "restore"
  >("remove");
  const [moderationNotes, setModerationNotes] = useState("");

  const handleActionClick = (rating: Rating, action: "remove" | "approve" | "flag" | "restore") => {
    setSelectedRating(rating);
    setModerationAction(action);
    setModerationNotes("");
    setActionDialogOpen(true);
  };

  const submitModeration = () => {
    if (selectedRating) {
      moderateRating(
        {
          ratingId: selectedRating.id,
          action: moderationAction,
          notes: moderationNotes,
        },
        {
          onSuccess: () => {
            setActionDialogOpen(false);
          },
        }
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "removed":
        return <Badge variant="destructive">Removed</Badge>;
      case "flagged":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Flagged
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
              <SelectItem value="all">All Ratings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reporter / User</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-[300px]">Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!ratings || ratings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No ratings found.
                  </TableCell>
                </TableRow>
              ) : (
                ratings.map(rating => (
                  <TableRow key={rating.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(rating.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {rating.recruiter?.first_name} {rating.recruiter?.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{rating.recruiter?.email}</div>
                    </TableCell>
                    <TableCell>
                      <StarRating rating={rating.rating} readonly size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm italic ">{rating.review || "No review text"}</div>
                      {rating.job_title && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Job: {rating.job_title}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(rating.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {rating.admin_notes}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {rating.status !== "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleActionClick(rating, "restore")}
                            title="Restore"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {rating.status !== "removed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleActionClick(rating, "remove")}
                            title="Remove"
                          >
                            <EyeOff className="w-4 h-4" />
                          </Button>
                        )}
                        {rating.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                            onClick={() => handleActionClick(rating, "flag")}
                            title="Flag"
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationAction === "remove" && "Remove Rating"}
              {moderationAction === "restore" && "Restore Rating"}
              {moderationAction === "flag" && "Flag Rating"}
            </DialogTitle>
            <DialogDescription>
              {moderationAction === "remove" &&
                "This rating will be removed from the freelancer's profile."}
              {moderationAction === "restore" &&
                "This rating will be visible on the freelancer's profile."}
              {moderationAction === "flag" && "Mark this rating for further review."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="notes">Admin Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add internal notes about this action..."
                value={moderationNotes}
                onChange={e => setModerationNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitModeration}
              disabled={isModerating}
              variant={moderationAction === "remove" ? "destructive" : "default"}
            >
              {isModerating ? "Saving..." : "Confirm Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
