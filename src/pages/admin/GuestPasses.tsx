import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, DollarSign, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

const GUEST_PASS_PRICE = 60;

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  price_paid: number;
  status: 'active' | 'exhausted' | 'expired';
  purchased_at: string;
  expires_at: string;
  used_at: string | null;
}

export default function GuestPasses() {
  const { user } = useAuth();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentPasses, setRecentPasses] = useState<GuestPass[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(false);

  // Fetch recent passes on mount
  useEffect(() => {
    fetchRecentPasses();
  }, []);

  const fetchRecentPasses = async () => {
    setIsLoadingPasses(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase
        .from('guest_passes' as any)
        .select('*')
        .gte('purchased_at', today.toISOString())
        .order('purchased_at', { ascending: false })
        .limit(20) as any);

      if (error) throw error;

      setRecentPasses((data || []) as GuestPass[]);
    } catch (error) {
      console.error('Error fetching recent passes:', error);
      toast.error('Failed to load recent passes');
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
        // Redirect to Stripe checkout
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
      // Clear form
      setGuestName('');
      setGuestEmail('');
      // Refresh recent passes
      fetchRecentPasses();
      // Clean URL
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


  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Passes</h1>
          <p className="text-muted-foreground">
            Sell day passes and guest passes to visitors
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Sell New Pass */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Sell Guest Pass
              </CardTitle>
              <CardDescription>
                Create a new guest pass for a visitor
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
                  Provides access to gym and amenities. Does not include classes, red light therapy, or zero body cryo. Subject to availability.
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
                  placeholder="Enter guest's email (optional)"
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
                    Create Pass & Process Payment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Passes */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Passes</CardTitle>
              <CardDescription>
                Guest passes sold today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPasses ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                </div>
              ) : recentPasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No passes sold today</p>
                  <p className="text-sm">Passes will appear here once created</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPasses.map((pass) => (
                    <div key={pass.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">{pass.guest_name}</div>
                          {pass.guest_email && (
                            <div className="text-sm text-muted-foreground">{pass.guest_email}</div>
                          )}
                          <div className="text-sm text-muted-foreground mt-1">
                            Guest Pass • ${pass.price_paid}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Purchased: {format(new Date(pass.purchased_at), 'MMM d, yyyy h:mm a')}
                          </div>
                          {pass.used_at && (
                            <div className="text-xs text-muted-foreground">
                              Used: {format(new Date(pass.used_at), 'MMM d, yyyy h:mm a')}
                            </div>
                          )}
                        </div>
                        <div>{getStatusBadge(pass.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
