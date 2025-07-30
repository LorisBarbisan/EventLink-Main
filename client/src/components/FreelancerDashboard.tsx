import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, DollarSign, Calendar, Plus, X, UserCheck } from 'lucide-react';

interface Profile {
  id: string;
  role: 'freelancer' | 'recruiter';
  email: string;
}

interface FreelancerProfile {
  id?: string;
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  location: string;
  hourly_rate: number | null;
  rate_type: 'hourly' | 'daily';
  experience_years: number | null;
  skills: string[];
  portfolio_url: string;
  linkedin_url: string;
  website_url: string;
  availability_status: 'available' | 'busy' | 'unavailable';
}

interface FreelancerDashboardProps {
  profile: Profile;
}

export function FreelancerDashboard({ profile }: FreelancerDashboardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile>({
    first_name: '',
    last_name: '',
    title: '',
    bio: '',
    location: '',
    hourly_rate: null,
    rate_type: 'hourly',
    experience_years: null,
    skills: [],
    portfolio_url: '',
    linkedin_url: '',
    website_url: '',
    availability_status: 'available'
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    fetchFreelancerProfile();
  }, []);

  const fetchFreelancerProfile = async () => {
    try {
      const data = await apiRequest(`/api/freelancer/${profile.id}`);
      
      if (data) {
        setFreelancerProfile({
          ...data,
          availability_status: data.availability_status as 'available' | 'busy' | 'unavailable'
        });
        setHasProfile(true);
      }
    } catch (error) {
      console.error('Error fetching freelancer profile:', error);
      toast({
        title: "Error",
        description: "Failed to load your profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const profileData = {
        ...freelancerProfile,
        user_id: profile.id
      };

      if (hasProfile) {
        await apiRequest(`/api/freelancer/${profile.id}`, {
          method: 'PUT',
          body: JSON.stringify(profileData),
        });
      } else {
        await apiRequest('/api/freelancer', {
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

  const addSkill = () => {
    if (newSkill.trim() && !freelancerProfile.skills.includes(newSkill.trim())) {
      setFreelancerProfile(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFreelancerProfile(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const viewProfile = () => {
    setLocation(`/profile/${profile.id}`);
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">
            <span className="bg-gradient-hero bg-clip-text text-transparent">Freelancer Dashboard</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage your professional profile and grow your career</p>
        </div>
        {hasProfile && (
          <Button onClick={viewProfile} variant="outline" className="border-primary/20 hover:bg-primary/5">
            <User className="h-4 w-4 mr-2" />
            View Public Profile
          </Button>
        )}
      </div>

      <Card className="border-border/50 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserCheck className="h-6 w-6 text-primary" />
            Professional Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={freelancerProfile.first_name}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={freelancerProfile.last_name}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Your last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Professional Title</Label>
            <Input
              id="title"
              value={freelancerProfile.title}
              onChange={(e) => setFreelancerProfile(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Sound Engineer, Lighting Technician, AV Specialist"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={freelancerProfile.bio}
              onChange={(e) => setFreelancerProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us about your experience and expertise..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={freelancerProfile.location}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="rate">Rate (£)</Label>
                <Select 
                  value={freelancerProfile.rate_type} 
                  onValueChange={(value: 'hourly' | 'daily') => setFreelancerProfile(prev => ({ ...prev, rate_type: value }))}
                >
                  <SelectTrigger className="w-20 h-6 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                id="rate"
                type="number"
                value={freelancerProfile.hourly_rate || ''}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, hourly_rate: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder={freelancerProfile.rate_type === 'hourly' ? '50' : '400'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience_years">Years of Experience</Label>
              <Input
                id="experience_years"
                type="number"
                value={freelancerProfile.experience_years || ''}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, experience_years: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill"
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
              />
              <Button onClick={addSkill} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {freelancerProfile.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {skill}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => removeSkill(skill)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio_url">Portfolio URL</Label>
              <Input
                id="portfolio_url"
                value={freelancerProfile.portfolio_url}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, portfolio_url: e.target.value }))}
                placeholder="https://yourportfolio.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={freelancerProfile.linkedin_url}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                value={freelancerProfile.website_url}
                onChange={(e) => setFreelancerProfile(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          <Button onClick={saveProfile} disabled={saving} className="w-full bg-gradient-primary hover:bg-primary-hover">
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}