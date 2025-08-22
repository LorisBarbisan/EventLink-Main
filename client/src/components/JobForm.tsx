import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JobFormData } from '@shared/types';

interface JobFormProps {
  onSubmit: (data: JobFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function JobForm({ onSubmit, onCancel, isSubmitting }: JobFormProps) {
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    type: '',
    contract_type: '',
    location: '',
    rate: '',
    description: '',
  });

  const handleInputChange = (field: keyof JobFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
    // Reset form
    setFormData({
      title: '',
      type: '',
      contract_type: '',
      location: '',
      rate: '',
      description: '',
    });
  };

  const isValid = formData.title && formData.type && formData.location && formData.rate && formData.description &&
                  (formData.type !== 'contract' || formData.contract_type);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post New Job</CardTitle>
        <CardDescription>Create a new job listing to find the perfect crew member</CardDescription>
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
                <Label htmlFor="job-location">Location</Label>
                <Input
                  id="job-location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="City, Country"
                  data-testid="input-job-location"
                />
              </div>
            </div>

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