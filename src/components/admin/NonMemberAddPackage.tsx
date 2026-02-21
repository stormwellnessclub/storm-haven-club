import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Search, Loader2, CheckCircle } from "lucide-react";
import { addDays, format } from "date-fns";

export function NonMemberAddPackage() {
  const [email, setEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ id: string; email: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [passType, setPassType] = useState<string>("");
  const [expirationDays, setExpirationDays] = useState("90");
  const queryClient = useQueryClient();

  const searchUser = async () => {
    if (!email) return;
    setSearching(true);
    setFoundUser(null);

    try {
      // Search non_member_profiles first
      const { data: profile } = await supabase
        .from("non_member_profiles")
        .select("user_id, email")
        .ilike("email", email.trim())
        .maybeSingle();

      if (profile) {
        setFoundUser({ id: profile.user_id, email: profile.email || email });
        return;
      }

      // Fallback: search profiles table
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_id, email")
        .ilike("email", email.trim())
        .maybeSingle();

      if (userProfile) {
        setFoundUser({ id: userProfile.user_id, email: userProfile.email || email });
      } else {
        toast.error("No account found with that email. Send an activation link first.");
      }
    } finally {
      setSearching(false);
    }
  };

  const classCountMap: Record<string, number> = {
    single: 1,
    tenPack: 10,
  };

  const addPackageMutation = useMutation({
    mutationFn: async () => {
      if (!foundUser || !category || !passType) {
        throw new Error("Please fill all fields");
      }

      const classCount = classCountMap[passType] || 1;
      const expiresAt = addDays(new Date(), parseInt(expirationDays));

      // Map category to DB enum values
      const categoryMap: Record<string, "pilates_cycling" | "other" | "reformer" | "cycling" | "aerobics"> = {
        pilatesCycling: "pilates_cycling",
        otherClasses: "other",
      };

      const dbCategory = categoryMap[category] || "other";

      const { error } = await supabase.from("class_passes").insert({
        user_id: foundUser.id,
        category: dbCategory,
        pass_type: passType === "tenPack" ? "10-pack" : "single",
        classes_total: classCount,
        classes_remaining: classCount,
        price_paid: 0,
        is_member_price: false,
        expires_at: expiresAt.toISOString(),
        status: "active" as const,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package added successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-non-member-accounts"] });
      setFoundUser(null);
      setEmail("");
      setCategory("");
      setPassType("");
    },
    onError: (err: Error) => {
      toast.error(`Failed to add package: ${err.message}`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Add Package Manually
        </CardTitle>
        <CardDescription>
          Grant class pass credits to a non-member account. This is useful for pre-sale imports or complimentary credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Find User */}
        <div className="space-y-2">
          <Label>Step 1: Find User by Email</Label>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFoundUser(null);
              }}
              className="flex-1"
            />
            <Button onClick={searchUser} disabled={!email || searching} variant="outline">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          {foundUser && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-sm border border-green-200">
              <CheckCircle className="h-4 w-4" />
              Found: {foundUser.email}
            </div>
          )}
        </div>

        {/* Step 2: Configure Package */}
        {foundUser && (
          <div className="space-y-4 animate-fade-in-fast">
            <Label>Step 2: Configure Package</Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilatesCycling">Pilates / Cycling</SelectItem>
                    <SelectItem value="otherClasses">Other Classes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pass Type</Label>
                <Select value={passType} onValueChange={setPassType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Class</SelectItem>
                    <SelectItem value="tenPack">10-Pack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expires In (days)</Label>
                <Input
                  type="number"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  min="1"
                  max="365"
                />
              </div>
            </div>

            {category && passType && (
              <div className="p-4 rounded-sm border border-border bg-muted/20">
                <p className="text-sm">
                  <strong>Summary:</strong> {classCountMap[passType] || 1} class credit{(classCountMap[passType] || 1) > 1 ? "s" : ""} for{" "}
                  <span className="capitalize">{category === "pilatesCycling" ? "Pilates/Cycling" : "Other Classes"}</span>,
                  expiring {format(addDays(new Date(), parseInt(expirationDays)), "MMM d, yyyy")}.
                  Marked as admin grant (no charge).
                </p>
              </div>
            )}

            <Button
              onClick={() => addPackageMutation.mutate()}
              disabled={!category || !passType || addPackageMutation.isPending}
              className="w-full sm:w-auto"
            >
              {addPackageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Add Package
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
