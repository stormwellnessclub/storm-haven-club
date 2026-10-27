import { useRef, useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { StripeProvider } from '@/components/StripeProvider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { guestCheckoutReturnUrl, type GuestCheckoutAccess, type GuestContact } from '@/lib/spaGuestCheckout';

export function SpaGuestCheckout({ access, clientSecret, amountCents, contact, onBack, onComplete }: {
  access: GuestCheckoutAccess; clientSecret: string; amountCents: number; contact: GuestContact;
  onBack: () => void; onComplete: (access: GuestCheckoutAccess) => void;
}) {
  return <StripeProvider key={clientSecret} clientSecret={clientSecret}>
    <GuestPaymentForm {...{access,amountCents,contact,onBack,onComplete}} />
  </StripeProvider>;
}
function GuestPaymentForm({access,amountCents,contact,onBack,onComplete}: Omit<Parameters<typeof SpaGuestCheckout>[0],'clientSecret'>) {
  const stripe = useStripe(); const elements = useElements();
  const [ready,setReady]=useState(false); const [busy,setBusy]=useState(false);
  const [createAccount,setCreateAccount]=useState(false); const [password,setPassword]=useState('');
  const [error,setError]=useState(''); const lock=useRef(false); const authorized=useRef(false);
  async function confirm() {
    if (!stripe || !elements || lock.current) return;
    if (createAccount && password.length<8) {setError('Use at least 8 characters for your password.');return;}
    lock.current=true;setBusy(true);setError('');
    try {
      if (!authorized.current) {
        const result=await stripe.confirmPayment({elements,confirmParams:{return_url:guestCheckoutReturnUrl(access),payment_method_data:{billing_details:{name:contact.name,email:contact.email,phone:contact.phone}}},redirect:'if_required'});
        if (result.error) throw new Error(result.error.message || 'Please check your card details.');
        if (!result.paymentIntent || !['requires_capture','succeeded'].includes(result.paymentIntent.status)) throw new Error('Your card authorization is not complete yet.');
        authorized.current=true;
      }
      const {data,error:invokeError}=await supabase.functions.invoke('spa-guest-checkout',{body:{action:'reserve',...access}});
      if (invokeError || !data?.success) throw new Error(data?.error || 'Could not confirm your booking. Retry confirmation.');
      // Account setup never blocks or retries the successful paid reservation.
      if (createAccount) {
        const [firstName,...rest]=contact.name.trim().split(/\s+/);
        const {data:signup,error:signupError}=await supabase.auth.signUp({email:contact.email,password,options:{emailRedirectTo:window.location.origin,data:{first_name:firstName,last_name:rest.join(' '),phone:contact.phone}}});
        if (signupError) toast.info('Your booking is confirmed. Account setup was not completed; use the account sign-up or password reset later.');
        else if (!signup.session) toast.info('Your booking is confirmed. Check your email to verify your account; you can complete your forms now.');
        setPassword('');
      }
      onComplete(access);
    } catch(e) {setError(e instanceof Error?e.message:'Please try again.');}
    finally {lock.current=false;setBusy(false);}
  }
  return <div className="space-y-5 py-3">
    <Button variant="ghost" size="sm" onClick={onBack} disabled={busy || authorized.current}><ArrowLeft className="h-4 w-4 mr-2" />Booking details</Button>
    <div><h3 className="font-medium">Secure card payment</h3><p className="text-sm text-muted-foreground">{contact.name} · {contact.email}</p></div>
    <PaymentElement options={{layout:'tabs'}} onReady={()=>setReady(true)} onLoadError={()=>setError('The payment form could not load. Go back and try again.')} />
    <p className="text-xs text-muted-foreground flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Your card is saved securely for this appointment and applicable late-cancellation or no-show charges.</p>
    <div className="space-y-3 border-t border-border pt-4">
      <label className="flex gap-2 items-center text-sm"><Checkbox checked={createAccount} onCheckedChange={v=>setCreateAccount(v===true)} disabled={busy} />Create my account (optional)</label>
      {createAccount && <div className="space-y-2"><Label htmlFor="guest-password">Create a password</Label><Input id="guest-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} /><p className="text-xs text-muted-foreground">Already have an account? Leave this unchecked and sign in after booking.</p></div>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="w-full" size="lg" disabled={!stripe || !ready || busy} onClick={()=>void confirm()}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{authorized.current?'Retry booking confirmation':`Confirm & Pay $${(amountCents/100).toFixed(2)}`}</Button>
  </div>;
}