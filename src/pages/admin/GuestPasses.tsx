import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ticket, Plus, DollarSign, Loader2, CalendarIcon, Search, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { GuestDetailSheet } from "@/components/admin/GuestDetailSheet";

const GUEST_PASS_PRICE = 60;

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number?: string | null;
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
}

export default function GuestPasses() {
  const { user } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [passes, setPasses] = useState<GuestPass[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date filter state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfDay(new Date()));
  
  // Detail sheet state
  const [selectedGuest, setSelectedGuest] = useState<GuestPass | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch passes when date range changes
  useEffect(() => {
    fetchPasses();
  }, [dateFrom, dateTo]);

  const fetchPasses = async () => {
    setIsLoadingPasses(true);
    try {
      let query = supabase
        .from('guest_passes' as any)
        .select('*')
        .order('purchased_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('purchased_at', startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte('purchased_at', endOfDay(dateTo).toISOString());
      }

      const { data, error } = await (query.limit(100) as any);

      if (error) throw error;

      setPasses((data || []) as GuestPass[]);
    } catch (error) {
      console.error('Error fetching passes:', error);
      toast.error('Failed to load guest passes');
    } finally {
      setIsLoadingPasses(false);
    }
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

  // Handle purchase success/cancel from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    
    if (purchase === 'success') {
      toast.success('Guest pass purchased successfully!');
      setGuestName('');
      setGuestEmail('');
      fetchPasses();
      window.history.replaceState({}, '', '/admin/guest-passes');
    } else if (purchase === 'cancelled') {
      toast.error('Payment cancelled');
      window.history.replaceState({}, '', '/admin/guest-passes');
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'exhausted':
        return <Badge variant="secondary">Used</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = (pass: GuestPass) => {
    setSelectedGuest(pass);
    setIsDetailOpen(true);
  };

  // Filter passes by search query
  const filteredPasses = passes.filter(pass => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      pass.guest_name.toLowerCase().includes(query) ||
      pass.guest_email?.toLowerCase().includes(query) ||
      pass.phone_number?.toLowerCase().includes(query) ||
      pass.member_referral?.toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Passes</h1>
          <p className="text-muted-foreground">
            Sell day passes and manage guest access
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sell New Pass */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Quick Sale
              </CardTitle>
              <CardDescription>
                Create a guest pass for walk-in visitors
              </CardDescription>
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
                <Input
                  id="guestName"
                  placeholder="Enter guest's full name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestEmail">Guest Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="Optional"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>

              <Button 
                className="w-full" 
                disabled={!guestName || isProcessing}
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

          {/* Passes List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Guest Pass History</CardTitle>
              <CardDescription>
                View and manage guest passes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(
                        "justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "MMM d") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(
                        "justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "MMM d") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Passes List */}
              {isLoadingPasses ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                </div>
              ) : filteredPasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No passes found</p>
                  <p className="text-sm">Try adjusting your date range or search</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredPasses.map((pass) => (
                    <div 
                      key={pass.id} 
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(pass)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{pass.guest_name}</span>
                            {pass.add_ons && pass.add_ons.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                +{pass.add_ons.length} add-ons
                              </Badge>
                            )}
                          </div>
                          {pass.guest_email && (
                            <div className="text-sm text-muted-foreground truncate">
                              {pass.guest_email}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>${pass.price_paid}</span>
                            <span>•</span>
                            <span>{format(new Date(pass.purchased_at), 'MMM d, h:mm a')}</span>
                            {pass.valid_date && (
                              <>
                                <span>•</span>
                                <span>Visit: {format(new Date(pass.valid_date), 'MMM d')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pass.status)}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Sheet */}
      <GuestDetailSheet 
        guest={selectedGuest} 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
      />
    </AdminLayout>
  );
}
