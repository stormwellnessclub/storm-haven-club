import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ticket, Plus, DollarSign, Loader2, CalendarIcon, Search, Eye, Users, CheckCircle2, XCircle, Mail, BarChart3, CreditCard, UserPlus, Megaphone, Gift } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { guestCheckInPatch } from "@/lib/guestPassStatus";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { GuestDetailSheet } from "@/components/admin/GuestDetailSheet";
import { GuestPassOverviewTab } from "@/components/admin/GuestPassOverviewTab";
import { GuestPassMemberCreditsTab } from "@/components/admin/GuestPassMemberCreditsTab";
import { GuestPassFollowUpTab } from "@/components/admin/GuestPassFollowUpTab";
import { GuestPassMarketingTab } from "@/components/admin/GuestPassMarketingTab";
import { AdminGrantPassDialog } from "@/components/admin/AdminGrantPassDialog";
import { useUserRoles } from "@/hooks/useUserRoles";

const GUEST_PASS_PRICE = 60;

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
  guest_gender?: string | null;
  price_paid: number;
  status: string;
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

export default function GuestPasses() {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRoles();
  const [showGrantDialog, setShowGrantDialog] = useState(false);

  // Quick sale form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [guestGender, setGuestGender] = useState<'female' | 'male' | ''>('');
  const [visitDate, setVisitDate] = useState<Date | undefined>(new Date());
  const [memberReferral, setMemberReferral] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Admin bulk/discount state
  const { isAdmin } = useUserRoles();
  const [quantity, setQuantity] = useState(1);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(GUEST_PASS_PRICE);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });

  // Data state
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('today');

  // Date filter for "All" sub-tab
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Detail sheet state
  const [selectedGuest, setSelectedGuest] = useState<GuestPass | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Top-level tab
  const [mainTab, setMainTab] = useState('overview');

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    setIsLoadingPasses(true);
    try {
      const { data, error } = await (supabase
        .from('guest_passes' as any)
        .select('*')
        .order('purchased_at', { ascending: false })
        .limit(500) as any);
      if (error) throw error;
      setPasses((data || []) as GuestPass[]);
    } catch (error) {
      console.error('Error fetching passes:', error);
      toast.error('Failed to load guest passes');
    } finally {
      setIsLoadingPasses(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    if (purchase === 'success') {
      toast.success('Guest pass purchased successfully!');
      resetQuickSaleForm();
      fetchPasses();
      setMainTab('passes');
      window.history.replaceState({}, '', '/admin/guest-passes');
    } else if (purchase === 'cancelled') {
      toast.error('Payment cancelled');
      setMainTab('passes');
      window.history.replaceState({}, '', '/admin/guest-passes');
    }
  }, []);

  const resetQuickSaleForm = () => {
    setGuestName('');
    setGuestEmail('');
    setPhoneNumber('');
    setGuestGender('');
    setVisitDate(new Date());
    setMemberReferral('');
    setQuantity(1);
    setApplyDiscount(false);
    setCustomPrice(GUEST_PASS_PRICE);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setExpirationDate(d);
  };

  const handleCreatePass = async () => {
    if (!guestName || !user) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsProcessing(true);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_pass_checkout",
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || undefined,
          guestGender: guestGender || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          validDate: visitDate ? format(visitDate, "yyyy-MM-dd") : undefined,
          memberReferral: memberReferral.trim() || undefined,
          quantity: isAdmin() ? quantity : 1,
          customPrice: isAdmin() && applyDiscount ? customPrice : undefined,
          expiresAt: isAdmin() && expirationDate ? expirationDate.toISOString() : undefined,
          successUrl: `${origin}/admin/guest-passes?purchase=success`,
          cancelUrl: `${origin}/admin/guest-passes?purchase=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) { window.location.href = data.url; } else { throw new Error('No checkout URL received'); }
    } catch (error: any) {
      console.error('Error creating guest pass checkout:', error);
      toast.error(error?.message || 'Failed to create guest pass checkout');
      setIsProcessing(false);
    }
  };

  const handleCheckIn = async (pass: GuestPass, e: React.MouseEvent) => {
    e.stopPropagation();
    const { ok, error } = await checkInGuestPass(supabase, pass.id, user?.id);
    if (!ok) {
      toast.error(error || 'Failed to check in');
      return;
    }
    toast.success(`${pass.guest_name} checked in!`);
    fetchPasses();
  };


  const handleNoShow = async (pass: GuestPass, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await (supabase
        .from('guest_passes' as any)
        .update({ no_show: true })
        .eq('id', pass.id) as any);
      if (error) throw error;
      toast.success(`${pass.guest_name} marked as no-show`);
      fetchPasses();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    }
  };

  const handleViewDetails = (pass: GuestPass) => {
    setSelectedGuest(pass);
    setIsDetailOpen(true);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const applySearch = (list: GuestPass[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p =>
      p.guest_name.toLowerCase().includes(q) ||
      p.guest_email?.toLowerCase().includes(q) ||
      p.phone_number?.toLowerCase().includes(q) ||
      p.member_referral?.toLowerCase().includes(q)
    );
  };

  const todayPasses = useMemo(() => applySearch(passes.filter(p => p.valid_date === todayStr)), [passes, todayStr, searchQuery]);
  const upcomingPasses = useMemo(() => applySearch(passes.filter(p => p.valid_date && p.valid_date > todayStr && p.status === 'active')), [passes, todayStr, searchQuery]);
  const allPasses = useMemo(() => {
    let filtered = passes;
    if (dateFrom) filtered = filtered.filter(p => new Date(p.purchased_at) >= startOfDay(dateFrom));
    if (dateTo) filtered = filtered.filter(p => new Date(p.purchased_at) <= endOfDay(dateTo));
    return applySearch(filtered);
  }, [passes, dateFrom, dateTo, searchQuery]);

  const getStatusBadge = (pass: GuestPass) => {
    if (pass.no_show) return <Badge variant="destructive" className="text-xs">No-Show</Badge>;
    switch (pass.status) {
      case 'active': return <Badge variant="default" className="text-xs">Active</Badge>;
      case 'used':
      case 'exhausted': return <Badge className="text-xs bg-green-600">Checked In</Badge>;
      case 'expired': return <Badge variant="outline" className="text-xs">Expired</Badge>;
      default: return <Badge className="text-xs">{pass.status}</Badge>;
    }
  };

  const currentTabPasses = activeSubTab === 'today' ? todayPasses : activeSubTab === 'upcoming' ? upcomingPasses : allPasses;
  const isMaleBlocked = guestGender === 'male';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest Passes</h1>
            <p className="text-muted-foreground">Manage guest access, analytics, credits, and marketing</p>
          </div>
          {isSuperAdmin() && (
            <Button variant="outline" size="sm" onClick={() => setShowGrantDialog(true)}>
              <Gift className="h-4 w-4 mr-2" /> Grant Pass
            </Button>
          )}
        </div>

        {/* Top-Level Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="passes" className="gap-1.5">
              <Ticket className="h-4 w-4" />
              Passes
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Member Credits
            </TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Follow-Up
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-1.5">
              <Megaphone className="h-4 w-4" />
              Marketing
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <GuestPassOverviewTab passes={passes} />
          </TabsContent>

          {/* Passes Tab - existing Quick Sale + pass list */}
          <TabsContent value="passes">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Quick Sale */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Quick Sale
                  </CardTitle>
                  <CardDescription>Create a guest pass for walk-in visitors</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Guest Pass</span>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-lg">${GUEST_PASS_PRICE}</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gym and amenities access. Does not include classes, red light therapy, or zero body cryo.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guestName">Guest Name *</Label>
                    <Input id="guestName" placeholder="Full name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail">Email</Label>
                    <Input id="guestEmail" type="email" placeholder="Optional" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input id="phoneNumber" type="tel" placeholder="(555) 555-5555" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Sex</Label>
                    <RadioGroup value={guestGender} onValueChange={(v) => setGuestGender(v as 'female' | 'male')} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="qs-female" />
                        <Label htmlFor="qs-female" className="font-normal cursor-pointer">Female</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="qs-male" />
                        <Label htmlFor="qs-male" className="font-normal cursor-pointer">Male</Label>
                      </div>
                    </RadioGroup>
                    {isMaleBlocked && (
                      <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
                        <p className="text-xs text-amber-800 dark:text-amber-200">Guest passes are currently at capacity for this selection.</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Visit Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !visitDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {visitDate ? format(visitDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={visitDate} onSelect={setVisitDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="memberReferral">Guest of (Member Name)</Label>
                    <Input id="memberReferral" placeholder="Optional" value={memberReferral} onChange={(e) => setMemberReferral(e.target.value)} />
                  </div>

                  {/* Admin-only: Quantity & Discount */}
                  {isAdmin() && (
                    <div className="space-y-3 border-t pt-3">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled={quantity <= 1} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</Button>
                          <Input id="quantity" type="number" min={1} max={10} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} className="w-16 text-center" />
                          <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled={quantity >= 10} onClick={() => setQuantity(q => Math.min(10, q + 1))}>+</Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="applyDiscount" checked={applyDiscount} onChange={(e) => { setApplyDiscount(e.target.checked); if (!e.target.checked) setCustomPrice(GUEST_PASS_PRICE); }} className="rounded" />
                          <Label htmlFor="applyDiscount" className="font-normal cursor-pointer">Apply discount</Label>
                        </div>
                        {applyDiscount && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <Input type="number" min={0} step={1} value={customPrice} onChange={(e) => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))} className="w-24" placeholder="Price per pass" />
                            <span className="text-sm text-muted-foreground">per pass</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Expiration Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expirationDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {expirationDate ? format(expirationDate, "PPP") : "Select expiration"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={expirationDate} onSelect={setExpirationDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="p-3 rounded-md bg-muted/50 text-sm space-y-1">
                        <div className="flex justify-between"><span>Subtotal</span><span>${((applyDiscount ? customPrice : GUEST_PASS_PRICE) * quantity).toFixed(2)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Processing fee</span><span>~${(((applyDiscount ? customPrice : GUEST_PASS_PRICE) * quantity * 0.029) + 0.30).toFixed(2)}</span></div>
                        <div className="flex justify-between font-medium border-t pt-1"><span>Est. Total</span><span>${(((applyDiscount ? customPrice : GUEST_PASS_PRICE) * quantity) * 1.029 + 0.30).toFixed(2)}</span></div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" disabled={!guestName || isProcessing || isMaleBlocked} onClick={handleCreatePass}>
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><Plus className="h-4 w-4 mr-2" />{quantity > 1 ? `Create ${quantity} Passes & Checkout` : 'Create & Checkout'}</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Pass List */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Guest Passes</CardTitle>
                  <CardDescription>View and manage guest passes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                    </div>
                    {activeSubTab === 'all' && (
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, "MMM d") : "From"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, "MMM d") : "To"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>

                  <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                    <TabsList>
                      <TabsTrigger value="today">
                        Today {todayPasses.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{todayPasses.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="upcoming">
                        Upcoming {upcomingPasses.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{upcomingPasses.length}</Badge>}
                      </TabsTrigger>
                      <TabsTrigger value="all">All Passes</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeSubTab} className="mt-4">
                      {isLoadingPasses ? (
                        <div className="text-center py-8"><Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /></div>
                      ) : currentTabPasses.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No passes found</p>
                          <p className="text-sm">
                            {activeSubTab === 'today' ? "No guests expected today" : activeSubTab === 'upcoming' ? "No upcoming visits" : "Try adjusting your date range or search"}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Guest</TableHead>
                                <TableHead className="hidden sm:table-cell">Visit Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Source</TableHead>
                                <TableHead className="hidden md:table-cell">Referral</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {currentTabPasses.map((pass) => {
                                const isActiveToday = pass.valid_date === todayStr && pass.status === 'active' && !pass.no_show;
                                return (
                                  <TableRow key={pass.id} className="cursor-pointer" onClick={() => handleViewDetails(pass)}>
                                    <TableCell>
                                      <div className="font-medium">{pass.guest_name}</div>
                                      <div className="text-xs text-muted-foreground">{pass.guest_email || pass.phone_number || '—'}</div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-sm">
                                      {pass.valid_date ? format(parseISO(pass.valid_date), "MMM d, yyyy") : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        {getStatusBadge(pass)}
                                        {pass.add_ons && pass.add_ons.length > 0 && <Badge variant="outline" className="text-xs">+{pass.add_ons.length}</Badge>}
                                        {(pass as any).feedback_email_sent_at && (
                                          <span title={`Feedback email sent ${format(new Date((pass as any).feedback_email_sent_at), "MMM d, yyyy h:mm a")}`}>
                                            <Mail className="h-3.5 w-3.5 text-green-600" />
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      {pass.member_referral === "Complimentary Guest Pass" ? (
                                        <Badge variant="secondary" className="text-xs">Member</Badge>
                                      ) : pass.stripe_payment_id && !pass.member_referral ? (
                                        <Badge variant="outline" className="text-xs">Public</Badge>
                                      ) : (
                                        <Badge variant="default" className="text-xs bg-muted text-muted-foreground border">Admin</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{pass.member_referral || '—'}</TableCell>
                                    <TableCell className="text-right font-medium">${pass.price_paid.toFixed(0)}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        {isActiveToday && (
                                          <>
                                            <Button variant="default" size="sm" className="h-7 text-xs" onClick={(e) => handleCheckIn(pass, e)}>
                                              <CheckCircle2 className="h-3 w-3 mr-1" />Check In
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => handleNoShow(pass, e)}>
                                              <XCircle className="h-3 w-3 mr-1" />No-Show
                                            </Button>
                                          </>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(pass)}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Member Credits Tab */}
          <TabsContent value="credits">
            <GuestPassMemberCreditsTab />
          </TabsContent>

          {/* Follow-Up Tab */}
          <TabsContent value="followup">
            <GuestPassFollowUpTab />
          </TabsContent>

          {/* Marketing Tab */}
          <TabsContent value="marketing">
            <GuestPassMarketingTab />
          </TabsContent>
        </Tabs>
      </div>

      <GuestDetailSheet
        guest={selectedGuest}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRefresh={fetchPasses}
      />

      <AdminGrantPassDialog
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
        onSuccess={fetchPasses}
      />
    </AdminLayout>
  );
}
