import React, { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const [isInitialized, setIsInitialized] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Safety timeout using ref to avoid stale closure
    const timeout = setTimeout(() => {
      if (mounted && !initializedRef.current) {
        console.warn('Auth initialization timed out after 8s, proceeding');
        setLoading(false);
        setIsInitialized(true);
        initializedRef.current = true;
      }
    }, 8000);

    const markInitialized = (s: Session | null) => {
      if (!mounted || initializedRef.current) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      setIsInitialized(true);
      initializedRef.current = true;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.error('Token refresh failed, clearing session');
          clearAuthStorage();
          markInitialized(null);
          window.location.replace('/auth');
          return;
        }

        if (event === 'SIGNED_OUT') {
          markInitialized(null);
          return;
        }

        // For SIGNED_IN or INITIAL_SESSION, always update state
        // This ensures late arrivals (after timeout) still recover the UI
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          setLoading(false);
          setIsInitialized(true);
          initializedRef.current = true;
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Error getting session:', error);
        clearAuthStorage();
        markInitialized(null);
        return;
      }
      markInitialized(s);
    }).catch((error) => {
      console.error('Fatal error getting session:', error);
      clearAuthStorage();
      if (mounted) markInitialized(null);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const clearAuthStorage = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { first_name: firstName, last_name: lastName }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    try {
      clearAuthStorage();
      setUser(null);
      setSession(null);
      await supabase.auth.signOut({ scope: 'global' });
      window.location.replace('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      clearAuthStorage();
      window.location.replace('/auth');
    }
  };

  const value = useMemo(() => ({
    user, session, loading, signUp, signIn, signOut,
  }), [user, session, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
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
