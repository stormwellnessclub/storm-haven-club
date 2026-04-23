import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    console.info("[AuthContext] Initializing");

    // Set up auth state listener FIRST (synchronous handlers only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;
        console.info("[AuthContext] Auth event:", event, "hasSession:", !!nextSession);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        // Once we receive any auth event, we're ready
        if (!authReady) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    );

    // THEN restore the existing session (single source of truth, no aggressive validation)
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        console.info("[AuthContext] Restored session:", !!existingSession);
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setAuthReady(true);
        setLoading(false);
      })
      .catch((error) => {
        // Do NOT clear storage here. Transient JWT/refresh errors during
        // startup must not wipe a valid session — they will be retried by
        // Supabase's own background refresh logic.
        console.warn("[AuthContext] getSession failed, leaving auth state alone:", error);
        if (!isMounted) return;
        setAuthReady(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    metadata?: { first_name?: string; last_name?: string }
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
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
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/update-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authReady, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
