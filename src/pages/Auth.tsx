
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import ForgotPassword from "@/components/auth/ForgotPassword";
import ResetPassword from "@/components/auth/ResetPassword";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    // Only process URL parameters if there's actually something in the hash or search params
    const hash = window.location.hash.substring(1);
    const search = window.location.search;
    
    // Only log and process if there's actually content to process
    if (hash) {
      console.log('RAW HASH:', hash);
      
      // Fix malformed hash with double # symbols - replace # with & after the first one
      let processedHash = hash;
      if (hash.includes('#')) {
        const parts = hash.split('#');
        processedHash = parts[0] + '&' + parts.slice(1).join('&');
        console.log('FIXED HASH:', processedHash);
      }
      
      const hashParams = new URLSearchParams(processedHash);
      console.log('HASH PARAMS ENTRIES:', Array.from(hashParams.entries()));
      
      // Check if this is a recovery link
      const type = hashParams.get('type');
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');

      console.log('PARSED VALUES:', { 
        type: type, 
        hasAccessToken: !!access_token, 
        hasRefreshToken: !!refresh_token,
        accessTokenLength: access_token?.length || 0,
        refreshTokenLength: refresh_token?.length || 0
      });

      if (type === 'recovery' && access_token && refresh_token) {
        console.log('✅ VALID RECOVERY LINK - REDIRECTING NOW');
        // Create properly formatted hash for redirect
        const properHash = `#${processedHash}`;
        console.log('REDIRECT TARGET:', `/reset-password${properHash}`);
        navigate(`/reset-password${properHash}`, { replace: true });
        return;
      } else if (type || access_token || refresh_token) {
        // Only log error if there were auth-related parameters that failed validation
        console.log('❌ NOT A VALID RECOVERY LINK:', { type, hasTokens: !!(access_token && refresh_token) });
      }
    }

    // Check for Outlook OAuth callback only if there are search params
    if (search) {
      const urlParams = new URLSearchParams(search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        // This is an Outlook OAuth callback, redirect to schedule page
        // The OutlookIntegration component will handle the token exchange
        navigate("/schedule?tab=settings", { replace: true });
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);

      if (error) {
        toast({
          title: "Error signing in",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setSignUpLoading(true);

    try {
      const { error } = await signUp(
        signUpData.email,
        signUpData.password,
        signUpData.firstName,
        signUpData.lastName
      );

      if (error) {
        toast({
          title: "Error creating account",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSignUpLoading(false);
    }
  };

  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <ResetPassword />
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center space-y-6">
        <div className="flex items-center space-x-2">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">EriSync</h1>
        </div>
        
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to EriSync</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={signInData.email}
                      onChange={(e) =>
                        setSignInData({ ...signInData, email: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        value={signInData.password}
                        onChange={(e) =>
                          setSignInData({ ...signInData, password: e.target.value })
                        }
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Button type="submit" disabled={signInLoading} className="w-full">
                      {signInLoading ? "Signing In..." : "Sign In"}
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="link" 
                      className="w-full text-sm text-muted-foreground"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                </form>
              </TabsContent>
              
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="flex flex-col items-center space-y-2 text-sm text-muted-foreground">
          <div className="flex space-x-4">
            <Button 
              variant="link" 
              className="text-xs text-muted-foreground p-0 h-auto"
              onClick={() => navigate("/privacy-policy")}
            >
              Privacy Policy
            </Button>
            <Button 
              variant="link" 
              className="text-xs text-muted-foreground p-0 h-auto"
              onClick={() => navigate("/security-policy")}
            >
              Security Policy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
