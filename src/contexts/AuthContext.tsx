import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isJwtError } from "@/lib/jwtErrorHandler";
import { clearAuthStorage } from "@/lib/authStorage";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  signUp: (email: string, password: string, metadata?: { first_name?: string; last_name?: string; phone?: string }) => Promise<{ error: Error | null }>;
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
      .then(async ({ data: { session: existingSession }, error }) => {
        if (!isMounted) return;

        // If the stored token is structurally bad (e.g. "missing sub claim"
        // from a previous corrupted state in this browser), purge it once
        // here so we don't trap the user in an infinite re-auth loop.
        if (error && isJwtError(error)) {
          console.warn("[AuthContext] Stored session has bad JWT, purging:", error);
          try { clearAuthStorage(); } catch { /* ignore */ }
          try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          initialRestoreDone = true;
          setAuthReady(true);
          setLoading(false);
          return;
        }

        // Defensive check: even when getSession() didn't error, the stored
        // access token may be a malformed JWT carrying a corrupted payload.
        // If we can decode the payload and find no `sub`, treat it as bad.
        if (existingSession?.access_token && !hasValidSubClaim(existingSession.access_token)) {
          console.warn("[AuthContext] Restored session JWT missing sub claim, purging");
          try { clearAuthStorage(); } catch { /* ignore */ }
          try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
          if (!isMounted) return;
          setSession(null);
          setUser(null);
          initialRestoreDone = true;
          setAuthReady(true);
          setLoading(false);
          return;
        }

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

/**
 * Decode the JWT payload (no signature verification — that's the server's job)
 * and confirm a non-empty `sub` claim exists. We do this only as a defense
 * against a known corrupted-storage state that produces "missing sub claim"
 * 403s and traps the client in a half-authenticated state.
 */
function hasValidSubClaim(accessToken: string): boolean {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return false;
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0;
  } catch {
    // If we can't decode it, assume Supabase will handle it; don't purge.
    return true;
  }
}
