import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Loader2 } from 'lucide-react';

/** Post-booking account setup: email is locked to the booking contact, guest only picks a password. */
export function GuestAccountSetup({ contact }: { contact: { name: string; email: string; phone: string } }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'check_email' | 'done' | 'exists'>('idle');
  const [error, setError] = useState('');
  if (user) return null;
  async function create() {
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true); setError('');
    const [first_name, ...rest] = contact.name.trim().split(/\s+/);
    const { data, error: e } = await supabase.auth.signUp({
      email: contact.email, password,
      options: { emailRedirectTo: `${window.location.origin}/portal/bookings`, data: { first_name, last_name: rest.join(' '), phone: contact.phone } },
    });
    setBusy(false); setPassword('');
    if (e) { /already|registered|exists/i.test(e.message) ? setState('exists') : setError(e.message); return; }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && (data.user.identities?.length ?? 0) === 0) { setState('exists'); return; }
    setState(data.session ? 'done' : 'check_email');
  }
  return <div className="rounded-md border border-border p-4 space-y-3">
    <h3 className="font-semibold">Set up your account</h3>
    {state === 'idle' && <>
      <p className="text-sm text-muted-foreground">Choose a password to view, change, or cancel this visit anytime. Your booking is already saved.</p>
      <div className="space-y-1"><Label htmlFor="guest-acct-email">Email</Label><Input id="guest-acct-email" value={contact.email} readOnly disabled /></div>
      <div className="space-y-1"><Label htmlFor="guest-acct-password">Create a password</Label><Input id="guest-acct-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" variant="outline" disabled={busy || password.length < 8} onClick={() => void create()}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create my account</Button>
      <p className="text-xs text-muted-foreground">You can also do this later from the link in your confirmation email.</p>
    </>}
    {state === 'check_email' && <p className="text-sm flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />Account created. Check {contact.email} and tap the confirm link, then sign in to see this booking.</p>}
    {state === 'done' && <p className="text-sm flex gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />Account created. This booking now appears in your portal.</p>}
    {state === 'exists' && <p className="text-sm">You already have an account with {contact.email}. <a className="underline" href={`/auth?email=${encodeURIComponent(contact.email)}&redirect=/portal/bookings`}>Sign in</a> to see this booking, or use Forgot password.</p>}
  </div>;
}
