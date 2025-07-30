import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Building2, Users, Briefcase } from 'lucide-react';

interface Profile {
  id: string;
  role: 'freelancer' | 'recruiter';
  email: string;
}

interface RecruiterProfile {
  id?: string;
  company_name: string;
  contact_name: string;
  company_type: string;
  location: string;
  description: string;
  website_url: string;
  linkedin_url: string;
}

interface RecruiterDashboardProps {
  profile: Profile;
}

export function RecruiterDashboard({ profile }: RecruiterDashboardProps) {
  const { toast } = useToast();
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile>({
    company_name: '',
    contact_name: '',
    company_type: '',
    location: '',
    description: '',
    website_url: '',
    linkedin_url: ''
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRecruiterProfile();
  }, []);

  const fetchRecruiterProfile = async () => {
    try {
      const data = await apiRequest(`/api/recruiter/${profile.id}`);
      
      if (data) {
        setRecruiterProfile(data);
        setHasProfile(true);
      }
    } catch (error: any) {
      // Only show error toast if it's not a "Profile not found" error
      if (error?.message !== "Profile not found" && !error?.message?.includes("404")) {
        console.error('Error fetching recruiter profile:', error);
        toast({
          title: "Error",
          description: "Failed to load your profile",
          variant: "destructive"
        });
      }
      // For 404/not found errors, just continue without profile (new user case)
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const profileData = {
        ...recruiterProfile,
        user_id: profile.id
      };

      if (hasProfile) {
        await apiRequest(`/api/recruiter/${profile.id}`, {
          method: 'PUT',
          body: JSON.stringify(profileData),
        });
      } else {
        await apiRequest('/api/recruiter', {
          method: 'POST',
          body: JSON.stringify(profileData),
        });
        setHasProfile(true);
      }

      toast({
        title: "Success",
        description: "Your profile has been saved"
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save your profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          <span className="bg-gradient-hero bg-clip-text text-transparent">Recruiter Dashboard</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">Manage your company profile and find talented crew</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-6 w-6 text-primary" />
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={recruiterProfile.company_name}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={recruiterProfile.contact_name}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, contact_name: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_type">Company Type</Label>
                <Input
                  id="company_type"
                  value={recruiterProfile.company_type}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, company_type: e.target.value }))}
                  placeholder="e.g., AV Supplier, Venue, Production Company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={recruiterProfile.location}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="City, Country"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Company Description</Label>
              <Textarea
                id="description"
                value={recruiterProfile.description}
                onChange={(e) => setRecruiterProfile(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tell us about your company and the services you provide..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website_url">Website URL</Label>
                <Input
                  id="website_url"
                  value={recruiterProfile.website_url}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, website_url: e.target.value }))}
                  placeholder="https://yourcompany.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  value={recruiterProfile.linkedin_url}
                  onChange={(e) => setRecruiterProfile(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/company/yourcompany"
                />
              </div>
            </div>

            <Button onClick={saveProfile} disabled={saving} className="w-full bg-gradient-primary hover:bg-primary-hover">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-accent/5 to-primary/5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Briefcase className="h-6 w-6 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="h-20 flex flex-col gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/30">
                <Building2 className="h-6 w-6 text-primary" />
                <span>Post New Job</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 border-accent/20 hover:bg-accent/5 hover:border-accent/30">
                <Users className="h-6 w-6 text-accent" />
                <span>Browse Freelancers</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}