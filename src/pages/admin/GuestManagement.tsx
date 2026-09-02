import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Users, Mail, Phone, Calendar, CreditCard, DollarSign, Loader2,
  User, CheckCircle2, XCircle, Clock, Sparkles, Plus, Send, ExternalLink,
  FileText, Pencil, Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { GUEST_PASS_COLUMNS } from "@/lib/guestPassStatus";

interface GuestRecord {
  id: string;
  guest_name: string;
  guest_email: string | null;
  phone_number: string | null;
  guest_gender: string | null;
  stripe_customer_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: string;
  purchased_at: string;
  valid_date: string | null;
  used_at: string | null;
  price_paid: number;
  add_ons: any;
  admin_notes: string | null;
  member_referral: string | null;
  no_show: boolean | null;
  expires_at: string;
  visit_interests: string[] | null;
  visit_notes: string | null;
  stripe_payment_id: string | null;
  checked_in_by: string | null;
  feedback_email_sent_at: string | null;
}

interface GuestService {
  id: string;
  guest_pass_id: string | null;
  guest_email: string | null;
  guest_name: string;
  service_name: string;
  service_category: string;
  amount: number;
  status: string;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  service_date: string;
  created_at: string;
}

// Group guest passes by email/name to create "guest profiles"
interface GuestProfile {
  key: string; // email or name-based key
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  stripe_customer_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  passes: GuestRecord[];
  totalSpent: number;
  visitCount: number;
  lastVisit: string | null;
  firstVisit: string;
}

const SERVICE_OPTIONS = [
  { value: "ice_bed", label: "Ice Bed / Zero Body Cryo", price: 45 },
  { value: "red_light", label: "Red Light Therapy", price: 35 },
  { value: "salt_room", label: "Salt Room", price: 30 },
  { value: "cold_plunge", label: "Cold Plunge", price: 25 },
  { value: "sauna", label: "Sauna Session", price: 20 },
  { value: "steam_room", label: "Steam Room", price: 20 },
  { value: "spa_service", label: "Spa Service", price: 0 },
  { value: "class_drop_in", label: "Class Drop-In", price: 35 },
  { value: "other", label: "Other", price: 0 },
];

export default function GuestManagement() {
  const { user } = useAuth();
  const [passes, setPasses] = useState<GuestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [guestServices, setGuestServices] = useState<GuestService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Add service form
  const [addingService, setAddingService] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");
  const [serviceNotes, setServiceNotes] = useState("");
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("guest_passes" as any)
      .select(GUEST_PASS_COLUMNS)
      .order("purchased_at", { ascending: false }) as any);
    if (!error && data) {
      setPasses(data as GuestRecord[]);
    }
    setLoading(false);
  };

  // Group passes into guest profiles
  const guestProfiles = useMemo(() => {
    const profileMap = new Map<string, GuestProfile>();

    passes.forEach((pass) => {
      const key = pass.guest_email?.toLowerCase() || `name:${pass.guest_name.toLowerCase()}`;
      const existing = profileMap.get(key);

      if (existing) {
        existing.passes.push(pass);
        existing.totalSpent += pass.price_paid;
        if (pass.used_at) existing.visitCount++;
        if (pass.used_at && (!existing.lastVisit || pass.used_at > existing.lastVisit)) {
          existing.lastVisit = pass.used_at;
        }
        if (pass.purchased_at < existing.firstVisit) {
          existing.firstVisit = pass.purchased_at;
        }
        // Update card info if available
        if (pass.stripe_customer_id && !existing.stripe_customer_id) {
          existing.stripe_customer_id = pass.stripe_customer_id;
        }
        if (pass.card_last4 && !existing.card_last4) {
          existing.card_brand = pass.card_brand;
          existing.card_last4 = pass.card_last4;
          existing.card_exp_month = pass.card_exp_month;
          existing.card_exp_year = pass.card_exp_year;
        }
        if (pass.phone_number && !existing.phone) {
          existing.phone = pass.phone_number;
        }
      } else {
        profileMap.set(key, {
          key,
          name: pass.guest_name,
          email: pass.guest_email,
          phone: pass.phone_number,
          gender: pass.guest_gender,
          stripe_customer_id: pass.stripe_customer_id,
          card_brand: pass.card_brand,
          card_last4: pass.card_last4,
          card_exp_month: pass.card_exp_month,
          card_exp_year: pass.card_exp_year,
          passes: [pass],
          totalSpent: pass.price_paid,
          visitCount: pass.used_at ? 1 : 0,
          lastVisit: pass.used_at,
          firstVisit: pass.purchased_at,
        });
      }
    });

    return Array.from(profileMap.values()).sort((a, b) =>
      new Date(b.firstVisit).getTime() - new Date(a.firstVisit).getTime()
    );
  }, [passes]);

  const filteredProfiles = useMemo(() => {
    if (!searchQuery) return guestProfiles;
    const q = searchQuery.toLowerCase();
    return guestProfiles.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.phone?.toLowerCase().includes(q)
    );
  }, [guestProfiles, searchQuery]);

  const openGuestDetail = async (guest: GuestProfile) => {
    setSelectedGuest(guest);
    setDetailOpen(true);
    setAddingService(false);
    // Fetch services for this guest
    fetchGuestServices(guest);
  };

  const fetchGuestServices = async (guest: GuestProfile) => {
    setLoadingServices(true);
    const passIds = guest.passes.map((p) => p.id);
    const { data, error } = await (supabase
      .from("guest_services" as any)
      .select("*")
      .in("guest_pass_id", passIds)
      .order("created_at", { ascending: false }) as any);
    if (!error && data) {
      setGuestServices(data as GuestService[]);
    }
    setLoadingServices(false);
  };

  const handleAddService = async () => {
    if (!selectedGuest || !serviceType || !user) return;
    setSavingService(true);
    const serviceOption = SERVICE_OPTIONS.find((s) => s.value === serviceType);
    const amount = serviceAmount ? parseFloat(serviceAmount) : serviceOption?.price || 0;
    const latestPass = selectedGuest.passes[0];

    try {
      const { error } = await (supabase.from("guest_services" as any).insert({
        guest_pass_id: latestPass.id,
        guest_email: selectedGuest.email,
        guest_name: selectedGuest.name,
        service_name: serviceOption?.label || serviceType,
        service_category: serviceType,
        amount,
        status: "pending",
        charged_by: user.id,
        notes: serviceNotes || null,
        service_date: new Date().toISOString().split("T")[0],
      }) as any);

      if (error) throw error;
      toast.success("Service added");
      setAddingService(false);
      setServiceType("");
      setServiceAmount("");
      setServiceNotes("");
      fetchGuestServices(selectedGuest);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add service");
    } finally {
      setSavingService(false);
    }
  };

  const handleChargeGuest = async (service: GuestService) => {
    if (!selectedGuest?.stripe_customer_id) {
      toast.error("No card on file for this guest. Use 'Send Payment Link' instead.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card",
          stripeCustomerId: selectedGuest.stripe_customer_id,
          amount: Math.round(service.amount * 100),
          description: `Guest Service: ${service.service_name} - ${selectedGuest.name}`,
          metadata: {
            guest_service_id: service.id,
            guest_name: selectedGuest.name,
          },
        },
      });

      if (error) throw error;

      // Update service status
      await (supabase
        .from("guest_services" as any)
        .update({
          status: "charged",
          stripe_payment_intent_id: data?.paymentIntentId || null,
        })
        .eq("id", service.id) as any);

      toast.success(`Charged $${service.amount.toFixed(2)} to ${selectedGuest.name}`);
      fetchGuestServices(selectedGuest);
    } catch (err: any) {
      toast.error(err?.message || "Failed to charge guest");
    }
  };

  const handleSendPaymentLink = async (service: GuestService) => {
    if (!selectedGuest?.email) {
      toast.error("No email on file for this guest");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_payment_link",
          guestEmail: selectedGuest.email,
          guestName: selectedGuest.name,
          amount: Math.round(service.amount * 100),
          description: service.service_name,
          serviceId: service.id,
          successUrl: `${window.location.origin}/admin/guests?payment=success`,
          cancelUrl: `${window.location.origin}/admin/guests?payment=cancelled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Update service status
        await (supabase
          .from("guest_services" as any)
          .update({ status: "link_sent" })
          .eq("id", service.id) as any);

        toast.success("Payment link created! Opening...");
        window.open(data.url, "_blank");
        fetchGuestServices(selectedGuest);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create payment link");
    }
  };

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case "charged":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">Charged</Badge>;
      case "link_sent":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs">Link Sent</Badge>;
      case "paid":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">Paid</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Pending</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Management</h1>
          <p className="text-muted-foreground">
            View guest profiles, visit history, saved cards, and charge for services
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{guestProfiles.length}</p>
                  <p className="text-xs text-muted-foreground">Total Guests</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {guestProfiles.reduce((sum, g) => sum + g.visitCount, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Visits</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    ${guestProfiles.reduce((sum, g) => sum + g.totalSpent, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Guest List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Guests ({filteredProfiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No guests found</p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Visits</TableHead>
                      <TableHead>Card on File</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Visit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((guest) => {
                      const initials = guest.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <TableRow
                          key={guest.key}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openGuestDetail(guest)}
                        >
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{guest.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {guest.email && (
                                <span className="text-muted-foreground">{guest.email}</span>
                              )}
                              {guest.phone && (
                                <span className="text-muted-foreground block text-xs">{guest.phone}</span>
                              )}
                              {!guest.email && !guest.phone && (
                                <span className="text-muted-foreground italic text-xs">No contact</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {guest.visitCount} visit{guest.visitCount !== 1 ? "s" : ""}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {guest.card_last4 ? (
                              <span className="text-xs font-mono">
                                {guest.card_brand?.toUpperCase()} •••• {guest.card_last4}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            ${guest.totalSpent.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {guest.lastVisit
                              ? format(new Date(guest.lastVisit), "MMM d, yyyy")
                              : "Not yet"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guest Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedGuest && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedGuest.name}
                </SheetTitle>
                <SheetDescription>Guest profile, visit history & billing</SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="profile" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
                  <TabsTrigger value="visits" className="flex-1">
                    Visits ({selectedGuest.passes.length})
                  </TabsTrigger>
                  <TabsTrigger value="services" className="flex-1">
                    Services
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6 mt-4">
                  {/* Contact Info */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
                    <div className="space-y-2">
                      {selectedGuest.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${selectedGuest.email}`} className="hover:underline">
                            {selectedGuest.email}
                          </a>
                        </div>
                      )}
                      {selectedGuest.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${selectedGuest.phone}`} className="hover:underline">
                            {selectedGuest.phone}
                          </a>
                        </div>
                      )}
                      {selectedGuest.gender && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize">{selectedGuest.gender}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Card on File */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Method
                    </h4>
                    {selectedGuest.card_last4 ? (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-mono text-sm">
                          {selectedGuest.card_brand?.toUpperCase()} •••• {selectedGuest.card_last4}
                        </p>
                        {selectedGuest.card_exp_month && selectedGuest.card_exp_year && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires {selectedGuest.card_exp_month}/{selectedGuest.card_exp_year}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground italic">
                          No card on file.
                        </p>
                        {selectedGuest.email && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                toast.info("Creating card setup link...");
                                const { data, error } = await supabase.functions.invoke("stripe-payment", {
                                  body: {
                                    action: "create_guest_setup_intent",
                                    guestEmail: selectedGuest.email,
                                    guestName: selectedGuest.name,
                                  },
                                });
                                if (error) throw error;
                                if (data?.error) throw new Error(data.error);
                                if (data?.url) {
                                  window.open(data.url, "_blank");
                                  toast.success("Card setup link opened. Share it with the guest or have them complete it now.");
                                }
                              } catch (err: any) {
                                toast.error(err?.message || "Failed to create card setup link");
                              }
                            }}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Request Card on File
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Summary Stats */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Summary</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-xl font-bold">{selectedGuest.visitCount}</p>
                        <p className="text-xs text-muted-foreground">Visits</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-xl font-bold">${selectedGuest.totalSpent.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Total Spent</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-sm font-medium">
                          {format(new Date(selectedGuest.firstVisit), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">First Pass</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-sm font-medium">
                          {selectedGuest.lastVisit
                            ? format(new Date(selectedGuest.lastVisit), "MMM d, yyyy")
                            : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Last Visit</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Visits Tab */}
                <TabsContent value="visits" className="space-y-4 mt-4">
                  {selectedGuest.passes.map((pass) => (
                    <div key={pass.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">Guest Pass</span>
                        {pass.no_show ? (
                          <Badge variant="destructive" className="text-xs">No-Show</Badge>
                        ) : (pass.status === "exhausted" || pass.status === "used") ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-xs">Checked In</Badge>
                        ) : pass.status === "active" ? (
                          <Badge className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Expired</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {pass.valid_date && (
                          <p>Visit Date: {format(new Date(pass.valid_date), "MMM d, yyyy")}</p>
                        )}
                        <p>Purchased: {format(new Date(pass.purchased_at), "MMM d, yyyy h:mm a")}</p>
                        {pass.used_at && (
                          <p>Checked In: {format(new Date(pass.used_at), "MMM d, yyyy h:mm a")}</p>
                        )}
                        {pass.member_referral && <p>Guest of: {pass.member_referral}</p>}
                        <p className="font-medium text-foreground">${pass.price_paid.toFixed(2)}</p>
                      </div>
                      {pass.add_ons && Array.isArray(pass.add_ons) && pass.add_ons.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Add-ons: </span>
                          {(pass.add_ons as any[]).map((a: any) => a.label).join(", ")}
                        </div>
                      )}
                      {pass.admin_notes && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          {pass.admin_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </TabsContent>

                {/* Services Tab */}
                <TabsContent value="services" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Services & Charges</h4>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingService(!addingService)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Service
                    </Button>
                  </div>

                  {/* Add Service Form */}
                  {addingService && (
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="space-y-2">
                          <Label>Service</Label>
                          <Select value={serviceType} onValueChange={(v) => {
                            setServiceType(v);
                            const opt = SERVICE_OPTIONS.find(s => s.value === v);
                            if (opt && opt.price > 0) setServiceAmount(opt.price.toString());
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service..." />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label} {s.price > 0 && `($${s.price})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={serviceAmount}
                            onChange={(e) => setServiceAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={serviceNotes}
                            onChange={(e) => setServiceNotes(e.target.value)}
                            placeholder="Optional notes..."
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleAddService}
                            disabled={!serviceType || savingService}
                          >
                            {savingService ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddingService(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Services List */}
                  {loadingServices ? (
                    <div className="text-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : guestServices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No services recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {guestServices.map((service) => (
                        <div
                          key={service.id}
                          className="p-4 border rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{service.service_name}</span>
                            {getServiceStatusBadge(service.status)}
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {format(new Date(service.service_date), "MMM d, yyyy")}
                            </span>
                            <span className="font-medium">${Number(service.amount).toFixed(2)}</span>
                          </div>
                          {service.notes && (
                            <p className="text-xs text-muted-foreground">{service.notes}</p>
                          )}
                          {service.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              {selectedGuest?.stripe_customer_id && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleChargeGuest(service)}
                                >
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Charge Card
                                </Button>
                              )}
                              {selectedGuest?.email && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSendPaymentLink(service)}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Send Link
                                </Button>
                              )}
                              {!selectedGuest?.stripe_customer_id && !selectedGuest?.email && (
                                <p className="text-xs text-muted-foreground italic">
                                  No card or email on file to charge
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
