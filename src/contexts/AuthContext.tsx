import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { isJwtError, handleJwtError } from "@/lib/jwtErrorHandler";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Synchronous state updates only
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // First try to get existing session from storage
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
        
        // Check for JWT errors in getSession
        if (sessionError && isJwtError(sessionError)) {
          console.warn("[AuthContext] JWT error in getSession, clearing auth:", sessionError);
          await handleJwtError(sessionError, { redirect: false });
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (!existingSession) {
          // No session in storage - user is logged out
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // Session exists - validate it with the server
        const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser();
        
        // Check for JWT errors in getUser
        if (userError) {
          if (isJwtError(userError)) {
            console.warn("[AuthContext] JWT error in getUser, clearing auth:", userError);
            await handleJwtError(userError, { redirect: false });
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          // Non-JWT error - try to refresh
          console.warn("[AuthContext] Session validation failed, attempting refresh:", userError);
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            if (isJwtError(refreshError)) {
              await handleJwtError(refreshError, { redirect: false });
            } else {
              clearAuthStorage();
              await supabase.auth.signOut();
            }
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          
          // Refresh succeeded - get the new session
          const { data: { session: refreshedSession } } = await supabase.auth.getSession();
          setSession(refreshedSession);
          setUser(refreshedSession?.user ?? null);
          setLoading(false);
          return;
        }
        
        // Session is valid
        setSession(existingSession);
        setUser(validatedUser);
        setLoading(false);
      } catch (error) {
        console.error("[AuthContext] Auth initialization error:", error);
        
        // Check if it's a JWT error
        if (isJwtError(error)) {
          await handleJwtError(error, { redirect: false });
        } else {
          // On any other error, clear and reset
          clearAuthStorage();
        }
        
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
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

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
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
