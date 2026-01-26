import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import type { JobFormData } from "@shared/types";
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
  const [formData, setFormData] = useState<JobFormData>({
    title: initialData?.title || "",
    type: "freelance", // All jobs are freelance/gig work
    location: initialData?.location || "",
    rate: initialData?.rate || "",
    description: initialData?.description || "",
    event_date: initialData?.event_date || "",
    end_date: initialData?.end_date || "",
    start_time: initialData?.start_time || "",
    end_time: initialData?.end_time || "",
  });

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (value: string, _locationData?: any) => {
    setFormData(prev => ({ ...prev, location: value }));
  };

  const handleSubmit = (status: "active" | "private") => {
    onSubmit(formData, status);
    // Reset form only when creating new job
    if (!isEditing) {
      setFormData({
        title: "",
        type: "freelance",
        location: "",
        rate: "",
        description: "",
        event_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
      });
    }
  };

  // Validation: title, location, rate, description, and event_date (start date) are mandatory
  const isValid =
    formData.title &&
    formData.location &&
    formData.rate &&
    formData.description &&
    formData.event_date;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Job" : "Post New Job"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your job listing details"
            : "Create a new gig listing to find the perfect crew member"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="job-title">Job Title *</Label>
            <Input
              id="job-title"
              value={formData.title}
              onChange={e => handleInputChange("title", e.target.value)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="job-rate">Rate *</Label>
            <Input
              id="job-rate"
              value={formData.rate}
              onChange={e => handleInputChange("rate", e.target.value)}
              placeholder="£450 per day"
              data-testid="input-job-rate"
            />
          </div>
          <div>
            <Label htmlFor="start-date">Start Date *</Label>
            <Input
              id="start-date"
              type="date"
              value={formData.event_date}
              onChange={e => handleInputChange("event_date", e.target.value)}
              data-testid="input-start-date"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="end-date">End Date (Optional)</Label>
            <Input
              id="end-date"
              type="date"
              value={formData.end_date}
              onChange={e => handleInputChange("end_date", e.target.value)}
              data-testid="input-end-date"
            />
          </div>
        </div>

        {/* Optional Time Fields */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <Label className="text-base font-semibold">Time (Optional)</Label>
            <p className="text-sm text-gray-600 mb-3">Specify start and end times if applicable</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={formData.start_time}
                onChange={e => handleInputChange("start_time", e.target.value)}
                data-testid="input-start-time"
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={formData.end_time}
                onChange={e => handleInputChange("end_time", e.target.value)}
                data-testid="input-end-time"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="job-description">Job Description *</Label>
          <Textarea
            id="job-description"
            value={formData.description}
            onChange={e => handleInputChange("description", e.target.value)}
            placeholder="Describe the role, requirements, and responsibilities..."
            rows={4}
            data-testid="textarea-job-description"
          />
        </div>

        {/* Submit buttons */}
        <div className="flex gap-2">
          {/* Save Job Button - Makes it Private */}
          <Button
            variant="secondary"
            onClick={() => handleSubmit("private")}
            disabled={isSubmitting || !isValid}
            data-testid="button-save-job"
            className="border-gray-200"
          >
            {isEditing ? "Save Job" : "Save Job"}
          </Button>

          {/* Post Job Button - Makes it Active/Public */}
          <Button
            onClick={() => handleSubmit("active")}
            disabled={isSubmitting || !isValid}
            data-testid="button-post-job"
            className="bg-[#EFA068] hover:bg-[#E59058] text-white"
          >
            {isSubmitting ? "Posting..." : isEditing ? "Post Job" : "Post Job"}
          </Button>

          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-job">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
