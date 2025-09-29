import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UKLocationInput } from '@/components/ui/uk-location-input';
import type { JobFormData } from '@shared/types';

interface JobFormProps {
  initialData?: any; // Job data for editing
  onSubmit: (data: JobFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isEditing?: boolean;
}

export function JobForm({ initialData, onSubmit, onCancel, isSubmitting, isEditing = false }: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({
    title: initialData?.title || '',
    type: initialData?.type || '',
    contract_type: initialData?.contract_type || '',
    location: initialData?.location || '',
    rate: initialData?.rate || '',
    description: initialData?.description || '',
    event_date: initialData?.event_date || '',
    // Initialize duration fields
    duration_type: initialData?.duration_type || '',
    start_time: initialData?.start_time || '',
    end_time: initialData?.end_time || '',
    days: initialData?.days?.toString() || '',
    hours: initialData?.hours?.toString() || '',
  });

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (value: string, locationData?: any) => {
    setFormData(prev => ({ ...prev, location: value }));
  };

  const handleDurationTypeChange = (value: 'time' | 'days' | 'hours') => {
    setFormData(prev => ({ 
      ...prev, 
      duration_type: value,
      // Clear other duration fields when changing type
      start_time: '',
      end_time: '',
      days: '',
      hours: ''
    }));
  };

  const validateDuration = (): boolean => {
    if (!formData.duration_type) return false;
    
    switch (formData.duration_type) {
      case 'time':
        if (!formData.start_time || !formData.end_time) return false;
        // Validate that start time is before end time
        const start = new Date(`2000-01-01T${formData.start_time}`);
        const end = new Date(`2000-01-01T${formData.end_time}`);
        return start < end;
      case 'days':
        const days = parseInt(formData.days);
        return !isNaN(days) && days >= 1;
      case 'hours':
        const hours = parseInt(formData.hours);
        return !isNaN(hours) && hours >= 1;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
    // Reset form only when creating new job
    if (!isEditing) {
      setFormData({
        title: '',
        type: '',
        contract_type: '',
        location: '',
        rate: '',
        description: '',
        event_date: '',
        duration_type: '',
        start_time: '',
        end_time: '',
        days: '',
        hours: '',
      });
    }
  };

  const isValid = formData.title && formData.type && formData.location && formData.rate && formData.description && 
                  formData.event_date && (formData.type !== 'contract' || formData.contract_type) && validateDuration();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Job' : 'Post New Job'}</CardTitle>
        <CardDescription>
          {isEditing 
            ? 'Update your job listing details' 
            : 'Create a new job listing to find the perfect crew member'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Job Type Selection */}
        <div className="max-w-md">
          <Label htmlFor="job-type">Job Type</Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => {
              handleInputChange('type', value);
              if (value !== 'contract') {
                handleInputChange('contract_type', '');
              }
            }}
          >
            <SelectTrigger data-testid="select-job-type">
              <SelectValue placeholder="Select job type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contract-specific fields */}
        {formData.type === 'contract' && (
          <div className="max-w-md">
            <Label htmlFor="contract-type">Contract Type</Label>
            <Select value={formData.contract_type} onValueChange={(value) => handleInputChange('contract_type', value)}>
              <SelectTrigger data-testid="select-contract-type">
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Full Time Contract</SelectItem>
                <SelectItem value="part-time">Part Time Contract</SelectItem>
                <SelectItem value="fixed-term">Fixed-Term Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Rest of the form - only show after job type is selected */}
        {formData.type && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="job-title">Job Title</Label>
                <Input
                  id="job-title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g. Senior Sound Engineer"
                  data-testid="input-job-title"
                />
              </div>
              <div>
                <UKLocationInput
                  id="job-location"
                  label="Location"
                  value={formData.location}
                  onChange={handleLocationChange}
                  placeholder="Start typing a UK location..."
                  data-testid="input-job-location"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="job-rate">
                  {formData.type === 'contract' ? 'Salary' : 'Rate'}
                </Label>
                <Input
                  id="job-rate"
                  value={formData.rate}
                  onChange={(e) => handleInputChange('rate', e.target.value)}
                  placeholder={formData.type === 'contract' ? "£45,000 per year" : "£450 per day"}
                  data-testid="input-job-rate"
                />
              </div>
              <div>
                <Label htmlFor="event-date">Event Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => handleInputChange('event_date', e.target.value)}
                  data-testid="input-event-date"
                />
              </div>
            </div>

            {/* Job Duration Section */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-base font-semibold">Job Duration</Label>
                <p className="text-sm text-gray-600 mb-3">Specify how long this job will take</p>
                
                <RadioGroup 
                  value={formData.duration_type} 
                  onValueChange={handleDurationTypeChange}
                  data-testid="radio-group-duration-type"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="time" id="duration-time" data-testid="radio-duration-time" />
                    <Label htmlFor="duration-time">Start and End Time</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="days" id="duration-days" data-testid="radio-duration-days" />
                    <Label htmlFor="duration-days">Number of Days</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hours" id="duration-hours" data-testid="radio-duration-hours" />
                    <Label htmlFor="duration-hours">Number of Hours</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Conditional Duration Fields */}
              {formData.duration_type === 'time' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => handleInputChange('start_time', e.target.value)}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time">End Time</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => handleInputChange('end_time', e.target.value)}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>
              )}

              {formData.duration_type === 'days' && (
                <div className="max-w-md">
                  <Label htmlFor="duration-days-input">Number of Days</Label>
                  <Input
                    id="duration-days-input"
                    type="number"
                    min="1"
                    value={formData.days}
                    onChange={(e) => handleInputChange('days', e.target.value)}
                    placeholder="e.g., 3"
                    data-testid="input-duration-days"
                  />
                </div>
              )}

              {formData.duration_type === 'hours' && (
                <div className="max-w-md">
                  <Label htmlFor="duration-hours-input">Number of Hours</Label>
                  <Input
                    id="duration-hours-input"
                    type="number"
                    min="1"
                    value={formData.hours}
                    onChange={(e) => handleInputChange('hours', e.target.value)}
                    placeholder="e.g., 8"
                    data-testid="input-duration-hours"
                  />
                </div>
              )}

              {/* Validation Error Messages */}
              {formData.duration_type === 'time' && formData.start_time && formData.end_time && (
                (() => {
                  const start = new Date(`2000-01-01T${formData.start_time}`);
                  const end = new Date(`2000-01-01T${formData.end_time}`);
                  return start >= end ? (
                    <p className="text-sm text-red-600" data-testid="error-time-validation">
                      End time must be after start time
                    </p>
                  ) : null;
                })()
              )}
            </div>

            <div>
              <Label htmlFor="job-description">Job Description</Label>
              <Textarea
                id="job-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the role, requirements, and responsibilities..."
                rows={4}
                data-testid="textarea-job-description"
              />
            </div>
          </>
        )}

        {/* Submit buttons - only show when form is valid */}
        {isValid && (
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-submit-job">
              {isSubmitting ? 'Posting...' : 'Post Job'}
            </Button>
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-job">
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}