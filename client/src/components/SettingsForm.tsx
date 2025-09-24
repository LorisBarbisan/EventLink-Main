import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useProfile } from '@/hooks/useProfile';
import { apiRequest } from '@/lib/queryClient';
import { Eye, EyeOff, Trash2, Key } from 'lucide-react';
import type { User } from '@shared/types';

interface SettingsFormProps {
  user: User;
}

export function SettingsForm({ user }: SettingsFormProps) {
  const { toast } = useToast();
  const { signOut, updateUser } = useOptimizedAuth();
  // const { profile } = useProfile(); // Temporarily disabled to prevent errors
  const [showEmail, setShowEmail] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [accountForm, setAccountForm] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    company_name: '',
    role: user.role || 'freelancer',
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    profileVisible: true,
    emailNotifications: true,
  });

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      toast({
        title: 'Success',
        description: 'Password changed successfully.',
      });

      setShowPasswordDialog(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast({
        title: 'Password required',
        description: 'Please enter your password to confirm account deletion.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await apiRequest('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          password: deletePassword,
        }),
      });

      // Clear the password field and close dialog immediately
      setDeletePassword('');
      setShowDeleteDialog(false);
      
      // Immediately log out the user and clear their session
      await signOut();
      
      // Show success message briefly, then redirect
      toast({
        title: 'Account deleted',
        description: 'Your account has been permanently deleted. Redirecting...',
      });
      
      // Redirect to landing page immediately
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
    } catch (error: any) {
      toast({
        title: 'Deletion failed',
        description: error.message || 'Failed to delete account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAccountSave = async () => {
    setIsSavingAccount(true);
    try {
      // Check if user is authenticated before attempting save
      if (!user?.id) {
        throw new Error('You must be logged in to save account information');
      }

      // Update user account info (first_name, last_name, role)
      const updateResponse = await apiRequest('/api/auth/update-account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: accountForm.first_name,
          last_name: accountForm.last_name,
          role: accountForm.role,
        }),
      });

      // Update profile info for recruiters (company_name)
      if (accountForm.role === 'recruiter') {
        try {
          await apiRequest(`/api/recruiter/${user.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              company_name: accountForm.company_name || '',
            }),
          });
        } catch (error: any) {
          // If profile doesn't exist (404), create it
          if (error.message?.includes('Profile not found') || error.status === 404) {
            await apiRequest('/api/recruiter', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: user.id,
                company_name: accountForm.company_name || '',
              }),
            });
          } else {
            throw error; // Re-throw other errors
          }
        }
      }

      // Update the user context with the new data
      if (updateResponse && updateResponse.user) {
        updateUser(updateResponse.user);
        // Also update the form state to reflect the saved values
        setAccountForm(prev => ({
          ...prev,
          first_name: updateResponse.user.first_name || '',
          last_name: updateResponse.user.last_name || '',
          role: updateResponse.user.role || 'freelancer',
        }));
      }

      toast({
        title: 'Account updated',
        description: 'Your account information has been saved successfully.',
      });
    } catch (error: any) {
      console.error('Account save error:', error);
      
      let errorMessage = 'Failed to update account information. Please try again.';
      
      // Provide specific error messages based on the error type
      if (error.message?.includes('401') || error.message?.includes('Not authenticated')) {
        errorMessage = 'Your session has expired. Please log in again and try saving.';
      } else if (error.message?.includes('403')) {
        errorMessage = 'You do not have permission to update this information.';
      } else if (error.message?.includes('400')) {
        errorMessage = 'Invalid information provided. Please check your entries.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Update failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Load recruiter profile data when user is a recruiter
  useEffect(() => {
    const loadRecruiterProfile = async () => {
      if (user.role === 'recruiter') {
        setIsLoadingProfile(true);
        try {
          const profile = await apiRequest(`/api/recruiter/${user.id}`);
          setAccountForm(prev => ({
            ...prev,
            company_name: profile.company_name || '',
          }));
        } catch (error) {
          // Profile might not exist yet, which is fine
          console.log('No recruiter profile found yet');
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    loadRecruiterProfile();
  }, [user.id, user.role]);

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Manage your account details and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">
                First Name{user.role === 'recruiter' ? ' (Optional)' : ''}
              </Label>
              <Input
                id="first_name"
                type="text"
                value={accountForm.first_name}
                onChange={(e) => setAccountForm(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder={user.role === 'recruiter' ? "Enter your first name (optional)" : "Enter your first name"}
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label htmlFor="last_name">
                Last Name{user.role === 'recruiter' ? ' (Optional)' : ''}
              </Label>
              <Input
                id="last_name"
                type="text"
                value={accountForm.last_name}
                onChange={(e) => setAccountForm(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder={user.role === 'recruiter' ? "Enter your last name (optional)" : "Enter your last name"}
                data-testid="input-last-name"
              />
            </div>
          </div>

          {user.role === 'recruiter' && (
            <div>
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                type="text"
                value={accountForm.company_name}
                onChange={(e) => setAccountForm(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Enter your company name"
                data-testid="input-company-name"
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleAccountSave}
              disabled={isSavingAccount || isLoadingProfile}
              data-testid="button-save-account"
            >
              {isSavingAccount ? 'Saving...' : isLoadingProfile ? 'Loading...' : 'Save Changes'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  type={showEmail ? 'text' : 'password'}
                  value={user.email}
                  readOnly
                  className="bg-muted"
                  data-testid="input-email"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmail(!showEmail)}
                  data-testid="button-toggle-email"
                >
                  {showEmail ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="role">Account Type</Label>
              <Select 
                value={accountForm.role} 
                onValueChange={(value) => setAccountForm(prev => ({ ...prev, role: value as 'freelancer' | 'recruiter' }))}
              >
                <SelectTrigger data-testid="select-account-type">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="flex items-center gap-2">
              <Input
                id="password"
                type="password"
                value="••••••••••••"
                readOnly
                className="bg-muted"
                data-testid="input-password"
              />
              <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-change-password">
                    <Key className="w-4 h-4 mr-1" />
                    Change
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Enter your current password and choose a new one.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="old-password">Current Password</Label>
                      <Input
                        id="old-password"
                        type="password"
                        value={passwordForm.oldPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                        data-testid="input-old-password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        data-testid="input-new-password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        data-testid="input-confirm-password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowPasswordDialog(false)}
                      disabled={isChangingPassword}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword || !passwordForm.oldPassword || !passwordForm.newPassword}
                      data-testid="button-confirm-password-change"
                    >
                      {isChangingPassword ? 'Changing...' : 'Change Password'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Security</CardTitle>
          <CardDescription>Control your privacy settings and account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Profile Visibility</h4>
              <p className="text-sm text-muted-foreground">
                Your profile is visible to other users on the platform
              </p>
            </div>
            <Switch
              checked={privacySettings.profileVisible}
              onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, profileVisible: checked }))}
              data-testid="toggle-profile-visibility"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Email Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Receive notifications about applications and messages
              </p>
            </div>
            <Switch
              checked={privacySettings.emailNotifications}
              onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, emailNotifications: checked }))}
              data-testid="toggle-email-notifications"
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
            <div>
              <h4 className="font-medium text-destructive">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="button-delete-account">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers, including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Your profile information</li>
                      <li>All job applications</li>
                      <li>Message history</li>
                      <li>Uploaded files and documents</li>
                    </ul>
                    <div className="mt-4">
                      <Label htmlFor="delete-password">Enter your password to confirm:</Label>
                      <Input
                        id="delete-password"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        className="mt-2"
                        data-testid="input-delete-password"
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel 
                    onClick={() => setDeletePassword('')}
                    disabled={isDeletingAccount}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteAccount}
                    disabled={!deletePassword || isDeletingAccount}
                    data-testid="button-confirm-delete"
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Yes, delete my account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}