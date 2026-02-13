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
import { Ticket, Plus, DollarSign, Loader2, CalendarIcon, Search, Eye, Users, Clock, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Gift, Send, Mail } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, isToday, isFuture, parseISO, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { GuestDetailSheet } from "@/components/admin/GuestDetailSheet";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";

const GUEST_PASS_PRICE = 60;

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

export default function GuestPasses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Quick sale form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [guestGender, setGuestGender] = useState<'female' | 'male' | ''>('');
  const [visitDate, setVisitDate] = useState<Date | undefined>(new Date());
  const [memberReferral, setMemberReferral] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data state
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('today');
  
  // Date filter for "All" tab
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  // Detail sheet state
  const [selectedGuest, setSelectedGuest] = useState<GuestPass | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch all passes (no date filter - we filter client-side for tabs)
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

  // Handle purchase success/cancel from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    if (purchase === 'success') {
      toast.success('Guest pass purchased successfully!');
      resetQuickSaleForm();
      fetchPasses();
      window.history.replaceState({}, '', '/admin/guest-passes');
    } else if (purchase === 'cancelled') {
      toast.error('Payment cancelled');
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
          successUrl: `${origin}/admin/guest-passes?purchase=success`,
          cancelUrl: `${origin}/admin/guest-passes?purchase=cancelled`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error creating guest pass checkout:', error);
      toast.error(error?.message || 'Failed to create guest pass checkout');
      setIsProcessing(false);
    }
  };

  // Check-in handler
  const handleCheckIn = async (pass: GuestPass, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await (supabase
        .from('guest_passes' as any)
        .update({ 
          used_at: new Date().toISOString(), 
          status: 'exhausted',
          checked_in_by: user?.id 
        })
        .eq('id', pass.id) as any);
      if (error) throw error;
      toast.success(`${pass.guest_name} checked in!`);
      fetchPasses();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to check in');
    }
  };

  // No-show handler
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

  // --- KPI calculations ---
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const kpis = useMemo(() => {
    const todayExpected = passes.filter(p => p.valid_date === todayStr && p.status === 'active' && !p.no_show);
    const todayCheckedIn = passes.filter(p => p.valid_date === todayStr && (p.status === 'exhausted' || p.used_at));
    const todayNoShow = passes.filter(p => p.valid_date === todayStr && p.no_show);

    const weekRevenue = passes
      .filter(p => {
        const d = new Date(p.purchased_at);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, p) => sum + p.price_paid, 0);

    const activePasses = passes.filter(p => p.status === 'active' && new Date(p.expires_at) > new Date());
    
    const totalRevenue = passes.reduce((sum, p) => sum + p.price_paid, 0);

    return {
      todayExpected: todayExpected.length,
      todayCheckedIn: todayCheckedIn.length,
      todayNoShow: todayNoShow.length,
      weekRevenue,
      activePasses: activePasses.length,
      totalRevenue,
    };
  }, [passes, todayStr]);

  // --- Filtered lists for tabs ---
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

  const todayPasses = useMemo(() => 
    applySearch(passes.filter(p => p.valid_date === todayStr)),
    [passes, todayStr, searchQuery]
  );

  const upcomingPasses = useMemo(() =>
    applySearch(passes.filter(p => p.valid_date && p.valid_date > todayStr && p.status === 'active')),
    [passes, todayStr, searchQuery]
  );

  const allPasses = useMemo(() => {
    let filtered = passes;
    if (dateFrom) filtered = filtered.filter(p => new Date(p.purchased_at) >= startOfDay(dateFrom));
    if (dateTo) filtered = filtered.filter(p => new Date(p.purchased_at) <= endOfDay(dateTo));
    return applySearch(filtered);
  }, [passes, dateFrom, dateTo, searchQuery]);

  const getStatusBadge = (pass: GuestPass) => {
    if (pass.no_show) return <Badge variant="destructive" className="text-xs">No-Show</Badge>;
    switch (pass.status) {
      case 'active':
        return <Badge variant="default" className="text-xs">Active</Badge>;
      case 'exhausted':
        return <Badge className="text-xs bg-green-600">Checked In</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-xs">Expired</Badge>;
      default:
        return <Badge className="text-xs">{pass.status}</Badge>;
    }
  };

  const currentTabPasses = activeTab === 'today' ? todayPasses : activeTab === 'upcoming' ? upcomingPasses : allPasses;

  const isMaleBlocked = guestGender === 'male';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest Passes</h1>
            <p className="text-muted-foreground">Manage guest access, check-ins, and sales</p>
          </div>
          <GuestPassPromoButton />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-accent/10">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis.todayExpected + kpis.todayCheckedIn}</p>
                  <p className="text-xs text-muted-foreground">Today's Guests</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {kpis.todayExpected} expected · {kpis.todayCheckedIn} checked in
                {kpis.todayNoShow > 0 && ` · ${kpis.todayNoShow} no-show`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${kpis.weekRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Ticket className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis.activePasses}</p>
                  <p className="text-xs text-muted-foreground">Active Passes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/10">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${kpis.totalRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Enhanced Quick Sale */}
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
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Guest passes are currently at capacity for this selection.
                    </p>
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

              <Button
                className="w-full"
                disabled={!guestName || isProcessing || isMaleBlocked}
                onClick={handleCreatePass}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create & Checkout
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Tabbed Pass List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Guest Passes</CardTitle>
              <CardDescription>View and manage guest passes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name, email, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                {activeTab === 'all' && (
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

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="today">
                    Today {todayPasses.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{todayPasses.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="upcoming">
                    Upcoming {upcomingPasses.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{upcomingPasses.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="all">All Passes</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  {isLoadingPasses ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                    </div>
                  ) : currentTabPasses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No passes found</p>
                      <p className="text-sm">
                        {activeTab === 'today' ? "No guests expected today" : activeTab === 'upcoming' ? "No upcoming visits" : "Try adjusting your date range or search"}
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
                              <TableRow
                                key={pass.id}
                                className="cursor-pointer"
                                onClick={() => handleViewDetails(pass)}
                              >
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
                                    {pass.add_ons && pass.add_ons.length > 0 && (
                                      <Badge variant="outline" className="text-xs">+{pass.add_ons.length}</Badge>
                                    )}
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
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {pass.member_referral || '—'}
                                </TableCell>
                                <TableCell className="text-right font-medium">${pass.price_paid.toFixed(0)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    {isActiveToday && (
                                      <>
                                        <Button variant="default" size="sm" className="h-7 text-xs" onClick={(e) => handleCheckIn(pass, e)}>
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Check In
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => handleNoShow(pass, e)}>
                                          <XCircle className="h-3 w-3 mr-1" />
                                          No-Show
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
      </div>

      <GuestDetailSheet
        guest={selectedGuest}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRefresh={fetchPasses}
      />
    </AdminLayout>
  );
}

function GuestPassPromoButton() {
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleSendPromo = async () => {
    if (!confirm("This will allocate 1 complimentary guest pass credit to every active member and send them a promotional email. Continue?")) return;

    setIsSending(true);
    try {
      // Fetch all active members
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("id, user_id, email, first_name")
        .eq("status", "active");

      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        toast.info("No active members found");
        setIsSending(false);
        return;
      }

      setProgress({ current: 0, total: members.length });

      const now = new Date();
      const monthEnd = endOfMonth(now);
      const expiresAt = new Date(monthEnd);
      expiresAt.setHours(23, 59, 59, 999);
      const cycleStart = format(now, "yyyy-MM-dd");
      const cycleEnd = format(monthEnd, "yyyy-MM-dd");
      const expiryMonth = format(now, "MMMM yyyy");

      let successCount = 0;
      let errorCount = 0;

      for (const member of members) {
        try {
          if (!member.user_id) {
            errorCount++;
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            continue;
          }

          // Insert guest_pass credit
          const { error: creditError } = await (supabase
            .from("member_credits" as any)
            .insert({
              user_id: member.user_id,
              member_id: member.id,
              credit_type: "guest_pass",
              credits_total: 1,
              credits_remaining: 1,
              cycle_start: cycleStart,
              cycle_end: cycleEnd,
              expires_at: expiresAt.toISOString(),
            }) as any);

          if (creditError) {
            console.error(`Credit insert failed for ${member.email}:`, creditError);
            errorCount++;
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            continue;
          }

          // Send promo email
          if (member.email) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "guest_pass_promo",
                to: member.email,
                data: {
                  name: member.first_name || "Member",
                  expiryMonth,
                },
              },
            });
          }

          successCount++;
        } catch (err) {
          console.error(`Error processing ${member.email}:`, err);
          errorCount++;
        }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      toast.success(`Guest pass promo sent! ${successCount} credits allocated${errorCount > 0 ? `, ${errorCount} errors` : ""}`);
    } catch (error: any) {
      console.error("Error sending guest pass promo:", error);
      toast.error(error?.message || "Failed to send promo");
    } finally {
      setIsSending(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isSending && progress.total > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{progress.current}/{progress.total}</span>
          <Progress value={(progress.current / progress.total) * 100} className="w-24 h-2" />
        </div>
      )}
      <Button onClick={handleSendPromo} disabled={isSending} variant="gold">
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Gift className="h-4 w-4" />
            Send Guest Pass Promo
          </>
        )}
      </Button>
    </div>
  );
}
