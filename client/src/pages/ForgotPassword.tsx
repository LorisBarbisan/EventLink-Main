import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const data = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() })
      });

      setSubmitted(true);
      toast({
        title: "Request Sent",
        description: data.message
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Check Your Email</CardTitle>
              <CardDescription>
                If this email is registered, you will receive a password reset link shortly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  The password reset link will expire in 1 hour for security.
                </p>
                <Button 
                  onClick={() => setLocation('/auth')}
                  className="w-full"
                  data-testid="button-back-to-signin"
                >
                  Back to Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLocation('/auth')}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Back to Sign In</span>
            </div>
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-reset-email"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-primary hover:bg-primary-hover"
                  disabled={loading}
                  data-testid="button-send-reset-link"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setLocation('/auth')}
                  data-testid="button-cancel-reset"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}