import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEventMemberState, useInvalidateEventState } from "@/hooks/useEventMemberState";

interface Props {
  slug: string;
  allowGuestRequests?: boolean | null;
  className?: string;
  /** Member-facing eligibility wording, e.g. "Diamond & Founding Members". */
  eligibilityLabel?: string;
  waitlistEnabled?: boolean | null;
}

/**
 * Reserve / waitlist / guest-request actions for a members-only event.
 * Never renders seat counts — availability is staff-only information.
 */
export function MemberEventActions({
  slug,
  allowGuestRequests,
  className,
  eligibilityLabel,
  waitlistEnabled = true,
}: Props) {
  const { user } = useAuth();
  const { data: state, isLoading } = useEventMemberState(slug);
  const invalidate = useInvalidateEventState();
  const [busy, setBusy] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestFirst, setGuestFirst] = useState("");
  const [guestLast, setGuestLast] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNote, setGuestNote] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  const accessPanel = (heading: string, body: string, showSignIn: boolean) => (
    <div className={className}>
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          {eligibilityLabel ?? "Members only"}
        </p>
        <p className="font-serif text-xl mt-2">{heading}</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{body}</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <Link to="/memberships">Explore membership</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/apply">Apply for membership</Link>
          </Button>
          {showSignIn && (
            <Button asChild variant="ghost">
              <Link to="/auth">Already a member? Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return accessPanel(
      "Held for Storm members",
      "This gathering is part of belonging to Storm Wellness Club. Members reserve their place from inside the club portal.",
      true,
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Button size="lg" className="w-full" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading
        </Button>
      </div>
    );
  }

  if (state && !state.is_member) {
    return accessPanel(
      "Held for Storm members",
      "This gathering is part of belonging to Storm Wellness Club. We would love to welcome you.",
      false,
    );
  }

  if (state && !state.is_eligible) {
    return (
      <div className={className}>
        <div className="rounded-xl border bg-muted/40 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            {eligibilityLabel ?? "Limited membership access"}
          </p>
          <p className="font-serif text-xl mt-2">An invitation reserved for select memberships</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            This gathering is held for {eligibilityLabel ?? "select members"}. Speak with the
            concierge about moving up to this level of membership.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/portal/support">Speak with the concierge</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state && !state.booking_open && !state.has_reservation && !state.is_waitlisted) {
    return (
      <div className={className}>
        <div className="rounded-xl border bg-muted/40 p-6 text-center">
          <Clock className="h-5 w-5 mx-auto text-primary mb-2" />
          <p className="font-medium">Reservations open shortly</p>
          <p className="text-sm text-muted-foreground mt-1">
            Diamond and Founding members are welcomed first. We'll let you know the moment your
            window opens.
          </p>
        </div>
      </div>
    );
  }

  const reserve = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("reserve_event_seat", { _slug: slug });
      if (error) throw error;
      const res = data as { ok?: boolean; reason?: string; ticket_id?: string } | null;
      if (res?.ok) {
        if (res.ticket_id) {
          supabase.functions
            .invoke("send-event-reservation-email", {
              body: { ticket_id: res.ticket_id, kind: "reservation" },
            })
            .catch(() => undefined);
        }
        toast.success("Your seat is reserved. A confirmation is on its way.");
      } else if (res?.reason === "full") {
        toast.info("The circle just filled. You can join the waitlist.");
      } else if (res?.reason === "not_member") {
        toast.error("This experience is reserved for Storm members.");
      } else {
        toast.error("We could not reserve your seat. Please try again.");
      }
      invalidate(slug);
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const releaseSeat = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("cancel_event_reservation", { _slug: slug });
      if (error) throw error;
      const res = data as { ok?: boolean } | null;
      if (res?.ok) toast.success("Your place has been released.");
      else toast.error("We could not release your place. Please call the club.");
      invalidate(slug);
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const joinWaitlist = async () => {

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("join_event_waitlist", { _slug: slug });
      if (error) throw error;
      const res = data as { ok?: boolean } | null;
      if (res?.ok) toast.success("You're on the waitlist. We'll reach out the moment a seat opens.");
      else toast.error("We could not add you to the waitlist.");
      invalidate(slug);
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submitGuest = async () => {
    if (!guestFirst.trim() || !guestLast.trim()) {
      toast.error("Please enter your guest's first and last name.");
      return;
    }
    setGuestSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("request_event_guest_seat", {
        _slug: slug,
        _guest_first_name: guestFirst.trim(),
        _guest_last_name: guestLast.trim(),
        _guest_email: guestEmail.trim() || null,
        _guest_phone: guestPhone.trim() || null,
        _note: guestNote.trim() || null,
      });
      if (error) throw error;
      const res = data as { ok?: boolean } | null;
      if (res?.ok) {
        toast.success("Request received. We'll confirm by email based on availability.");
        setGuestOpen(false);
        setGuestFirst("");
        setGuestLast("");
        setGuestEmail("");
        setGuestPhone("");
        setGuestNote("");
      } else {
        toast.error("We could not submit that request.");
      }
    } catch (e) {
      toast.error((e as Error).message || "Something went wrong.");
    } finally {
      setGuestSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {state?.has_reservation ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-primary mb-2" />
          <p className="font-medium">Your place in the circle is held</p>
          <p className="text-sm text-muted-foreground mt-1">
            You'll find the details in your portal.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-muted-foreground"
            onClick={releaseSeat}
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Release my place
          </Button>
        </div>
      ) : state?.is_waitlisted ? (
        <div className="rounded-lg border bg-muted/40 p-5 text-center">
          <Clock className="h-5 w-5 mx-auto text-primary mb-2" />
          <p className="font-medium">You're on the waitlist</p>
          <p className="text-sm text-muted-foreground mt-1">
            We'll reach out the moment a place opens.
          </p>
        </div>
      ) : state?.is_full ? (

        <Button size="lg" className="w-full" onClick={joinWaitlist} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Join the waitlist
        </Button>
      ) : (
        <Button size="lg" className="w-full" onClick={reserve} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reserve my place
        </Button>
      )}

      {allowGuestRequests && (
        <Button
          variant="outline"
          size="lg"
          className="w-full mt-3"
          onClick={() => setGuestOpen(true)}
        >
          <UserPlus className="h-4 w-4 mr-2" /> Request a seat for a guest
        </Button>
      )}

      <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a seat for a guest</DialogTitle>
            <DialogDescription>
              Guest seats are granted based on availability. We'll confirm by email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="guest-first">Guest first name</Label>
                <Input id="guest-first" value={guestFirst} onChange={(e) => setGuestFirst(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="guest-last">Guest last name</Label>
                <Input id="guest-last" value={guestLast} onChange={(e) => setGuestLast(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="guest-email">Guest email</Label>
              <Input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="guest-phone">Guest phone</Label>
              <Input id="guest-phone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="guest-note">Anything we should know?</Label>
              <Textarea
                id="guest-note"
                rows={3}
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitGuest} disabled={guestSubmitting}>
              {guestSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
