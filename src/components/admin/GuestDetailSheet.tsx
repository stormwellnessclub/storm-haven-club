import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ExternalLink, User, Mail, Phone, Calendar as CalendarIcon, Users, Sparkles, FileText, Pencil, Check, X, CheckCircle2, XCircle, Save, UserCheck, Send, Loader2, Shield } from "lucide-react";
import { guestCheckInPatch, isGuestPassCheckedIn, guestVisitDateLabel } from "@/lib/guestPassStatus";
import { clubTodayDateStr } from "@/lib/clubTime";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { cn } from "@/lib/utils";

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
  guest_gender?: string | null;
  price_paid: number;
  status: 'active' | 'exhausted' | 'expired';
  purchased_at: string;
  expires_at: string;
  used_at: string | null;
  valid_date?: string | null;
  member_referral?: string | null;
  visit_interests?: string[] | null;
  visit_notes?: string | null;
  add_ons?: Array<{ id: string; label: string; price: number }> | null;
  stripe_payment_id?: string | null;
  admin_notes?: string | null;
  checked_in_by?: string | null;
  no_show?: boolean | null;
  feedback_email_sent_at?: string | null;
}

interface GuestDetailSheetProps {
  guest: GuestPass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

const INTEREST_LABELS: Record<string, string> = {
  movement: "Movement & Training",
  recovery: "Recovery Therapies",
  spa: "Spa Amenities",
  exploring: "Just exploring the space",
};

export function GuestDetailSheet({ guest, open, onOpenChange, onRefresh }: GuestDetailSheetProps) {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRoles();
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState(false);
  const [editingExpiration, setEditingExpiration] = useState(false);
  const [newExpiration, setNewExpiration] = useState<Date | undefined>(undefined);
  const [savingExpiration, setSavingExpiration] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  if (!guest) return null;

  const isActiveToday = guest.valid_date === format(new Date(), "yyyy-MM-dd") && guest.status === 'active' && !guest.no_show;

  const getStatusBadge = (status: string) => {
    if (guest.no_show) return <Badge variant="destructive">No-Show</Badge>;
    switch (status) {
      case 'active': return <Badge variant="default">Active</Badge>;
      case 'exhausted': return <Badge className="bg-green-600">Checked In</Badge>;
      case 'expired': return <Badge variant="outline">Expired</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const calculateAddonsTotal = () => {
    if (!guest.add_ons || guest.add_ons.length === 0) return 0;
    return guest.add_ons.reduce((sum, addon) => sum + (addon.price || 0), 0);
  };

  const handleSaveDate = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      const { error } = await (supabase
        .from("guest_passes" as any)
        .update({ valid_date: format(newDate, "yyyy-MM-dd") })
        .eq("id", guest.id) as any);
      if (error) throw error;
      toast.success("Visit date updated");
      onRefresh?.();
      setEditingDate(false);
      setNewDate(undefined);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update date");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const { error } = await (supabase
        .from('guest_passes' as any)
        .update(guestCheckInPatch(user?.id))
        .eq('id', guest.id) as any);
      if (error) throw error;
      toast.success(`${guest.guest_name} checked in!`);
      onRefresh?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to check in');
    }
  };

  const handleNoShow = async () => {
    try {
      const { error } = await (supabase
        .from('guest_passes' as any)
        .update({ no_show: true })
        .eq('id', guest.id) as any);
      if (error) throw error;
      toast.success(`${guest.guest_name} marked as no-show`);
      onRefresh?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    }
  };

  const handleSaveNotes = async () => {
    try {
      const { error } = await (supabase
        .from('guest_passes' as any)
        .update({ admin_notes: adminNotes })
        .eq('id', guest.id) as any);
      if (error) throw error;
      toast.success("Notes saved");
      setEditingNotes(false);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save notes");
    }
  };

  const addonsTotal = calculateAddonsTotal();
  const basePrice = guest.price_paid - addonsTotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {guest.guest_name}
            </SheetTitle>
            {getStatusBadge(guest.status)}
          </div>
          <SheetDescription>Guest pass details and management</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Check-in Action (prominent for active today passes) */}
          {isActiveToday && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCheckIn}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Check In
              </Button>
              <Button variant="outline" onClick={handleNoShow}>
                <XCircle className="h-4 w-4 mr-2" />
                No-Show
              </Button>
            </div>
          )}

          {/* Contact Information */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
            <div className="space-y-2">
              {guest.guest_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${guest.guest_email}`} className="hover:underline">{guest.guest_email}</a>
                </div>
              )}
              {guest.phone_number && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${guest.phone_number}`} className="hover:underline">{guest.phone_number}</a>
                </div>
              )}
              {guest.guest_gender && (
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">{guest.guest_gender}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Visit Details */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Visit Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {editingDate ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !newDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {newDate ? format(newDate, "PPP") : "Pick new date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={newDate} onSelect={setNewDate} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveDate} disabled={!newDate || saving}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingDate(false); setNewDate(undefined); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span>
                      {guest.valid_date
                        ? `Valid for: ${format(new Date(guest.valid_date), "MMMM d, yyyy")}`
                        : `Purchased: ${format(new Date(guest.purchased_at), "MMMM d, yyyy")}`}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingDate(true); if (guest.valid_date) setNewDate(new Date(guest.valid_date)); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Expires: {format(new Date(guest.expires_at), "MMM d, yyyy h:mm a")}</span>
                {isSuperAdmin() && !editingExpiration && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingExpiration(true); setNewExpiration(new Date(guest.expires_at)); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingExpiration && isSuperAdmin() && (
                <div className="flex items-center gap-2 mt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !newExpiration && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {newExpiration ? format(newExpiration, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newExpiration} onSelect={setNewExpiration} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!newExpiration || savingExpiration} onClick={async () => {
                    if (!newExpiration) return;
                    setSavingExpiration(true);
                    try {
                      const { error } = await (supabase
                        .from("guest_passes" as any)
                        .update({ expires_at: newExpiration.toISOString() })
                        .eq("id", guest.id) as any);
                      if (error) throw error;
                      toast.success("Expiration date updated");
                      onRefresh?.();
                      setEditingExpiration(false);
                      setNewExpiration(undefined);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to update");
                    } finally {
                      setSavingExpiration(false);
                    }
                  }}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingExpiration(false); setNewExpiration(undefined); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {isGuestPassCheckedIn(guest) && (
                <div className="text-muted-foreground">Used: {guestVisitDateLabel(guest)}</div>
              )}
              {guest.member_referral && (
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Guest of: {guest.member_referral}</span>
                </div>
              )}
            </div>
          </div>

          {/* Super Admin: Status Override */}
          {isSuperAdmin() && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin Override
                </h4>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Pass Status</label>
                  <Select
                    value={guest.status}
                    disabled={changingStatus}
                    onValueChange={async (val) => {
                      setChangingStatus(true);
                      try {
                        const updateData: any = { status: val };
                        if (val === 'active') {
                          updateData.used_at = null;
                          updateData.no_show = false;
                        } else if (val === 'used' || val === 'exhausted') {
                          // Never leave a checked-in pass without a date
                          if (!guest.used_at) updateData.used_at = new Date().toISOString();
                          if (!guest.valid_date) updateData.valid_date = clubTodayDateStr();
                        }
                        const { error } = await (supabase
                          .from("guest_passes" as any)
                          .update(updateData)
                          .eq("id", guest.id) as any);
                        if (error) throw error;
                        toast.success(`Status changed to ${val}`);
                        onRefresh?.();
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to change status");
                      } finally {
                        setChangingStatus(false);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="exhausted">Checked In</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {guest.visit_interests && guest.visit_interests.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Visit Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {guest.visit_interests.map((interest) => (
                    <Badge key={interest} variant="outline" className="text-xs">{INTEREST_LABELS[interest] || interest}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Visit Notes */}
          {guest.visit_notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Guest Notes
                </h4>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{guest.visit_notes}</p>
              </div>
            </>
          )}

          {/* Add-ons */}
          {guest.add_ons && guest.add_ons.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Purchased Add-ons
                </h4>
                <div className="space-y-2">
                  {guest.add_ons.map((addon) => (
                    <div key={addon.id} className="flex justify-between text-sm">
                      <span>{addon.label}</span>
                      <span className="font-medium">${addon.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Confirmation Email */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Send className="h-4 w-4" />
              Confirmation Email
            </h4>
            {guest.guest_email ? (
              <Button
                variant="outline"
                size="sm"
                disabled={sendingConfirmation}
                onClick={async () => {
                  setSendingConfirmation(true);
                  try {
                    const visitDate = guest.valid_date
                      ? format(new Date(guest.valid_date), "MMMM d, yyyy")
                      : format(new Date(guest.purchased_at), "MMMM d, yyyy");
                    const { error: emailError } = await supabase.functions.invoke('send-email', {
                      body: {
                        type: 'guest_pass_purchase_confirmation',
                        to: guest.guest_email,
                        data: {
                          name: guest.guest_name,
                          visitDate,
                          amountPaid: guest.price_paid.toFixed(2),
                        },
                      },
                    });
                    if (emailError) throw emailError;
                    toast.success('Confirmation email sent!');
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to send confirmation email');
                  } finally {
                    setSendingConfirmation(false);
                  }
                }}
              >
                {sendingConfirmation ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-3 w-3 mr-1" /> Resend Confirmation Email</>
                )}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">No email on file</p>
            )}
          </div>

          <Separator />

          {/* Feedback Email Status */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Feedback Email
            </h4>
            {guest.feedback_email_sent_at ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Sent {format(new Date(guest.feedback_email_sent_at), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
            ) : guest.guest_email && guest.status === 'exhausted' ? (
              <Button
                variant="outline"
                size="sm"
                disabled={sendingFeedback}
                onClick={async () => {
                  setSendingFeedback(true);
                  try {
                    const visitDate = guest.valid_date
                      ? format(new Date(guest.valid_date), "MMMM d, yyyy")
                      : undefined;
                    const { error: emailError } = await supabase.functions.invoke('send-email', {
                      body: {
                        type: 'guest_visit_feedback',
                        to: guest.guest_email,
                        data: {
                          name: guest.guest_name,
                          visitDate,
                          source: 'admin-manual',
                        },
                      },
                    });
                    if (emailError) throw emailError;
                    // Stamp the timestamp
                    await (supabase
                      .from('guest_passes' as any)
                      .update({ feedback_email_sent_at: new Date().toISOString() })
                      .eq('id', guest.id) as any);
                    toast.success('Feedback email sent!');
                    onRefresh?.();
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to send feedback email');
                  } finally {
                    setSendingFeedback(false);
                  }
                }}
              >
                {sendingFeedback ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="h-3 w-3 mr-1" /> Send Feedback Email</>
                )}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {!guest.guest_email ? 'No email on file' : 'Available after check-in'}
              </p>
            )}
          </div>

          <Separator />

          {/* Admin Notes */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Admin Notes
            </h4>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this guest..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm bg-muted/50 p-3 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors min-h-[40px]"
                onClick={() => { setAdminNotes(guest.admin_notes || ''); setEditingNotes(true); }}
              >
                {guest.admin_notes || <span className="text-muted-foreground italic">Click to add notes...</span>}
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Summary */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Payment Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Guest Pass</span>
                <span>${basePrice.toFixed(2)}</span>
              </div>
              {addonsTotal > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons</span>
                  <span>${addonsTotal.toFixed(2)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total Paid</span>
                <span>${guest.price_paid.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Activity</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>Created: {format(new Date(guest.purchased_at), "MMM d, yyyy h:mm a")}</div>
              {guest.valid_date && <div>Visit date: {format(new Date(guest.valid_date), "MMM d, yyyy")}</div>}
              {isGuestPassCheckedIn(guest) && <div>Checked in: {guestVisitDateLabel(guest)}</div>}
              {guest.no_show && <div className="text-destructive">Marked as no-show</div>}
              {guest.expires_at && <div>Expires: {format(new Date(guest.expires_at), "MMM d, yyyy h:mm a")}</div>}
            </div>
          </div>

          {/* Stripe Link */}
          {guest.stripe_payment_id && (
            <>
              <Separator />
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <a href={`https://dashboard.stripe.com/payments/${guest.stripe_payment_id}`} target="_blank" rel="noopener noreferrer">
                    View in Stripe
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
