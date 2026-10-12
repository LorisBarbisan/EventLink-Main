import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ExternalLink,
  RefreshCw,
  MapPin,
  PoundSterling,
  Calendar,
  Building2,
  Settings,
} from "lucide-react";

interface ExternalJobsSectionProps {
  showInJobsPage?: boolean;
}

export default function ExternalJobsSection({ showInJobsPage = false }: ExternalJobsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showExternalJobs, setShowExternalJobs] = useState(true);

  // Fetch external jobs
  const { data: externalJobs = [], isLoading: externalJobsLoading } = useQuery({
    queryKey: ["/api/jobs/external"],
    queryFn: async () => {
      const response = await fetch("/api/jobs/external");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    enabled: showExternalJobs,
  });

  // Sync external jobs mutation
  const syncExternalJobsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/jobs/sync-external", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/external"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Jobs synced",
        description: "Latest jobs from Reed and Adzuna have been fetched.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync external jobs. Check API credentials.",
        variant: "destructive",
      });
    },
  });

  const handleSyncJobs = () => {
    syncExternalJobsMutation.mutate();
  };

  if (!showInJobsPage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            External Job Platforms
          </CardTitle>
          <CardDescription>
            Automatically fetch and display jobs from other platforms like Reed, Indeed, and Adzuna
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="external-jobs-toggle">Show External Jobs</Label>
              <p className="text-sm text-muted-foreground">
                Display jobs from Reed and Adzuna alongside your posted jobs
              </p>
            </div>
            <Switch
              id="external-jobs-toggle"
              checked={showExternalJobs}
              onCheckedChange={setShowExternalJobs}
            />
          </div>

          {showExternalJobs && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Sync External Jobs</h4>
                  <p className="text-sm text-muted-foreground">
                    Fetch latest events and AV jobs from external platforms
                  </p>
                </div>
                <Button
                  onClick={handleSyncJobs}
                  disabled={syncExternalJobsMutation.isPending}
                  size="sm"
                  data-testid="button-sync-external-jobs"
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${syncExternalJobsMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {syncExternalJobsMutation.isPending ? "Syncing..." : "Sync Jobs"}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  Current external jobs: <strong>{externalJobs.length}</strong>
                </p>
                <p className="mt-1">
                  API Setup Required: Add Reed API key and Adzuna credentials to sync jobs.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!showExternalJobs) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">External Job Platforms</h3>
          <p className="text-sm text-muted-foreground">
            Jobs from Reed, Adzuna and other platforms - apply directly on their websites
          </p>
        </div>
        <Button
          onClick={handleSyncJobs}
          disabled={syncExternalJobsMutation.isPending}
          size="sm"
          variant="outline"
          data-testid="button-refresh-external-jobs"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${syncExternalJobsMutation.isPending ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {externalJobsLoading ? (
        <div className="flex justify-center p-8">
          <div className="text-muted-foreground">Loading external jobs...</div>
        </div>
      ) : externalJobs.length > 0 ? (
        <div className="grid gap-4">
          {externalJobs.map((job: any) => (
            <Card key={job.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {job.external_source}
                      </Badge>
                    </div>

                    <div className="mb-3 grid grid-cols-1 gap-4 text-sm text-muted-foreground md:grid-cols-3">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {job.company}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <PoundSterling className="h-4 w-4" />
                        {job.rate}
                      </div>
                    </div>

                    <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">
                      {job.description}
                    </p>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Posted:{" "}
                      {job.posted_date || new Date(job.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>

                  <div className="ml-4">
                    <Button asChild size="sm" data-testid={`button-apply-external-${job.id}`}>
                      <a
                        href={job.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        Apply on {job.external_source}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No External Jobs Found</h3>
            <p className="mb-4 text-muted-foreground">
              Configure API credentials and sync to display jobs from Reed and Adzuna.
            </p>
            <Button onClick={handleSyncJobs} disabled={syncExternalJobsMutation.isPending}>
              {syncExternalJobsMutation.isPending ? "Syncing..." : "Sync External Jobs"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
