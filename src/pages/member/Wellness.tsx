 import { useState } from "react";
 import { MemberLayout } from "@/components/member/MemberLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Progress } from "@/components/ui/progress";
 import { Skeleton } from "@/components/ui/skeleton";
 import { useUserCredits, MemberCredit } from "@/hooks/useUserCredits";
import { useMySpaAppointments } from "@/hooks/useSpaBooking";
 import { SpaBookingModal } from "@/components/booking/SpaBookingModal";
 import { 
   Zap, 
   Snowflake,
   Calendar,
   Clock,
   Sparkles,
   AlertCircle,
 } from "lucide-react";
 import { format, parseISO, differenceInDays } from "date-fns";
 import { Link } from "react-router-dom";
 import { CREDIT_TYPE_LABELS, CREDIT_TYPE_DESCRIPTIONS, CreditType } from "@/lib/memberCredits";
 
 // Wellness service definitions for booking
 const WELLNESS_SERVICES = {
   redLight: {
     id: 101,
     name: "Red Light Therapy",
     description: "Full-body red light therapy session to boost cellular energy and promote healing",
     duration: "20 min",
     cleanupTime: "5 min",
     price: 45,
     category: "Recovery",
   },
   dryCryo: {
     id: 102,
     name: "Dry Cryotherapy",
     description: "Whole-body dry cryotherapy session for recovery and wellness",
     duration: "3 min",
     cleanupTime: "5 min",
     price: 65,
     category: "Recovery",
   },
 };
 
 export default function MemberWellness() {
   const { data: credits, isLoading: creditsLoading } = useUserCredits();
  const { data: appointments, isLoading: appointmentsLoading } = useMySpaAppointments();
   const [selectedService, setSelectedService] = useState<typeof WELLNESS_SERVICES.redLight | null>(null);
   const [bookingOpen, setBookingOpen] = useState(false);
 
   const isLoading = creditsLoading;
 
   // Filter upcoming wellness appointments
   const wellnessAppointments = appointments?.filter(apt => 
     apt.status === "confirmed" && 
     (apt.service_name?.toLowerCase().includes("red light") || 
      apt.service_name?.toLowerCase().includes("cryo") ||
      apt.service_name?.toLowerCase().includes("zerobody"))
   ) || [];
 
   const handleBookService = (service: typeof WELLNESS_SERVICES.redLight) => {
     setSelectedService(service);
     setBookingOpen(true);
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
             onBook={() => handleBookService(WELLNESS_SERVICES.redLight)}
           />
           <WellnessCreditCard
             credit={credits?.dryCredits || null}
             type="dry_cryo"
             icon={<Snowflake className="h-6 w-6 text-blue-500" />}
             iconBg="bg-blue-100 dark:bg-blue-900/20"
             onBook={() => handleBookService(WELLNESS_SERVICES.dryCryo)}
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
                           {apt.appointment_time}
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