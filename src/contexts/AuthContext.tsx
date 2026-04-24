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
    let initialRestoreDone = false;

    console.info("[AuthContext] Initializing");

    // Set up auth state listener FIRST (synchronous handlers only).
    // Do NOT mark authReady here — only the initial getSession() result is
    // authoritative for "we have finished restoring whatever session exists".
    // Later auth events (TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT) update state
    // but never flip authReady on their own.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;
        console.info("[AuthContext] Auth event:", event, "hasSession:", !!nextSession);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        // Once initial restore is complete, any subsequent auth event keeps
        // us ready. Before initial restore, we wait for getSession().
        if (initialRestoreDone) {
          setLoading(false);
        }
      }
    );

    // THEN restore the existing session (single source of truth).
    // Only this path is allowed to flip authReady from false → true.
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!isMounted) return;
        console.info("[AuthContext] Restored session:", !!existingSession);
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        initialRestoreDone = true;
        setAuthReady(true);
        setLoading(false);
      })
      .catch((error) => {
        // Do NOT clear storage here. Transient JWT/refresh errors during
        // startup must not wipe a valid session — they will be retried by
        // Supabase's own background refresh logic.
        console.warn("[AuthContext] getSession failed, leaving auth state alone:", error);
        if (!isMounted) return;
        initialRestoreDone = true;
        setAuthReady(true);
        setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
