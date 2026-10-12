import { Layout } from "@/components/Layout";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  useFreelancerAverageRating,
  useFreelancerRatings,
  useReportRating,
} from "@/hooks/useRatings";
import { format } from "date-fns";
import { Award, Calendar, Flag, Star, TrendingUp } from "lucide-react";
import { useState } from "react";

export function RatingDashboard() {
  const { user } = useAuth();
  const { data: ratings = [], isLoading: ratingsLoading } = useFreelancerRatings(user?.id || 0);
  const { data: averageRating } = useFreelancerAverageRating(user?.id || 0);

  const [reportOpen, setReportOpen] = useState(false);
  const [selectedRatingId, setSelectedRatingId] = useState<number | null>(null);
  const [reportFlag, setReportFlag] = useState("");
  const [reportNote, setReportNote] = useState("");
  const { mutate: reportRating, isPending: isReporting } = useReportRating();

  const handleReportClick = (ratingId: number) => {
    setSelectedRatingId(ratingId);
    setReportFlag("");
    setReportNote("");
    setReportOpen(true);
  };

  const submitReport = () => {
    if (selectedRatingId && reportFlag) {
      const fullReason = reportNote ? `${reportFlag}: ${reportNote}` : reportFlag;
      reportRating(
        { ratingId: selectedRatingId, reason: fullReason },
        {
          onSuccess: () => {
            setReportOpen(false);
          },
        }
      );
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <p>Please log in to view your ratings.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (user.role !== "freelancer") {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <p>This page is only available for freelancers.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">My Ratings</h1>
            <p className="text-muted-foreground">Track your performance ratings from employers</p>
          </div>
        </div>

        {/* Rating Overview */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {averageRating && averageRating.count > 0 ? (
                  <>
                    <div className="text-2xl font-bold">{averageRating.average}</div>
                    <StarRating rating={Math.round(averageRating.average)} readonly size="sm" />
                  </>
                ) : (
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {averageRating?.count || 0} total ratings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageRating?.count || 0}</div>
              <p className="text-xs text-muted-foreground">From completed projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Latest Rating</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {ratings.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold">{ratings[0].rating}</div>
                    <StarRating rating={ratings[0].rating} readonly size="sm" />
                  </>
                ) : (
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {ratings.length > 0
                  ? format(new Date(ratings[0].created_at), "dd MMM yyyy")
                  : "No ratings yet"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Individual Ratings */}
        <Card>
          <CardHeader>
            <CardTitle>Rating History</CardTitle>
            <p className="text-sm text-muted-foreground">All ratings received from employers</p>
          </CardHeader>
          <CardContent>
            {ratingsLoading ? (
              <div className="py-8 text-center">
                <p>Loading ratings...</p>
              </div>
            ) : ratings.length === 0 ? (
              <div className="py-8 text-center">
                <Star className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No ratings yet</h3>
                <p className="mb-4 text-muted-foreground">
                  Complete projects and get hired to receive ratings from employers.
                </p>
                <p className="text-sm text-muted-foreground">
                  You can also request ratings from employers for completed work.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating, index) => (
                  <div key={rating.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <StarRating rating={rating.rating} readonly size="sm" />
                          <Badge variant="outline">{rating.rating}/5</Badge>
                        </div>

                        <div className="space-y-1">
                          <p className="font-medium">{rating.job_title || "Project"}</p>
                          <p className="text-sm text-muted-foreground">
                            Rated by{" "}
                            {rating.recruiter.first_name && rating.recruiter.last_name
                              ? `${rating.recruiter.first_name} ${rating.recruiter.last_name}`
                              : "Employer"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(rating.created_at), "dd MMMM yyyy • HH:mm")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 text-right">
                        {rating.review && (
                          <div className="flex max-w-[300px] flex-col items-end">
                            <span className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Review
                            </span>
                            <span className="text-sm font-medium italic text-foreground">
                              &quot;{rating.review}&quot;
                            </span>
                          </div>
                        )}
                        <div className="border-l border-border/50 pl-4 text-3xl font-bold text-yellow-600">
                          {rating.rating}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      {rating.review && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2 text-muted-foreground hover:text-destructive"
                          onClick={() => handleReportClick(rating.id)}
                        >
                          <Flag className="h-3 w-3" />
                          <span className="text-xs">Report Review</span>
                        </Button>
                      )}
                    </div>

                    {index < ratings.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating Tips */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Improve Your Ratings</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800">
            <ul className="space-y-2 text-sm">
              <li>• Communicate clearly and professionally with employers</li>
              <li>• Deliver work on time and meet project requirements</li>
              <li>• Be responsive to feedback and willing to make revisions</li>
              <li>• Maintain a positive attitude throughout the project</li>
              <li>• Request ratings from employers after successful project completion</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Review</DialogTitle>
            <DialogDescription>
              Please provide a reason for reporting this review. We investigate all reports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="flag-reason">Reason</Label>
              <Select value={reportFlag} onValueChange={setReportFlag}>
                <SelectTrigger id="flag-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="abusive_language">Abusive Language</SelectItem>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="fake_review">Fake Review</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Add additional details..."
                value={reportNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setReportNote(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReport}
              disabled={!reportFlag || isReporting}
              variant="destructive"
            >
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
