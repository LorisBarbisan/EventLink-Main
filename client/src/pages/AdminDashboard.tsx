import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  UserCheck,
  Briefcase,
  FileText,
  Calendar,
  ChevronRight,
  Shield,
  Mail
} from 'lucide-react';
import { AdminGuard } from '@/components/AdminGuard';
import { Layout } from '@/components/Layout';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { trackAdminEvent, trackAdminAnalytics } from '@/lib/analytics';

interface FeedbackItem {
  id: number;
  feedback_type: 'malfunction' | 'feature-missing' | 'suggestion' | 'other';
  message: string;
  status: 'pending' | 'in_review' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  page_url?: string;
  source?: 'header' | 'popup';
  user_name?: string;
  user_email?: string;
  created_at: string;
  admin_response?: string;
  user?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'pending' | 'replied' | 'resolved';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter' | 'admin';
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  auth_provider: string;
  last_login_at?: string;
  created_at: string;
}

interface AnalyticsData {
  users: {
    total: number;
    freelancers: number;
    recruiters: number;
    verified: number;
    thisMonth: number;
  };
  jobs: {
    total: number;
    active: number;
    thisMonth: number;
  };
  applications: {
    total: number;
    applied: number;
    hired: number;
    thisMonth: number;
  };
}

function AdminDashboardContent() {
  const { toast } = useToast();
  const { user } = useOptimizedAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [feedbackFilters, setFeedbackFilters] = useState({
    status: 'all',
    type: 'all'
  });
  
  // Contact message reply state
  const [selectedContactMessage, setSelectedContactMessage] = useState<ContactMessage | null>(null);
  const [contactReply, setContactReply] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  // Admin management state
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Track Google Analytics when tab changes
  useEffect(() => {
    trackAdminAnalytics(activeTab);
  }, [activeTab]);

  // Analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/analytics/overview'],
    queryFn: () => apiRequest('/api/admin/analytics/overview'),
    retry: 1,
  });

  // Feedback query
  const { data: feedbackData, isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery({
    queryKey: ['/api/admin/feedback', feedbackFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (feedbackFilters.status !== 'all') params.append('status', feedbackFilters.status);
      if (feedbackFilters.type !== 'all') params.append('type', feedbackFilters.type);
      
      return await apiRequest(`/api/admin/feedback?${params.toString()}`);
    },
    retry: 1,
  });

  // Feedback stats query
  const { data: feedbackStats } = useQuery({
    queryKey: ['/api/admin/feedback/stats'],
    queryFn: () => apiRequest('/api/admin/feedback/stats'),
    retry: 1,
  });

  // Users query
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: () => apiRequest('/api/admin/users'),
    retry: 1,
  });

  // Admin users query
  const { data: adminUsers, isLoading: adminUsersLoading, refetch: refetchAdminUsers } = useQuery({
    queryKey: ['/api/admin/users/admins'],
    queryFn: () => apiRequest('/api/admin/users/admins'),
    retry: 1,
  });

  // Contact messages query
  const { data: contactMessages, isLoading: contactMessagesLoading } = useQuery<ContactMessage[]>({
    queryKey: ['/api/admin/contact-messages'],
    queryFn: () => apiRequest('/api/admin/contact-messages'),
    retry: 1,
  });

  const updateFeedbackStatus = async (id: number, status: string) => {
    try {
      await apiRequest(`/api/admin/feedback/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      toast({
        title: 'Status Updated',
        description: 'Feedback status has been updated successfully.',
      });
      
      refetchFeedback();
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update feedback status.',
        variant: 'destructive',
      });
    }
  };

  const submitAdminResponse = async (id: number) => {
    if (!adminResponse.trim()) return;
    
    try {
      await apiRequest(`/api/admin/feedback/${id}/response`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: adminResponse }),
      });
      
      toast({
        title: 'Response Added',
        description: 'Your response has been added to the feedback.',
      });
      
      setAdminResponse('');
      setSelectedFeedback(null);
      refetchFeedback();
    } catch (error) {
      toast({
        title: 'Response Failed',
        description: 'Failed to add response to feedback.',
        variant: 'destructive',
      });
    }
  };

  const submitContactReply = async (id: number) => {
    if (!contactReply.trim()) return;
    
    setIsSendingReply(true);
    try {
      await apiRequest(`/api/admin/contact-messages/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: contactReply }),
      });
      
      toast({
        title: 'Reply Sent',
        description: 'Your reply has been sent via email to the user.',
      });
      
      setContactReply('');
      setSelectedContactMessage(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contact-messages'] });
    } catch (error) {
      toast({
        title: 'Reply Failed',
        description: 'Failed to send reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReply(false);
    }
  };


  // Bootstrap admin creation function
  const handleBootstrapAdmin = async () => {
    if (!user?.email) return;

    setIsBootstrapping(true);
    try {
      const result = await apiRequest('/api/bootstrap/create-first-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      // Store JWT token and updated user data from bootstrap response
      if (result && result.token && result.user) {
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      toast({
        title: 'Bootstrap Successful',
        description: 'You have been granted admin privileges!',
      });

      // Invalidate and refetch admin users list to ensure immediate update
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/users/admins'] });
      refetchAdminUsers();
      
      // Refresh the page to update authentication state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      toast({
        title: 'Bootstrap Failed',
        description: error.response?.data?.error || 'Failed to create first admin',
        variant: 'destructive',
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_review': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFeedbackTypeLabel = (type: string) => {
    switch (type) {
      case 'malfunction': return 'Bug Report';
      case 'feature-missing': return 'Feature Request';
      case 'suggestion': return 'Suggestion';
      case 'other': return 'Other';
      default: return type;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage feedback, users, and monitor platform analytics</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="admin-management" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Admin Management
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.users?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{analytics?.users?.thisMonth || 0} this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.jobs?.active || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {analytics?.jobs?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Feedback</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feedbackStats?.pending || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {feedbackStats?.total || 0} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Applications</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.applications?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.applications?.hired || 0} hired
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">New feedback submitted</span>
                  </div>
                  <span className="text-xs text-muted-foreground">2 hours ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">New user registered</span>
                  </div>
                  <span className="text-xs text-muted-foreground">4 hours ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm">Job application submitted</span>
                  </div>
                  <span className="text-xs text-muted-foreground">6 hours ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Management Tab */}
        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <CardTitle>Feedback Management</CardTitle>
                <div className="flex gap-2">
                  <Select 
                    value={feedbackFilters.status} 
                    onValueChange={(value) => setFeedbackFilters(prev => ({...prev, status: value}))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={feedbackFilters.type} 
                    onValueChange={(value) => setFeedbackFilters(prev => ({...prev, type: value}))}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="malfunction">Bug Reports</SelectItem>
                      <SelectItem value="feature-missing">Feature Requests</SelectItem>
                      <SelectItem value="suggestion">Suggestions</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackData?.feedback?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No feedback found matching your filters.
                    </div>
                  ) : (
                    feedbackData?.feedback?.map((item: FeedbackItem) => (
                      <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{getFeedbackTypeLabel(item.feedback_type)}</Badge>
                              <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                              {item.priority === 'high' && (
                                <Badge variant="destructive">High Priority</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: {item.user_name || item.user?.first_name || item.user_email || 'Anonymous'} • 
                              {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => updateFeedbackStatus(item.id, value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Update Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_review">In Review</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedFeedback(item)}
                                >
                                  Respond
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Respond to Feedback</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm font-medium mb-2">Original Message:</p>
                                    <p className="text-sm">{item.message}</p>
                                  </div>
                                  
                                  {item.admin_response && (
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                      <p className="text-sm font-medium mb-2">Previous Response:</p>
                                      <p className="text-sm">{item.admin_response}</p>
                                    </div>
                                  )}
                                  
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Your Response:</label>
                                    <Textarea
                                      value={adminResponse}
                                      onChange={(e) => setAdminResponse(e.target.value)}
                                      placeholder="Enter your response to this feedback..."
                                      rows={4}
                                    />
                                  </div>
                                  
                                  <Button 
                                    onClick={() => submitAdminResponse(item.id)}
                                    disabled={!adminResponse.trim()}
                                  >
                                    Send Response
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                        
                        <p className="text-sm">{item.message}</p>
                        
                        {item.page_url && (
                          <p className="text-xs text-muted-foreground">
                            Page: {item.page_url}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Messages Tab */}
        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Messages</CardTitle>
              <p className="text-sm text-muted-foreground">Messages submitted through the Contact Us form</p>
            </CardHeader>
            <CardContent>
              {contactMessagesLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!contactMessages || contactMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No contact messages yet.
                    </div>
                  ) : (
                    contactMessages.map((message: ContactMessage) => (
                      <div key={message.id} className="border border-border rounded-lg p-4 space-y-3" data-testid={`contact-message-${message.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{message.subject}</span>
                              <Badge className={
                                message.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : message.status === 'replied'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }>
                                {message.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: {message.name} ({message.email}) • 
                              {new Date(message.created_at).toLocaleDateString()} at {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        </div>
                        
                        {message.ip_address && (
                          <p className="text-xs text-muted-foreground">
                            IP: {message.ip_address}
                          </p>
                        )}
                        
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedContactMessage(message)}
                                data-testid={`button-reply-${message.id}`}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Reply
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Reply to Contact Message</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                  <p className="text-sm font-medium mb-2">Original Message:</p>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    From: {message.name} ({message.email})
                                  </p>
                                  <p className="text-sm font-semibold mb-1">{message.subject}</p>
                                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                                </div>
                                
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">Your Reply:</label>
                                  <Textarea
                                    value={contactReply}
                                    onChange={(e) => setContactReply(e.target.value)}
                                    placeholder="Enter your reply message here... This will be sent via email to the user."
                                    rows={6}
                                    data-testid="textarea-contact-reply"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Reply will be sent to: {message.email}
                                  </p>
                                </div>
                                
                                <div className="flex gap-2 justify-end">
                                  <Button 
                                    variant="outline"
                                    onClick={() => {
                                      setContactReply('');
                                      setSelectedContactMessage(null);
                                    }}
                                    disabled={isSendingReply}
                                    data-testid="button-cancel-reply"
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => submitContactReply(message.id)}
                                    disabled={!contactReply.trim() || isSendingReply}
                                    data-testid="button-send-reply"
                                  >
                                    {isSendingReply ? 'Sending...' : 'Send Reply'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {usersData?.users?.map((user: User) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.first_name || user.last_name 
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                              : user.email
                            }
                          </span>
                          <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                            {user.role}
                          </Badge>
                          {user.email_verified && <UserCheck className="w-4 h-4 text-green-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()} • 
                          Provider: {user.auth_provider}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Management Tab */}
        <TabsContent value="admin-management" className="space-y-6">
          {/* Bootstrap Admin Creation - Top Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                First Admin Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Need to create the first admin user?
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        If you're having trouble accessing admin features because no admin users exist yet, 
                        use this bootstrap button to make yourself the first admin. This only works if you're 
                        logged in with a pre-approved email address.
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Current user:</strong> {user?.email || 'Not logged in'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={handleBootstrapAdmin}
                  data-testid="button-bootstrap-admin"
                  disabled={isBootstrapping || !user?.email}
                  className="w-full"
                  variant="outline"
                >
                  {isBootstrapping ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating First Admin...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Create First Admin ({user?.email || 'No user'})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>


          {/* Current Admin Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Current Admin Users
                </span>
                {adminUsers && (
                  <Badge variant="secondary" data-testid="text-admin-count">
                    {adminUsers.length} {adminUsers.length === 1 ? 'Admin' : 'Admins'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminUsersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Loading admin users...</span>
                </div>
              ) : adminUsers && adminUsers.length > 0 ? (
                <div className="space-y-3">
                  {adminUsers.map((admin: User, index: number) => (
                    <div
                      key={admin.id}
                      data-testid={`card-admin-${admin.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-admin-email-${admin.id}`}>
                            {admin.email}
                          </p>
                          {(admin.first_name || admin.last_name) && (
                            <p className="text-sm text-muted-foreground">
                              {admin.first_name} {admin.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Admin</Badge>
                        <Badge variant="outline">
                          {admin.auth_provider || 'Email'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No admin users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Freelancers</span>
                  <span className="font-bold">{analytics?.users?.freelancers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Recruiters</span>
                  <span className="font-bold">{analytics?.users?.recruiters || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Verified Users</span>
                  <span className="font-bold">{analytics?.users?.verified || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Job Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Total Jobs</span>
                  <span className="font-bold">{analytics?.jobs?.total || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Active Jobs</span>
                  <span className="font-bold">{analytics?.jobs?.active || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>This Month</span>
                  <span className="font-bold">{analytics?.jobs?.thisMonth || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Application Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{analytics?.applications?.total || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Applications</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analytics?.applications?.applied || 0}</div>
                  <div className="text-sm text-muted-foreground">Applied</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{analytics?.applications?.hired || 0}</div>
                  <div className="text-sm text-muted-foreground">Hired</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <Layout>
        <AdminDashboardContent />
      </Layout>
    </AdminGuard>
  );
}