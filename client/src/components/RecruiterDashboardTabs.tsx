import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { Building2, MapPin, Globe, Calendar, Users, Briefcase, MessageSquare, Settings, Plus, Edit, Trash2, Coins, Clock } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';

interface RecruiterProfile {
  id: number;
  user_id: number;
  company_name: string;
  contact_name: string;
  company_type: string;
  location: string;
  description: string;
  website_url: string;
  linkedin_url: string;
  company_logo_url: string;
  created_at: string;
  updated_at: string;
}

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  rate: string;
  status: 'active' | 'paused' | 'closed';
  applicants: number;
  posted_date: string;
  description: string;
}

interface Message {
  id: number;
  from: string;
  subject: string;
  content: string;
  time: string;
  unread: boolean;
  type: 'application' | 'inquiry' | 'system';
}

interface Application {
  id: number;
  job_title: string;
  candidate_name: string;
  candidate_email: string;
  applied_date: string;
  status: 'pending' | 'reviewed' | 'rejected' | 'hired';
  rate: string;
  experience: string;
}

export default function RecruiterDashboardTabs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);

  // Form states for profile editing
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  // Job posting form states
  const [jobTitle, setJobTitle] = useState('');
  const [jobType, setJobType] = useState('');
  const [contractType, setContractType] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobRate, setJobRate] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);

  const { data: profile, isLoading } = useQuery<RecruiterProfile>({
    queryKey: ['/api/recruiter', user?.id],
    enabled: !!user?.id,
  });

  // Debug logging
  useEffect(() => {
    console.log('RecruiterDashboardTabs - Profile data:', profile);
    console.log('RecruiterDashboardTabs - Is loading:', isLoading);
    console.log('RecruiterDashboardTabs - User ID:', user?.id);
  }, [profile, isLoading, user?.id]);

  const updateMutation = useMutation({
    mutationFn: async (profileData: any) => {
      return await apiRequest(`/api/recruiter/${user?.id}`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', user?.id] });
      toast({
        title: 'Profile updated',
        description: 'Your company profile has been saved successfully.',
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (profileData: any) => {
      return await apiRequest('/api/recruiter', {
        method: 'POST',
        body: JSON.stringify({ user_id: user?.id, ...profileData }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', user?.id] });
      toast({
        title: 'Profile created',
        description: 'Your company profile has been created successfully.',
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create profile.',
        variant: 'destructive',
      });
    },
  });

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile && profile.company_name) {
      setCompanyName(profile.company_name || '');
      setContactName(profile.contact_name || '');
      setCompanyType(profile.company_type || '');
      setLocation(profile.location || '');
      setDescription(profile.description || '');
      setWebsiteUrl(profile.website_url || '');
      setLinkedinUrl(profile.linkedin_url || '');
      setCompanyLogo(profile.company_logo_url || '');
    }
  }, [profile]);

  const handleSave = () => {
    const profileData = {
      company_name: companyName,
      contact_name: contactName,
      company_type: companyType,
      location,
      description,
      website_url: websiteUrl,
      linkedin_url: linkedinUrl,
      company_logo_url: companyLogo,
    };

    if (profile) {
      updateMutation.mutate(profileData);
    } else {
      createMutation.mutate(profileData);
    }
  };

  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      return await apiRequest('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: 'Job posted',
        description: `${jobTitle} has been posted successfully.`,
      });
      setShowJobForm(false);
      setJobTitle('');
      setJobType('');
      setJobLocation('');
      setJobRate('');
      setJobDescription('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to post job.',
        variant: 'destructive',
      });
    },
  });

  const handleJobPost = () => {
    if (!user?.id || !profile?.company_name) {
      toast({
        title: 'Error',
        description: 'Please complete your company profile first.',
        variant: 'destructive',
      });
      return;
    }

    const jobData = {
      recruiter_id: user.id,
      title: jobTitle,
      company: profile.company_name,
      location: jobLocation,
      type: jobType === 'contract' && contractType ? `${contractType}-contract` : jobType,
      rate: jobRate,
      description: jobDescription,
      status: 'active',
    };

    createJobMutation.mutate(jobData);
  }

  // Reset form when closing
  const resetJobForm = () => {
    setJobTitle('');
    setJobType('');
    setContractType('');
    setJobLocation('');
    setJobRate('');
    setJobDescription('');
    setShowJobForm(false);
  };;

  const { data: myJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs/recruiter', user?.id],
    enabled: !!user?.id,
  });

  const sampleMessages: Message[] = [
    {
      id: 1,
      from: 'Alex Chen',
      subject: 'Application for Senior Sound Engineer',
      content: 'Hi, I\'m interested in the Sound Engineer position. I have 10+ years experience...',
      time: '2 hours ago',
      unread: true,
      type: 'application'
    },
    {
      id: 2,
      from: 'Sarah Williams',
      subject: 'Question about AV Technician role',
      content: 'Could you provide more details about the equipment requirements?',
      time: '1 day ago',
      unread: false,
      type: 'inquiry'
    },
    {
      id: 3,
      from: 'EventCrew System',
      subject: 'Your job posting expires soon',
      content: 'Your Senior Sound Engineer posting will expire in 3 days.',
      time: '2 days ago',
      unread: false,
      type: 'system'
    }
  ];

  const sampleApplications: Application[] = [
    {
      id: 1,
      job_title: 'Senior Sound Engineer',
      candidate_name: 'Alex Chen',
      candidate_email: 'alex.chen@email.com',
      applied_date: '2025-08-03',
      status: 'pending',
      rate: '£400/day',
      experience: '10+ years'
    },
    {
      id: 2,
      job_title: 'Senior Sound Engineer',
      candidate_name: 'Morgan Taylor',
      candidate_email: 'morgan.t@email.com',
      applied_date: '2025-08-02',
      status: 'reviewed',
      rate: '£450/day',
      experience: '8 years'
    },
    {
      id: 3,
      job_title: 'AV Technician',
      candidate_name: 'Jamie Wilson',
      candidate_email: 'jamie.w@email.com',
      applied_date: '2025-08-01',
      status: 'hired',
      rate: '£250/day',
      experience: '5 years'
    }
  ];

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Profile
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            My Jobs
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Messages
            {sampleMessages.filter(m => m.unread).length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {sampleMessages.filter(m => m.unread).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Applications
          </TabsTrigger>
        </TabsList>

        {/* Company Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Company Profile</CardTitle>
                  <CardDescription>
                    Manage your company information and branding
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant={isEditing ? "outline" : "default"}
                  data-testid="button-edit-profile"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <ImageUpload
                      label="Company Logo"
                      value={companyLogo}
                      onChange={setCompanyLogo}
                      placeholder="Upload your company logo"
                      aspectRatio="square"
                      maxSizeMB={2}
                      testId="company-logo-upload"
                    />
                    <div>
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input
                        id="company-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your Company Name"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-name">Contact Name</Label>
                      <Input
                        id="contact-name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Your Full Name"
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-type">Company Type</Label>
                      <Select value={companyType} onValueChange={setCompanyType}>
                        <SelectTrigger data-testid="select-company-type">
                          <SelectValue placeholder="Select company type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event-agency">Event Agency</SelectItem>
                          <SelectItem value="production-company">Production Company</SelectItem>
                          <SelectItem value="venue">Venue</SelectItem>
                          <SelectItem value="corporate">Corporate</SelectItem>
                          <SelectItem value="av-company">AV Company</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, Country"
                        data-testid="input-location"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description">Company Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell us about your company..."
                        rows={4}
                        data-testid="textarea-description"
                      />
                    </div>
                    <div>
                      <Label htmlFor="website">Website URL</Label>
                      <Input
                        id="website"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://yourcompany.com"
                        data-testid="input-website"
                      />
                    </div>
                    <div>
                      <Label htmlFor="linkedin">LinkedIn URL</Label>
                      <Input
                        id="linkedin"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/company/yourcompany"
                        data-testid="input-linkedin"
                      />
                    </div>
                  </div>
                  <div className="col-span-full">
                    <Button 
                      onClick={handleSave}
                      disabled={updateMutation.isPending || createMutation.isPending}
                      className="mr-2"
                      data-testid="button-save-profile"
                    >
                      {updateMutation.isPending || createMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile && profile.company_name ? (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center overflow-hidden">
                          {profile?.company_logo_url ? (
                            <img 
                              src={profile.company_logo_url} 
                              alt={`${profile.company_name} logo`}
                              className="w-full h-full object-cover"
                              data-testid="img-company-logo"
                            />
                          ) : (
                            <Building2 className="w-8 h-8 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold">{profile?.company_name}</h3>
                          <p className="text-muted-foreground">{profile?.contact_name}</p>
                          <Badge variant="secondary" className="mt-1">
                            {profile?.company_type || 'Company'}
                          </Badge>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{profile?.location || 'Location not specified'}</span>
                        </div>
                        {profile.website_url && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                      {profile.description && (
                        <div>
                          <h4 className="font-medium mb-2">About</h4>
                          <p className="text-muted-foreground">{profile.description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Complete Your Company Profile</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your company information to start posting jobs and connecting with freelancers.
                      </p>
                      <Button onClick={() => setIsEditing(true)} data-testid="button-create-profile">
                        Create Profile
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">My Job Postings</h2>
              <p className="text-muted-foreground">Manage your job listings and track applications</p>
            </div>
            <Button onClick={() => setShowJobForm(!showJobForm)} data-testid="button-post-job">
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Button>
          </div>

          {showJobForm && (
            <Card>
              <CardHeader>
                <CardTitle>Post New Job</CardTitle>
                <CardDescription>Create a new job listing to find the perfect crew member</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 1: Job Type Selection */}
                <div className="space-y-4">
                  <div className="max-w-md">
                    <Label htmlFor="job-type">Job Type</Label>
                    <Select value={jobType} onValueChange={(value) => {
                      setJobType(value);
                      setContractType(''); // Reset contract type when job type changes
                    }}>
                      <SelectTrigger data-testid="select-job-type">
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="freelance">Freelance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Step 2: Rest of the form - only show after job type is selected */}
                {jobType && (
                  <>
                    {/* Contract-specific fields */}
                    {jobType === 'contract' && (
                      <div className="space-y-4">
                        <div className="max-w-md">
                          <Label htmlFor="contract-type">Contract Type</Label>
                          <Select value={contractType} onValueChange={setContractType}>
                            <SelectTrigger data-testid="select-contract-type">
                              <SelectValue placeholder="Select contract type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full-time">Full Time Contract</SelectItem>
                              <SelectItem value="part-time">Part Time Contract</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="job-title">Job Title</Label>
                        <Input
                          id="job-title"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="e.g. Senior Sound Engineer"
                          data-testid="input-job-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="job-location">Location</Label>
                        <Input
                          id="job-location"
                          value={jobLocation}
                          onChange={(e) => setJobLocation(e.target.value)}
                          placeholder="City, Country"
                          data-testid="input-job-location"
                        />
                      </div>
                      <div>
                        <Label htmlFor="job-rate">
                          {jobType === 'contract' ? 'Salary' : 'Rate'}
                        </Label>
                        <Input
                          id="job-rate"
                          value={jobRate}
                          onChange={(e) => setJobRate(e.target.value)}
                          placeholder={jobType === 'contract' ? 'e.g. £45,000/year' : 'e.g. £450/day'}
                          data-testid="input-job-rate"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="job-description">Job Description</Label>
                      <Textarea
                        id="job-description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Describe the role, requirements, and responsibilities..."
                        rows={4}
                        data-testid="textarea-job-description"
                      />
                    </div>
                  </>
                )}
                {/* Submit buttons - only show when job type is selected and contract type is selected if contract */}
                {jobType && (jobType !== 'contract' || contractType) && (
                  <div className="flex gap-2">
                    <Button onClick={handleJobPost} data-testid="button-submit-job">
                      Post Job
                    </Button>
                    <Button variant="outline" onClick={resetJobForm} data-testid="button-cancel-job">
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {jobsLoading ? (
              <div className="flex justify-center p-8">Loading jobs...</div>
            ) : myJobs.length > 0 ? (
              myJobs.map((job: any) => (
              <Card key={job.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{job.title}</h3>
                        <Badge variant={job.status === 'active' ? 'default' : job.status === 'paused' ? 'secondary' : 'outline'}>
                          {job.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Coins className="w-4 h-4" />
                          {job.rate}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Posted {new Date(job.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="w-4 h-4" />
                        <span>0 applicants</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" data-testid={`button-edit-job-${job.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-delete-job-${job.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Job Posting</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{job.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Jobs Posted Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by posting your first job to find talented crew members.
                </p>
                <Button onClick={() => setShowJobForm(true)} data-testid="button-post-first-job">
                  Post Your First Job
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Messages</h2>
            <p className="text-muted-foreground">Communication with applicants and freelancers</p>
          </div>

          <div className="space-y-4">
            {sampleMessages.map((message) => (
              <Card key={message.id} className={message.unread ? 'border-blue-200 bg-blue-50/30' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{message.from}</h4>
                        <Badge variant={message.type === 'application' ? 'default' : message.type === 'system' ? 'secondary' : 'outline'}>
                          {message.type}
                        </Badge>
                        {message.unread && <Badge variant="destructive" className="h-2 w-2 p-0"></Badge>}
                      </div>
                      <h5 className="text-sm font-medium mb-2">{message.subject}</h5>
                      <p className="text-sm text-muted-foreground mb-2">{message.content}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {message.time}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`button-reply-${message.id}`}>
                      Reply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Applications</h2>
            <p className="text-muted-foreground">Review and manage job applications</p>
          </div>

          <div className="space-y-4">
            {sampleApplications.map((application) => (
              <Card key={application.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{application.candidate_name}</h4>
                        <Badge variant={
                          application.status === 'hired' ? 'default' :
                          application.status === 'reviewed' ? 'secondary' :
                          application.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {application.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">Applied for: {application.job_title}</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>Rate: {application.rate}</div>
                        <div>Experience: {application.experience}</div>
                        <div>Applied: {application.applied_date}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" data-testid={`button-view-application-${application.id}`}>
                        View Profile
                      </Button>
                      {application.status === 'pending' && (
                        <>
                          <Button size="sm" data-testid={`button-accept-${application.id}`}>
                            Accept
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-reject-${application.id}`}>
                            Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}