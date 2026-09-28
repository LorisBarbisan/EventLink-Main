import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Briefcase, Building2, Check, Eye, EyeOff, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Role = "freelancer" | "recruiter";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState("");
  const [isSetMode, setIsSetMode] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const resetToken = params.get("token");
    if (resetToken) {
      setToken(resetToken);
      setTokenValid(true);
    } else {
      setTokenValid(false);
    }
    setIsSetMode(params.get("mode") === "set");
  }, [searchString]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("Must be at least 8 characters long");
    if (!/[A-Z]/.test(pwd)) errors.push("Must contain at least one uppercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("Must contain at least one number");
    return errors;
  };

  const passwordErrors = password ? validatePassword(password) : [];
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast({ title: "Error", description: "Please enter a password.", variant: "destructive" });
      return;
    }
    if (!confirmPassword.trim()) {
      toast({
        title: "Error",
        description: "Please confirm your password.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (passwordErrors.length > 0) {
      toast({
        title: "Password Requirements",
        description: passwordErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        token,
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
      };
      if (isSetMode && selectedRole) body.role = selectedRole;

      const data = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast({
        title: isSetMode ? "Account ready!" : "Success",
        description: isSetMode ? "Sign in to access your dashboard." : data.message,
      });

      setTimeout(() => {
        setLocation(isSetMode ? "/auth?welcome=1" : "/auth");
      }, 1500);
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Shield className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Invalid Link</CardTitle>
              <CardDescription>This link is invalid or has expired.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Button
                  onClick={() => setLocation("/forgot-password")}
                  className="mb-2 w-full"
                  data-testid="button-request-new-reset"
                >
                  Request New Reset Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/auth")}
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

  if (isSetMode && !roleConfirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-xl">
            <CardHeader>
              <CardTitle>How are you using EventLink?</CardTitle>
              <CardDescription>
                Choose your account type so we can set up your dashboard correctly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedRole("freelancer")}
                className={cn(
                  "flex w-full items-start gap-4 rounded-lg border-2 p-4 text-left transition-colors",
                  selectedRole === "freelancer"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Freelancer / Individual</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    I&apos;m an independent professional &mdash; I find work and can also post jobs
                    for events I&apos;m organising myself.
                  </p>
                </div>
                {selectedRole === "freelancer" && (
                  <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole("recruiter")}
                className={cn(
                  "flex w-full items-start gap-4 rounded-lg border-2 p-4 text-left transition-colors",
                  selectedRole === "recruiter"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Employer / Company</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    I represent a company or agency and hire freelancers for events.
                  </p>
                </div>
                {selectedRole === "recruiter" && (
                  <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />
                )}
              </button>

              <Button
                className="bg-gradient-primary hover:bg-primary-hover mt-2 w-full"
                disabled={!selectedRole}
                onClick={() => setRoleConfirmed(true)}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <div className="mb-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (isSetMode ? setRoleConfirmed(false) : setLocation("/auth"))}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {isSetMode ? "Back" : "Back to Sign In"}
              </span>
            </div>
            <CardTitle>{isSetMode ? "Set Your Password" : "Create New Password"}</CardTitle>
            <CardDescription>
              {isSetMode
                ? "Create a password to access your EventLink account and manage your jobs."
                : "Enter your new password below. Make sure it's strong and secure."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{isSetMode ? "Password" : "New Password"}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-new-password"
                    className={passwordErrors.length > 0 && password ? "border-destructive" : ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div
                      className={`text-xs ${passwordErrors.length === 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      Password requirements:
                    </div>
                    <div className="space-y-1 text-xs">
                      <div
                        className={`flex items-center gap-1 ${password.length >= 8 ? "text-success" : "text-muted-foreground"}`}
                      >
                        <Check
                          className={`h-3 w-3 ${password.length >= 8 ? "text-success" : "text-muted-foreground"}`}
                        />
                        At least 8 characters
                      </div>
                      <div
                        className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? "text-success" : "text-muted-foreground"}`}
                      >
                        <Check
                          className={`h-3 w-3 ${/[A-Z]/.test(password) ? "text-success" : "text-muted-foreground"}`}
                        />
                        One uppercase letter
                      </div>
                      <div
                        className={`flex items-center gap-1 ${/[0-9]/.test(password) ? "text-success" : "text-muted-foreground"}`}
                      >
                        <Check
                          className={`h-3 w-3 ${/[0-9]/.test(password) ? "text-success" : "text-muted-foreground"}`}
                        />
                        One number
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                    className={
                      confirmPassword && password && confirmPassword !== password
                        ? "border-destructive"
                        : confirmPassword && password && confirmPassword === password
                          ? "border-success"
                          : ""
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {confirmPassword && password && (
                  <div
                    className={`text-xs ${passwordsMatch ? "text-success" : "text-destructive"}`}
                  >
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="bg-gradient-primary hover:bg-primary-hover w-full"
                disabled={
                  loading ||
                  !password.trim() ||
                  !confirmPassword.trim() ||
                  password !== confirmPassword ||
                  passwordErrors.length > 0
                }
                data-testid="button-reset-password"
              >
                {loading
                  ? isSetMode
                    ? "Setting Password..."
                    : "Resetting Password..."
                  : isSetMode
                    ? "Set Password"
                    : "Reset Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
