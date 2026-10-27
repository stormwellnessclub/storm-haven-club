import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type GuestCheckoutAccess } from '@/lib/spaGuestCheckout';
import { BodyWrapIntakeForm } from './BodyWrapIntakeForm';
import { SpaIntakeForm } from './SpaIntakeForm';
import { intakeKindFor } from '@/hooks/useBodyWrapIntake';
import { useAllAgreements } from '@/hooks/useAllAgreements';
import { resolvePdfUrl } from '@/lib/pdfAssets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Loader2 } from 'lucide-react';

type Booking = {id:string;service_name:string;service_category:string;appointment_date:string;appointment_time:string;duration_minutes:number};
export function GuestSpaFollowUp({access,onDone}: {access:GuestCheckoutAccess;onDone:()=>void}) {
  const [booking,setBooking]=useState<Booking|null>(null);const [contact,setContact]=useState({name:'',email:'',phone:''});
  const [intakeDone,setIntakeDone]=useState(false);const [waiverDone,setWaiverDone]=useState(false);
  const [name,setName]=useState('');const [agreed,setAgreed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const {data:agreements}=useAllAgreements();const waiver=agreements?.liability_waiver?.[0];
  async function call(action:string,values?:unknown) {
    const {data,error:invokeError}=await supabase.functions.invoke('spa-guest-checkout',{body:{action,...access,values}});
    if(invokeError || !data?.success) throw new Error(data?.error || 'Unable to save this step. Please try again.');
    return data;
  }
  async function load() {
    setBusy(true);setError('');
    try {
      // Reserve also resumes a card-authentication return, without a second payment.
      await call('reserve');
      const data=await call('read');setBooking(data.appointment);setContact(data.contact);setName(data.contact.name);setIntakeDone(data.intakeDone);setWaiverDone(data.waiverDone);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load your booking.');}finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[access.id]);
  async function save(action:string,values:unknown) {
    setBusy(true);setError('');
    try {await call(action,values);if(action==='intake')setIntakeDone(true);else setWaiverDone(true);}
    catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}
  }
  const kind=booking?intakeKindFor(booking.service_category,booking.service_name):null;
  return <div className="space-y-5 py-3">
    {booking && <div className="space-y-2 border-b border-border pb-4"><h2 className="text-xl font-semibold flex items-center gap-2"><Check className="h-5 w-5 text-accent" />Booking confirmed</h2><p className="font-medium">{booking.service_name} · {booking.duration_minutes} min</p><p className="text-sm text-muted-foreground">{booking.appointment_date} · {booking.appointment_time.slice(0,5)} Michigan time</p><p className="text-sm text-muted-foreground">A confirmation is on its way to {contact.email}.</p></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!booking ? <Button onClick={()=>void load()} disabled={busy}>{busy?<Loader2 className="h-4 w-4 animate-spin" />:'Retry booking confirmation'}</Button> : kind && !intakeDone ? <>
      <h3 className="font-semibold">{kind==='body_wrap'?'Body Wrap Intake & Consent':'Your treatment intake'}</h3>
      {kind==='body_wrap'?<BodyWrapIntakeForm appointmentId={booking.id} contactPrefill={{fullName:contact.name,email:contact.email,phone:contact.phone}} isSubmitting={busy} onSubmit={v=>save('intake',v)} />:<SpaIntakeForm showHeader={false} isSubmitting={busy} onSubmit={v=>save('intake',v)} />}
    </> : !waiverDone ? <div className="space-y-4">
      <h3 className="font-semibold">Booking liability waiver</h3>
      {waiver?.pdf_url && <Button variant="outline" asChild><a href={resolvePdfUrl(waiver.pdf_url)} target="_blank" rel="noopener noreferrer">Read liability waiver</a></Button>}
      <div className="space-y-2"><Label htmlFor="guest-waiver-name">Full name as your signature</Label><Input id="guest-waiver-name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} /></div>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={agreed} onCheckedChange={v=>setAgreed(v===true)} />I have read the liability waiver and agree to its terms. Typing my name is my electronic signature.</label>
      <Button className="w-full" disabled={busy || !agreed || name.trim().length<2 || !waiver} onClick={()=>void save('waiver',{name,agreementId:waiver?.id,acknowledged:agreed})}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign booking waiver</Button>
    </div> : <div className="space-y-4"><p className="font-medium">Your forms are complete. We look forward to seeing you.</p><Button className="w-full" onClick={onDone}>Done</Button></div>}
  </div>;
}