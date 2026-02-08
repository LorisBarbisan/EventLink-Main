import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { JobFormData } from "@shared/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface JobFormProps {
  initialData?: any;
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
      type: "freelance",
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
  const hasAdditionalDetails = !!(initialData?.end_date || initialData?.start_time || initialData?.end_time || initialData?.description);
  const [showAdditional, setShowAdditional] = useState(hasAdditionalDetails);

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (value: string, _locationData?: any) => {
    setFormData((prev) => ({ ...prev, location: value }));
  };

  const handleSubmit = (status: "active" | "private") => {
    onSubmit(formData, status);
    if (!isEditing) {
      clearFormData();
    } else {
      clearFormData();
    }
  };

  const isValid =
    formData.title &&
    formData.location &&
    formData.rate &&
    formData.event_date;

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

        <button
          type="button"
          onClick={() => setShowAdditional(!showAdditional)}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
          {showAdditional ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Additional Details (optional)
        </button>

        {showAdditional && (
          <div className="space-y-4 border-t pt-4">
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
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSubmit("private")}
            disabled={isSubmitting || !isValid}
            data-testid="button-save-job"
            className="border-gray-200"
          >
            Save Job
          </Button>

          <Button
            onClick={() => handleSubmit("active")}
            disabled={isSubmitting || !isValid}
            data-testid="button-post-job"
            className="bg-[#EFA068] text-white hover:bg-[#E59058]"
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
