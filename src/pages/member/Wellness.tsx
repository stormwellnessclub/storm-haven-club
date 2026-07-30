import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
 import { MemberLayout } from "@/components/member/MemberLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Progress } from "@/components/ui/progress";
 import { Skeleton } from "@/components/ui/skeleton";
 import { useUserCredits, MemberCredit } from "@/hooks/useUserCredits";
import { useMySpaAppointments } from "@/hooks/useSpaBooking";
 import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
import type { SpaService } from "@/hooks/useSpaManagement";
 import {
   Zap,
   Snowflake,
   Calendar,
   Clock,
   Sparkles,
   AlertCircle,
   Flame,
 } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { formatTime12h } from "@/lib/timeFormat";
 import { Link } from "react-router-dom";
 import { CREDIT_TYPE_LABELS, CREDIT_TYPE_DESCRIPTIONS, CreditType } from "@/lib/memberCredits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
 
// Fetch the real Recovery services (Red Light & Ice Bed) from the DB so booking
// hits real spa_service_availability rows.
function useWellnessServices() {
  return useQuery({
    queryKey: ["wellness-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_services")
        .select("*")
        .eq("is_active", true)
        .or("name.ilike.%red light%,name.ilike.%ice bed%,name.ilike.%zerobody%,name.ilike.%dry cryo%");
      if (error) throw error;
      const all = (data || []) as SpaService[];
      // Prefer the 20-min Red Light variant, fall back to any red-light service.
      const redLight =
        all.find((s) => /red light/i.test(s.name) && s.duration_minutes === 20) ||
        all.find((s) => /red light/i.test(s.name)) ||
        null;
      const dryCryo =
        all.find((s) => /ice bed|zerobody|dry cryo|cryo/i.test(s.name)) || null;
      return { redLight, dryCryo };
    },
  });
}

export default function MemberWellness() {
  const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const { data: appointments, isLoading: appointmentsLoading } = useMySpaAppointments();
  const { data: services, isLoading: servicesLoading } = useWellnessServices();
  const [selectedService, setSelectedService] = useState<SpaService | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const { profile } = useUserProfile();
  const { user } = useAuth();

  // Ozone Sauna request state (request-only: staff call to confirm)
  const [ozoneOpen, setOzoneOpen] = useState(false);
  const [ozoneName, setOzoneName] = useState("");
  const [ozonePhone, setOzonePhone] = useState("");
  const [ozoneEmail, setOzoneEmail] = useState("");
  const [ozonePreferred, setOzonePreferred] = useState("");
  const [ozoneMessage, setOzoneMessage] = useState("");
  const [ozoneSubmitting, setOzoneSubmitting] = useState(false);

  const isLoading = creditsLoading || servicesLoading;
 
   // Filter upcoming wellness appointments
   const wellnessAppointments = appointments?.filter(apt => 
     apt.status === "confirmed" && 
     (apt.service_name?.toLowerCase().includes("red light") || 
      apt.service_name?.toLowerCase().includes("cryo") ||
      apt.service_name?.toLowerCase().includes("ozone") ||
      apt.service_name?.toLowerCase().includes("zerobody"))
   ) || [];
 
   const handleBookService = (service: SpaService | null | undefined) => {
     if (!service) return;
     setSelectedService(service);
     setBookingOpen(true);
   };

   const openOzoneRequest = () => {
     setOzoneName(
       [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
         (user?.user_metadata?.first_name
           ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
           : "")
     );
     setOzonePhone((profile as any)?.phone || "");
     setOzoneEmail(user?.email || (profile as any)?.email || "");
     setOzonePreferred("");
     setOzoneMessage("");
     setOzoneOpen(true);
   };

   const submitOzoneRequest = async () => {
     if (!ozoneName.trim() || !ozoneEmail.trim()) {
       toast.error("Please add your name and email.");
       return;
     }
     if (ozonePhone.trim().length < 7) {
       toast.error("A phone number is required — we call to go over details before your session.");
       return;
     }
     setOzoneSubmitting(true);
     try {
       const { error } = await supabase.from("spa_service_requests").insert({
         name: ozoneName.trim(),
         email: ozoneEmail.trim(),
         phone: ozonePhone.trim(),
         preferred_time: ozonePreferred.trim() || null,
         service_name: "Ozone Sauna",
         service_category: "Recovery",
         message: ozoneMessage.trim() || null,
       });
       if (error) throw error;
       toast.success("Request received — we'll call you to confirm your appointment.");
       setOzoneOpen(false);
     } catch (err: any) {
       toast.error("Failed to submit request: " + err.message);
     } finally {
       setOzoneSubmitting(false);
     }
   };
 
 
   if (isLoading) {
     return (
       <MemberLayout title="Wellness Booking">
         <div className="space-y-6">
           <div className="grid gap-4 md:grid-cols-2">
             <Skeleton className="h-48 w-full" />
             <Skeleton className="h-48 w-full" />
           </div>
           <Skeleton className="h-64 w-full" />
         </div>
       </MemberLayout>
     );
   }
 
   const hasWellnessCredits = credits?.redLightCredits || credits?.dryCredits;
 
   return (
     <MemberLayout title="Wellness Booking">
       <div className="space-y-8">
         {/* Header */}
         <div>
           <p className="text-muted-foreground">
             Book recovery services and manage your wellness credits
           </p>
         </div>
 
         {/* Credit Balance Cards */}
         <div className="grid gap-4 md:grid-cols-2">
           <WellnessCreditCard
             credit={credits?.redLightCredits || null}
             type="red_light"
             icon={<Zap className="h-6 w-6 text-orange-500" />}
             iconBg="bg-orange-100 dark:bg-orange-900/20"
             onBook={() => handleBookService(services?.redLight)}
           />
           <WellnessCreditCard
             credit={credits?.dryCredits || null}
             type="dry_cryo"
             icon={<Snowflake className="h-6 w-6 text-blue-500" />}
             iconBg="bg-blue-100 dark:bg-blue-900/20"
             onBook={() => handleBookService(services?.dryCryo)}
           />
         </div>
 
         {/* No credits message */}
         {!hasWellnessCredits && credits?.isMember && (
           <Card>
             <CardContent className="py-8 text-center">
               <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
               <p className="text-muted-foreground mb-4">
                 Wellness credits are included with Gold, Platinum, and Diamond memberships
               </p>
               <Button asChild variant="outline">
                 <Link to="/memberships">View Membership Tiers</Link>
               </Button>
             </CardContent>
           </Card>
         )}
 
         {/* Upcoming Wellness Appointments */}
         <Card>
           <CardHeader>
             <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-accent" />
               <CardTitle>Upcoming Wellness Appointments</CardTitle>
             </div>
             <CardDescription>
               Your scheduled recovery sessions
             </CardDescription>
           </CardHeader>
           <CardContent>
             {appointmentsLoading ? (
               <div className="space-y-3">
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
               </div>
             ) : wellnessAppointments.length > 0 ? (
               <div className="space-y-3">
                 {wellnessAppointments.map((apt) => (
                   <div
                     key={apt.id}
                     className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                   >
                     <div className="flex items-center gap-3">
                       {apt.service_name?.toLowerCase().includes("red light") ? (
                         <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                           <Zap className="h-4 w-4 text-orange-500" />
                         </div>
                       ) : (
                         <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
                           <Snowflake className="h-4 w-4 text-blue-500" />
                         </div>
                       )}
                       <div>
                         <p className="font-medium">{apt.service_name}</p>
                         <div className="flex items-center gap-2 text-sm text-muted-foreground">
                           <Calendar className="h-3 w-3" />
                           {format(parseISO(apt.appointment_date), "MMM d, yyyy")}
                           <Clock className="h-3 w-3 ml-2" />
                           {formatTime12h(apt.appointment_time)}
                         </div>
                       </div>
                     </div>
                     <Badge variant="outline">{apt.status}</Badge>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-8">
                 <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                 <p className="text-muted-foreground">
                   No upcoming wellness appointments
                 </p>
                 {hasWellnessCredits && (
                   <p className="text-sm text-muted-foreground mt-2">
                     Book a session using your credits above
                   </p>
                 )}
               </div>
             )}
           </CardContent>
         </Card>
 
         {/* Booking Modal */}
         <SpaBookingModal
           service={selectedService}
           open={bookingOpen}
           onOpenChange={setBookingOpen}
         />
       </div>
     </MemberLayout>
   );
 }
 
 interface WellnessCreditCardProps {
   credit: MemberCredit | null;
   type: CreditType;
   icon: React.ReactNode;
   iconBg: string;
   onBook: () => void;
 }
 
 function WellnessCreditCard({ credit, type, icon, iconBg, onBook }: WellnessCreditCardProps) {
   if (!credit) {
     return (
       <Card>
         <CardHeader>
           <div className="flex items-center gap-3">
             <div className={`p-3 rounded-full ${iconBg}`}>
               {icon}
             </div>
             <div>
               <CardTitle className="text-lg">{CREDIT_TYPE_LABELS[type]}</CardTitle>
               <CardDescription>{CREDIT_TYPE_DESCRIPTIONS[type]}</CardDescription>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           <div className="text-center py-4">
             <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
             <p className="text-sm text-muted-foreground">
               No credits available
             </p>
           </div>
         </CardContent>
       </Card>
     );
   }
 
   const expiresDate = parseISO(credit.expires_at);
   const daysRemaining = differenceInDays(expiresDate, new Date());
   const isExpiringSoon = daysRemaining <= 7;
   const percentUsed = ((credit.credits_total - credit.credits_remaining) / credit.credits_total) * 100;
 
   return (
     <Card>
       <CardHeader>
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className={`p-3 rounded-full ${iconBg}`}>
               {icon}
             </div>
             <div>
               <CardTitle className="text-lg">{CREDIT_TYPE_LABELS[type]}</CardTitle>
               <CardDescription>{CREDIT_TYPE_DESCRIPTIONS[type]}</CardDescription>
             </div>
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         <div className="flex items-end gap-2">
           <span className="text-4xl font-bold">{credit.credits_remaining}</span>
           <span className="text-muted-foreground mb-1">
             of {credit.credits_total} sessions remaining
           </span>
         </div>
         <Progress 
           value={100 - percentUsed} 
           className="h-3"
         />
         <div className="flex items-center justify-between text-sm">
           <div className="flex items-center gap-2">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span className={isExpiringSoon ? "text-destructive" : "text-muted-foreground"}>
               {daysRemaining} days until renewal
               {isExpiringSoon && " (expiring soon)"}
             </span>
           </div>
         </div>
         <Button 
           onClick={onBook} 
           className="w-full"
           disabled={credit.credits_remaining <= 0}
         >
           Book Session
         </Button>
       </CardContent>
     </Card>
   );
 }