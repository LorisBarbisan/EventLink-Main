import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, DollarSign, Calendar, Globe, Linkedin, ExternalLink, User, Building2 } from 'lucide-react';

interface FreelancerProfile {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  location: string;
  hourly_rate: number | null;
  experience_years: number | null;
  skills: string[];
  portfolio_url: string;
  linkedin_url: string;
  website_url: string;
  availability_status: 'available' | 'busy' | 'unavailable';
}

interface RecruiterProfile {
  id: string;
  company_name: string;
  contact_name: string;
  company_type: string;
  location: string;
  description: string;
  website_url: string;
  linkedin_url: string;
}

interface UserProfile {
  role: 'freelancer' | 'recruiter';
  email: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    try {
      // First get the user's basic profile
      const userData = await apiRequest(`/api/user/${userId}`);
      
      setUserProfile({
        role: userData.role as 'freelancer' | 'recruiter',
        email: userData.email
      });

      // Then get the specific profile based on role
      if (userData.role === 'freelancer') {
        try {
          const freelancerData = await apiRequest(`/api/freelancer/${userId}`);
          if (freelancerData) {
            setFreelancerProfile({
              ...freelancerData,
              availability_status: freelancerData.availability_status as 'available' | 'busy' | 'unavailable'
            });
          }
        } catch (error) {
          // Profile doesn't exist yet
        }
      } else {
        try {
          const recruiterData = await apiRequest(`/api/recruiter/${userId}`);
          if (recruiterData) {
            setRecruiterProfile(recruiterData);
          }
        } catch (error) {
          // Profile doesn't exist yet
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'unavailable': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!userProfile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
            <p className="text-muted-foreground">This user profile doesn't exist or is not available.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (userProfile.role === 'freelancer' && freelancerProfile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center overflow-hidden">
                      {((freelancerProfile as any).profile_photo_url && 
                        (freelancerProfile as any).profile_photo_url.trim() !== '' && 
                        (freelancerProfile as any).profile_photo_url !== 'null' && 
                        (freelancerProfile as any).profile_photo_url.startsWith('data:')) ? (
                        <img 
                          src={(freelancerProfile as any).profile_photo_url} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">
                        {freelancerProfile.first_name} {freelancerProfile.last_name}
                      </CardTitle>
                      <p className="text-xl text-muted-foreground">{freelancerProfile.title}</p>
                      {freelancerProfile.location && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-1">
                          <MapPin className="h-4 w-4" />
                          <span>{freelancerProfile.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${getAvailabilityColor(freelancerProfile.availability_status)}`}></div>
                    <Badge variant="outline" className="capitalize">
                      {freelancerProfile.availability_status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {freelancerProfile.bio && (
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground">{freelancerProfile.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {freelancerProfile.hourly_rate && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span>£{freelancerProfile.hourly_rate}/hour</span>
                    </div>
                  )}
                  {freelancerProfile.experience_years && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{freelancerProfile.experience_years} years experience</span>
                    </div>
                  )}
                </div>

                {freelancerProfile.skills.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {freelancerProfile.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  {freelancerProfile.portfolio_url && (
                    <Button variant="outline" asChild>
                      <a href={freelancerProfile.portfolio_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Portfolio
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                  {freelancerProfile.linkedin_url && (
                    <Button variant="outline" asChild>
                      <a href={freelancerProfile.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                  {freelancerProfile.website_url && (
                    <Button variant="outline" asChild>
                      <a href={freelancerProfile.website_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (userProfile.role === 'recruiter' && recruiterProfile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{recruiterProfile.company_name}</CardTitle>
                    <p className="text-xl text-muted-foreground">{recruiterProfile.company_type}</p>
                    {recruiterProfile.contact_name && (
                      <p className="text-muted-foreground">Contact: {recruiterProfile.contact_name}</p>
                    )}
                    {recruiterProfile.location && (
                      <div className="flex items-center gap-1 text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4" />
                        <span>{recruiterProfile.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {recruiterProfile.description && (
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground">{recruiterProfile.description}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  {recruiterProfile.website_url && (
                    <Button variant="outline" asChild>
                      <a href={recruiterProfile.website_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        Website
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                  {recruiterProfile.linkedin_url && (
                    <Button variant="outline" asChild>
                      <a href={recruiterProfile.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Incomplete</h1>
          <p className="text-muted-foreground">This user hasn't completed their profile yet.</p>
        </div>
      </div>
    </Layout>
  );
}