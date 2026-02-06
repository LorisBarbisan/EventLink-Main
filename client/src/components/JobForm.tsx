import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { JobFormData } from "@shared/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface JobFormProps {
  initialData?: any; // Job data for editing
  onSubmit: (data: JobFormData, status: "active" | "private") => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditing?: boolean;
}

export function JobForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  isEditing = false,
}: JobFormProps) {
  const persistenceKey = isEditing && initialData?.id ? `job_edit_${initialData.id}` : "job_new";

  const [formData, setFormData, clearFormData, isDirty] = usePersistentState<JobFormData>(
    persistenceKey,
    {
      title: initialData?.title || "",
      type: "freelance", // All jobs are freelance/gig work
      location: initialData?.location || "",
      rate: initialData?.rate || "",
      description: initialData?.description || "",
      event_date: initialData?.event_date || "",
      end_date: initialData?.end_date || "",
      start_time: initialData?.start_time || "",
      end_time: initialData?.end_time || "",
    }
  );

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showOptional, setShowOptional] = useState(
    isEditing && (initialData?.end_date || initialData?.start_time || initialData?.end_time || initialData?.description)
  );

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (value: string, _locationData?: any) => {
    setFormData((prev) => ({ ...prev, location: value }));
  };

  const handleSubmit = (status: "active" | "private") => {
    onSubmit(formData, status);
    // Reset form only when creating new job
    if (!isEditing) {
      clearFormData();
    } else {
      clearFormData(); // Also clear edit draft on success
    }
  };

  const isValid =
    formData.title &&
    formData.location &&
    formData.rate &&
    formData.event_date;

  const hasOptionalData = formData.end_date || formData.start_time || formData.end_time || formData.description;

  return (
    <Card>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={() => {
          clearFormData();
          setShowConfirmDialog(false);
          onCancel();
        }}
        onCancel={() => setShowConfirmDialog(false)}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them and leave?"
      />
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Job" : "Post New Job"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your job listing details"
            : "Create a new gig listing to find the perfect crew member"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="job-title">Job Title *</Label>
            <Input
              id="job-title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="e.g. Senior Sound Engineer"
              data-testid="input-job-title"
            />
          </div>
          <div>
            <UKLocationInput
              id="job-location"
              label="Location *"
              value={formData.location}
              onChange={handleLocationChange}
              placeholder="Start typing a UK location..."
              data-testid="input-job-location"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="job-rate">Rate * (£)</Label>
            <Input
              id="job-rate"
              value={formData.rate}
              onChange={(e) => handleInputChange("rate", e.target.value)}
              placeholder="450"
              data-testid="input-job-rate"
            />
          </div>
          <div>
            <Label htmlFor="start-date">Start Date *</Label>
            <Input
              id="start-date"
              type="date"
              value={formData.event_date}
              onChange={(e) => handleInputChange("event_date", e.target.value)}
              data-testid="input-start-date"
            />
          </div>
        </div>

        <Collapsible open={showOptional} onOpenChange={setShowOptional}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 w-full py-3 px-4 mt-2 rounded-md text-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`} />
              Additional Details (optional) {hasOptionalData && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">has content</span>}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange("end_date", e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange("start_time", e.target.value)}
                  data-testid="input-start-time"
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange("end_time", e.target.value)}
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="job-description">Job Description</Label>
              <Textarea
                id="job-description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe the role, requirements, and responsibilities..."
                rows={4}
                data-testid="textarea-job-description"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSubmit("private")}
            disabled={isSubmitting || !isValid}
            data-testid="button-save-job"
            className={isValid ? "border border-gray-400 text-foreground font-semibold" : "opacity-40 border-gray-200"}
          >
            Save Job
          </Button>

          <Button
            onClick={() => handleSubmit("active")}
            disabled={isSubmitting || !isValid}
            data-testid="button-post-job"
            className={isValid ? "bg-[#EFA068] text-white hover:bg-[#E59058] font-semibold" : "bg-[#EFA068]/40 text-white/70"}
          >
            {isSubmitting ? "Posting..." : "Post Job"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (isDirty) {
                setShowConfirmDialog(true);
              } else {
                onCancel();
              }
            }}
            data-testid="button-cancel-job"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
