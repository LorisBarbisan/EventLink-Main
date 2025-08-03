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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, DollarSign, Calendar, Plus, X, UserCheck, Camera, Upload, MessageCircle, Briefcase, BookOpen, CheckCircle, Clock, AlertCircle, Send, Mail, Phone } from 'lucide-react';

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
  profile_photo_url?: string;
}

interface FreelancerDashboardTabsProps {
  profile: Profile;
}

export function FreelancerDashboardTabs({ profile }: FreelancerDashboardTabsProps) {
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
    availability_status: 'available',
    profile_photo_url: ''
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    fetchFreelancerProfile();
  }, []);

  const fetchFreelancerProfile = async () => {
    try {
      const data = await apiRequest(`/api/freelancer/${profile.id}`);
      
      if (data) {
        console.log('Profile loaded, photo URL length:', data.profile_photo_url ? data.profile_photo_url.length : 0);
        setFreelancerProfile({
          id: data.id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          title: data.title || '',
          bio: data.bio || '',
          location: data.location || '',
          hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
          rate_type: data.rate_type || 'hourly',
          experience_years: data.experience_years || null,
          skills: data.skills || [],
          portfolio_url: data.portfolio_url || '',
          linkedin_url: data.linkedin_url || '',
          website_url: data.website_url || '',
          availability_status: data.availability_status || 'available',
          profile_photo_url: data.profile_photo_url || ''
        });
        setHasProfile(true);
      }
    } catch (error) {
      console.log('No existing profile found, starting fresh');
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        user_id: parseInt(profile.id),
        first_name: freelancerProfile.first_name,
        last_name: freelancerProfile.last_name,
        title: freelancerProfile.title,
        bio: freelancerProfile.bio,
        location: freelancerProfile.location,
        hourly_rate: freelancerProfile.hourly_rate,
        rate_type: freelancerProfile.rate_type,
        experience_years: freelancerProfile.experience_years,
        skills: freelancerProfile.skills,
        portfolio_url: freelancerProfile.portfolio_url,
        linkedin_url: freelancerProfile.linkedin_url,
        website_url: freelancerProfile.website_url,
        availability_status: freelancerProfile.availability_status,
        profile_photo_url: freelancerProfile.profile_photo_url
      };

      console.log('Saving profile with photo URL length:', payload.profile_photo_url ? payload.profile_photo_url.length : 0);

      if (hasProfile) {
        await apiRequest(`/api/freelancer/${profile.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast({
          title: 'Profile updated successfully!',
          description: 'Your freelancer profile has been updated.',
        });
      } else {
        await apiRequest('/api/freelancer', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setHasProfile(true);
        toast({
          title: 'Profile created successfully!',
          description: 'Your freelancer profile has been created.',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error saving profile',
        description: 'There was an error saving your profile. Please try again.',
        variant: 'destructive',
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

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image under 5MB.',
          variant: 'destructive',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Resize to max 400x400 while maintaining aspect ratio
          const maxSize = 400;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('Compressed image size:', compressedDataUrl.length, 'characters');
          
          setFreelancerProfile(prev => ({
            ...prev,
            profile_photo_url: compressedDataUrl
          }));
          
          toast({
            title: 'Photo uploaded successfully!',
            description: 'Your profile photo has been updated. Remember to save your profile.',
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  // Sample data for demonstration
  const sampleMessages = [
    {
      id: 1,
      sender: 'EventCorp Ltd',
      subject: 'Sound Engineer Position - Corporate Event',
      preview: 'We have an exciting opportunity for a sound engineer...',
      time: '2 hours ago',
      unread: true
    },
    {
      id: 2,
      sender: 'TechConf 2024',
      subject: 'AV Specialist Required',
      preview: 'Looking for an experienced AV specialist for our upcoming...',
      time: '1 day ago',
      unread: false
    },
    {
      id: 3,
      sender: 'Production Plus',
      subject: 'Re: Lighting Designer Inquiry',
      preview: 'Thank you for your interest. We would like to discuss...',
      time: '3 days ago',
      unread: false
    }
  ];

  const sampleJobs = [
    {
      id: 1,
      title: 'Sound Engineer - Corporate Conference',
      company: 'EventCorp Ltd',
      location: 'London, UK',
      date: 'March 15-17, 2024',
      rate: '£450/day',
      status: 'applied'
    },
    {
      id: 2,
      title: 'AV Technician - Product Launch',
      company: 'TechConf 2024',
      location: 'Manchester, UK',
      date: 'March 22, 2024',
      rate: '£350/day',
      status: 'shortlisted'
    },
    {
      id: 3,
      title: 'Lighting Designer - Fashion Show',
      company: 'Fashion Week Events',
      location: 'Birmingham, UK',
      date: 'April 5-7, 2024',
      rate: '£500/day',
      status: 'available'
    }
  ];

  const sampleBookings = [
    {
      id: 1,
      event: 'Corporate Annual Meeting',
      client: 'EventCorp Ltd',
      date: 'March 15-17, 2024',
      location: 'London ExCeL',
      role: 'Lead Sound Engineer',
      rate: '£450/day',
      status: 'confirmed'
    },
    {
      id: 2,
      event: 'Product Launch Event',
      client: 'Innovation Corp',
      date: 'February 28, 2024',
      location: 'Manchester Convention Centre',  
      role: 'AV Specialist',
      rate: '£400/day',
      status: 'completed'
    },
    {
      id: 3,
      event: 'Tech Conference 2024',
      client: 'TechEvents UK',
      date: 'April 10-12, 2024',
      location: 'Birmingham NEC',
      role: 'Technical Director',
      rate: '£550/day',
      status: 'pending'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                  {(freelancerProfile.profile_photo_url && 
                    freelancerProfile.profile_photo_url.trim() !== '' && 
                    freelancerProfile.profile_photo_url !== 'null' && 
                    freelancerProfile.profile_photo_url.startsWith('data:')) ? (
                    <img 
                      src={freelancerProfile.profile_photo_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {hasProfile ? `${freelancerProfile.first_name} ${freelancerProfile.last_name}` : 'Welcome to EventCrew'}
                  </CardTitle>
                  <p className="text-muted-foreground">
                    {hasProfile ? freelancerProfile.title : 'Let\'s create your freelancer profile'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${
                  freelancerProfile.availability_status === 'available' ? 'bg-green-500' :
                  freelancerProfile.availability_status === 'busy' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <Badge variant="outline" className="capitalize">
                  {freelancerProfile.availability_status}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabbed Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Edit Profile
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Messages
              <Badge variant="secondary" className="ml-1 text-xs">3</Badge>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Bookings
            </TabsTrigger>
          </TabsList>

          {/* Edit Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Hidden file input */}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Profile Photo Section */}
                <div className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                    {(freelancerProfile.profile_photo_url && 
                      freelancerProfile.profile_photo_url.trim() !== '' && 
                      freelancerProfile.profile_photo_url !== 'null' && 
                      freelancerProfile.profile_photo_url.startsWith('data:')) ? (
                      <img 
                        src={freelancerProfile.profile_photo_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById('photo-upload')?.click()}
                        className="text-xs"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {freelancerProfile.profile_photo_url ? 'Change' : 'Upload'}
                      </Button>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">Profile Photo</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload a professional headshot to make your profile stand out. This will be visible to recruiters and on your public profile.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Recommended: Square image, at least 400x400 pixels
                      </p>
                    </div>
                  </div>
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="availability_status">Availability Status</Label>
                  <Select 
                    value={freelancerProfile.availability_status} 
                    onValueChange={(value: 'available' | 'busy' | 'unavailable') => setFreelancerProfile(prev => ({ ...prev, availability_status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={saveProfile} disabled={saving} className="w-full bg-gradient-primary hover:bg-primary-hover">
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleMessages.map((message) => (
                    <div key={message.id} className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${message.unread ? 'border-primary bg-primary/5' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-semibold ${message.unread ? 'text-primary' : ''}`}>
                              {message.sender}
                            </h4>
                            {message.unread && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                          </div>
                          <h5 className="font-medium mb-1">{message.subject}</h5>
                          <p className="text-sm text-muted-foreground">{message.preview}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {message.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t">
                  <Button className="bg-gradient-primary hover:bg-primary-hover">
                    <Send className="h-4 w-4 mr-2" />
                    Compose Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Available Jobs & Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleJobs.map((job) => (
                    <div key={job.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{job.title}</h4>
                            <Badge 
                              variant={job.status === 'applied' ? 'default' : 
                                     job.status === 'shortlisted' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {job.status === 'applied' ? 'Applied' : 
                               job.status === 'shortlisted' ? 'Shortlisted' : 'Available'}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {job.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {job.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {job.rate}
                              </span>
                            </div>
                            <p className="font-medium text-foreground">{job.company}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {job.status === 'available' && (
                            <Button size="sm" className="bg-gradient-primary hover:bg-primary-hover">
                              Apply Now
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  My Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleBookings.map((booking) => (
                    <div key={booking.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{booking.event}</h4>
                            <Badge 
                              variant={booking.status === 'confirmed' ? 'default' : 
                                     booking.status === 'completed' ? 'secondary' : 'outline'}
                              className={`text-xs ${booking.status === 'confirmed' ? 'bg-green-600' : ''}`}
                            >
                              <div className="flex items-center gap-1">
                                {booking.status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
                                {booking.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                                {booking.status === 'pending' && <Clock className="h-3 w-3" />}
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </div>
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {booking.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {booking.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {booking.rate}
                              </span>
                            </div>
                            <p className="font-medium text-foreground">{booking.client}</p>
                            <p className="text-primary font-medium">{booking.role}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Mail className="h-4 w-4 mr-1" />
                            Contact
                          </Button>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}