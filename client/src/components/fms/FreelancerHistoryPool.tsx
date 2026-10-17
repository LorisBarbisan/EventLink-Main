import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Briefcase, Clock, Search, RefreshCw, BookmarkPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface HistoryEntry {
  freelancerId: number;
  firstName: string;
  lastName: string;
  email: string;
  title: string | null;
  skills: string[];
  profilePhotoUrl: string | null;
  location: string | null;
  bookingCount: number;
  lastBookedAt: string;
  isSaved: boolean;
  avgRating: number | null;
  ratingCount: number;
  latestRating: { rating: number; review: string | null } | null;
  privateNotes: { note: string; date: string }[];
  statusBreakdown: { completed: number; confirmed: number; cancelled: number };
}

interface Props {
  onRehire: (freelancerId: number, name: string) => void;
}

export function FreelancerHistoryPool({ onRehire }: Props) {
  const [search, setSearch] = useState("");

  const { data: pool = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ["/api/fms/history-pool"],
    queryFn: () => apiRequest("/api/fms/history-pool"),
  });

  const filtered = pool.filter((entry) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      `${entry.firstName} ${entry.lastName}`.toLowerCase().includes(q) ||
      (entry.title ?? "").toLowerCase().includes(q) ||
      entry.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (pool.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No booking history yet</h3>
          <p className="max-w-md text-muted-foreground">
            Every freelancer you hire through EventLink will appear here with their full booking
            record, your private notes, and a one-click re-hire button.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, title or skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry) => (
          <Card key={entry.freelancerId} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                {entry.profilePhotoUrl ? (
                  <img
                    src={entry.profilePhotoUrl}
                    alt={`${entry.firstName} ${entry.lastName}`}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-semibold text-orange-600">
                    {entry.firstName[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {entry.firstName} {entry.lastName}
                  </p>
                  {entry.title && (
                    <p className="truncate text-sm text-muted-foreground">{entry.title}</p>
                  )}
                  {entry.location && (
                    <p className="truncate text-xs text-muted-foreground">{entry.location}</p>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{entry.bookingCount} booking{entry.bookingCount !== 1 ? "s" : ""}</span>
                </div>
                {entry.avgRating !== null && (
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-medium">{entry.avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({entry.ratingCount})</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(entry.lastBookedAt), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Status breakdown */}
              {entry.bookingCount > 1 && (
                <div className="flex gap-1.5 text-xs">
                  {entry.statusBreakdown.completed > 0 && (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      {entry.statusBreakdown.completed} completed
                    </Badge>
                  )}
                  {entry.statusBreakdown.cancelled > 0 && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      {entry.statusBreakdown.cancelled} cancelled
                    </Badge>
                  )}
                </div>
              )}

              {/* Skills */}
              {entry.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.skills.slice(0, 4).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {entry.skills.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{entry.skills.length - 4}
                    </Badge>
                  )}
                </div>
              )}

              {/* Latest private note */}
              {entry.privateNotes.length > 0 && (
                <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Your note: </span>
                  {entry.privateNotes[0].note.slice(0, 100)}
                  {entry.privateNotes[0].note.length > 100 ? "…" : ""}
                </div>
              )}

              {/* Latest review */}
              {!entry.privateNotes.length && entry.latestRating?.review && (
                <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Your review: </span>
                  {entry.latestRating.review.slice(0, 100)}
                  {entry.latestRating.review.length > 100 ? "…" : ""}
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={() =>
                    onRehire(entry.freelancerId, `${entry.firstName} ${entry.lastName}`)
                  }
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Re-hire
                </Button>
                {!entry.isSaved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await apiRequest("/api/saved-freelancers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ freelancerId: entry.freelancerId }),
                      });
                    }}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="py-8 text-center text-muted-foreground">
          No results for &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );
}
