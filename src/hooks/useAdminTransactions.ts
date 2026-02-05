 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { startOfDay, startOfMonth, format } from "date-fns";
 
 interface Transaction {
   id: string;
   source: "manual_charge" | "payment_attempt";
   member_name: string;
   member_id: string | null;
   type: string;
   amount: number;
   status: string;
   date: string;
   payment_method: string;
   stripe_payment_intent_id: string | null;
 }
 
 interface TransactionStats {
   revenueToday: number;
   revenueThisMonth: number;
   activeSubscriptions: number;
   failedPayments: number;
 }
 
 export function useAdminTransactions() {
   const today = startOfDay(new Date());
   const monthStart = startOfMonth(new Date());
 
   // Fetch manual charges (real transactions from admin charges)
   const { data: manualCharges, isLoading: chargesLoading, error: chargesError } = useQuery({
     queryKey: ["admin-transactions-manual-charges"],
     queryFn: async () => {
       console.log("[useAdminTransactions] Fetching manual_charges...");
       const { data, error } = await supabase
         .from("manual_charges")
         .select(`
           id,
           amount,
           description,
           status,
           created_at,
           stripe_payment_intent_id,
           member_id,
           members!manual_charges_member_id_fkey (
             first_name,
             last_name
           )
         `)
         .order("created_at", { ascending: false })
         .limit(100);
 
       if (error) {
         console.error("[useAdminTransactions] manual_charges error:", error);
         throw error;
       }
       
       console.log("[useAdminTransactions] manual_charges result:", data?.length || 0, "records");
       return data || [];
     },
   });
 
   // Fetch payment attempts (subscription payments, both successful and failed)
   const { data: paymentAttempts, isLoading: attemptsLoading, error: attemptsError } = useQuery({
     queryKey: ["admin-transactions-payment-attempts"],
     queryFn: async () => {
       console.log("[useAdminTransactions] Fetching payment_attempts...");
       const { data, error } = await supabase
         .from("payment_attempts")
         .select(`
           id,
           amount,
           status,
           created_at,
           payment_intent_id,
           invoice_number,
           member_id,
           members!payment_attempts_member_id_fkey (
             first_name,
             last_name
           )
         `)
         .order("created_at", { ascending: false })
         .limit(100);
 
       if (error) {
         console.error("[useAdminTransactions] payment_attempts error:", error);
         // Don't throw - table might be empty or not exist yet
         return [];
       }
       
       console.log("[useAdminTransactions] payment_attempts result:", data?.length || 0, "records");
       return data || [];
     },
   });
 
   // Fetch active subscriptions count
   const { data: subscriptionCount, isLoading: subscriptionLoading } = useQuery({
     queryKey: ["admin-transactions-subscription-count"],
     queryFn: async () => {
       console.log("[useAdminTransactions] Counting active subscriptions...");
       const { count, error } = await supabase
         .from("members")
         .select("*", { count: "exact", head: true })
         .not("stripe_subscription_id", "is", null)
         .eq("status", "active");
 
       if (error) {
         console.error("[useAdminTransactions] subscription count error:", error);
         return 0;
       }
       
       console.log("[useAdminTransactions] active subscriptions:", count);
       return count || 0;
     },
   });
 
   // Transform data into unified transaction format
   const transactions: Transaction[] = [
     // Manual charges
     ...(manualCharges?.map((charge: any) => ({
       id: charge.id,
       source: "manual_charge" as const,
       member_name: charge.members
         ? `${charge.members.first_name || ""} ${charge.members.last_name || ""}`.trim() || "Unknown"
         : "Unknown",
       member_id: charge.member_id,
       type: charge.description || "Manual Charge",
       amount: charge.amount / 100, // Convert cents to dollars
       status: charge.status,
       date: format(new Date(charge.created_at), "MMM d, yyyy"),
       payment_method: "Card on file",
       stripe_payment_intent_id: charge.stripe_payment_intent_id,
     })) || []),
     // Payment attempts (subscription payments)
     ...(paymentAttempts?.map((attempt: any) => ({
       id: attempt.id,
       source: "payment_attempt" as const,
       member_name: attempt.members
         ? `${attempt.members.first_name || ""} ${attempt.members.last_name || ""}`.trim() || "Unknown"
         : "Unknown",
       member_id: attempt.member_id,
       type: attempt.invoice_number ? `Invoice ${attempt.invoice_number}` : "Subscription Payment",
       amount: attempt.amount / 100, // Convert cents to dollars
       status: attempt.status,
       date: format(new Date(attempt.created_at), "MMM d, yyyy"),
       payment_method: "Subscription",
       stripe_payment_intent_id: attempt.payment_intent_id,
     })) || []),
   ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 
   // Calculate stats
   const stats: TransactionStats = {
     revenueToday: (manualCharges || [])
       .filter((c: any) => new Date(c.created_at) >= today && c.status === "succeeded")
       .reduce((sum: number, c: any) => sum + (c.amount / 100), 0) +
       (paymentAttempts || [])
         .filter((p: any) => new Date(p.created_at) >= today && p.status === "succeeded")
         .reduce((sum: number, p: any) => sum + (p.amount / 100), 0),
     
     revenueThisMonth: (manualCharges || [])
       .filter((c: any) => new Date(c.created_at) >= monthStart && c.status === "succeeded")
       .reduce((sum: number, c: any) => sum + (c.amount / 100), 0) +
       (paymentAttempts || [])
         .filter((p: any) => new Date(p.created_at) >= monthStart && p.status === "succeeded")
         .reduce((sum: number, p: any) => sum + (p.amount / 100), 0),
     
     activeSubscriptions: subscriptionCount || 0,
     
     failedPayments: (paymentAttempts || [])
       .filter((p: any) => p.status === "failed").length,
   };
 
   return {
     transactions,
     stats,
     isLoading: chargesLoading || attemptsLoading || subscriptionLoading,
     error: chargesError || attemptsError,
   };
 }