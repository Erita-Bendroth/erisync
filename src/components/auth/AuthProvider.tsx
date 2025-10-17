import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
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
    console.error("useAuth called outside of AuthProvider! Component tree:", {
      hasAuthContext: !!AuthContext,
      contextValue: context
    });
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
        
        console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
        
        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.error('Token refresh failed, clearing invalid session');
          // Clear invalid session data
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
              localStorage.removeItem(key);
            }
          });
          setSession(null);
          setUser(null);
          setLoading(false);
          setIsInitialized(true);
          // Redirect to login
          window.location.replace('/auth');
          return;
        }
        
        // Handle signed out event
        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setSession(null);
          setUser(null);
          setLoading(false);
          setIsInitialized(true);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setIsInitialized(true);
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.id, session.user.email);
        }
      }
    );

    // Check for existing session with error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      // If there's an error getting the session, clear everything
      if (error) {
        console.error('Error getting session:', error);
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
        setSession(null);
        setUser(null);
        setLoading(false);
        setIsInitialized(true);
        window.location.replace('/auth');
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setIsInitialized(true);
    }).catch((error) => {
      console.error('Fatal error getting session:', error);
      // Clear everything on fatal error
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      setSession(null);
      setUser(null);
      setLoading(false);
      setIsInitialized(true);
      window.location.replace('/auth');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Removed password change requirement check

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
    // First check if user has temporary password
    try {
      const { data: tempCheckData } = await supabase.functions.invoke('check-temp-password', {
        body: { email, password }
      });
      
      console.log('Temporary password check result:', tempCheckData);
    } catch (error) {
      console.error('Error checking temporary password:', error);
      // Continue with normal login even if temp check fails
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      
      // Clear all auth-related localStorage items first
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear any local state
      setUser(null);
      setSession(null);
      setRequiresPasswordChange(false);
      setShowPasswordModal(false);
      
      // Sign out from Supabase with global scope to clear all sessions
      await supabase.auth.signOut({ scope: 'global' });
      
      console.log('Sign out completed, redirecting...');
      // Force a complete page reload to ensure clean state
      window.location.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      // Clear storage and force redirect even if sign out fails
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      window.location.replace('/auth');
    }
  };

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, session, loading, signUp, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Show loading overlay while initializing */}
      {!isInitialized && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Initializing application</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};