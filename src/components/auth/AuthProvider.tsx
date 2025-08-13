import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import PasswordChangeModal from "./PasswordChangeModal";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setIsInitialized(true);
        
        // Only check password change requirement on SIGNED_IN event, not all auth state changes
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            checkPasswordChangeRequired(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsInitialized(true);
      
      // Don't check for password change on initial page load/refresh
      // Only check when user actually signs in
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkPasswordChangeRequired = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('requires_password_change')
        .eq('user_id', userId)
        .single();

      if (profile?.requires_password_change) {
        setRequiresPasswordChange(true);
        setShowPasswordModal(true);
      }
    } catch (error) {
      console.error('Error checking password change requirement:', error);
    }
  };

  const handlePasswordChanged = () => {
    setRequiresPasswordChange(false);
    setShowPasswordModal(false);
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear any local state first
      setUser(null);
      setSession(null);
      setRequiresPasswordChange(false);
      setShowPasswordModal(false);
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Force redirect to auth page
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force redirect even if sign out fails
      window.location.href = '/auth';
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  // Don't render children until auth is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Initializing application</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <PasswordChangeModal 
        isOpen={showPasswordModal}
        onPasswordChanged={handlePasswordChanged}
      />
    </AuthContext.Provider>
  );
};