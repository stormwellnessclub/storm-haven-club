import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Search, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { STRIPE_PRODUCTS } from "@/lib/stripeProducts";

interface ImportableSession {
  sessionId: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  currency: string;
  created: number;
  productName: string;
  matched: boolean;
  matchedUserId?: string;
  alreadyImported?: boolean;
}

const KNOWN_PRICE_IDS = [
  { label: "Class Pass Single (Non-Member) — $30", value: STRIPE_PRODUCTS.classPasses.pilatesCycling.single.nonMember },
  { label: "Class Pass 10-Pack (Non-Member) — $285", value: STRIPE_PRODUCTS.classPasses.pilatesCycling.tenPack.nonMember },
  { label: "Class Pass Single (Member) — $25", value: STRIPE_PRODUCTS.classPasses.pilatesCycling.single.member },
  { label: "Class Pass 10-Pack (Member) — $170", value: STRIPE_PRODUCTS.classPasses.pilatesCycling.tenPack.member },
  // Legacy "Other Classes" price IDs (for importing old purchases)
  { label: "[Legacy] Other Classes Single (Non-Member) — $30", value: STRIPE_PRODUCTS.classPasses.otherClasses.single.nonMember },
  { label: "[Legacy] Other Classes 10-Pack (Non-Member) — $180", value: STRIPE_PRODUCTS.classPasses.otherClasses.tenPack.nonMember },
  { label: "[Legacy] Other Classes Single (Member) — $20", value: STRIPE_PRODUCTS.classPasses.otherClasses.single.member },
  { label: "[Legacy] Other Classes 10-Pack (Member) — $150", value: STRIPE_PRODUCTS.classPasses.otherClasses.tenPack.member },
];

export function NonMemberStripeImport() {
  const [priceId, setPriceId] = useState("");
  const [customPriceId, setCustomPriceId] = useState("");
  const [preview, setPreview] = useState<ImportableSession[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const effectivePriceId = priceId === "custom" ? customPriceId : priceId;

  // Fetch preview from Stripe
  const fetchPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!effectivePriceId) throw new Error("Please select a price ID");
      
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_import_stripe_class_passes",
          priceId: effectivePriceId,
          confirm: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.sessions as ImportableSession[];
    },
    onSuccess: (sessions) => {
      setPreview(sessions);
      // Auto-select matched, non-imported sessions
      const autoSelected = new Set<string>();
      sessions.forEach((s) => {
        if (s.matched && !s.alreadyImported) autoSelected.add(s.sessionId);
      });
      setSelectedIds(autoSelected);
      
      if (sessions.length === 0) {
        toast.info("No completed checkout sessions found for this price ID");
      } else {
        toast.success(`Found ${sessions.length} session(s)`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Failed to fetch: ${err.message}`);
    },
  });

  // Confirm import
  const confirmImportMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) throw new Error("No sessions selected");

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_import_stripe_class_passes",
          priceId: effectivePriceId,
          confirm: true,
          sessionIds: Array.from(selectedIds),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported || 0} class pass(es)`);
      setPreview(null);
      setSelectedIds(new Set());
    },
    onError: (err: Error) => {
      toast.error(`Import failed: ${err.message}`);
    },
  });

  const toggleSession = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const matchedCount = preview?.filter((s) => s.matched && !s.alreadyImported).length || 0;
  const unmatchedCount = preview?.filter((s) => !s.matched).length || 0;
  const alreadyImportedCount = preview?.filter((s) => s.alreadyImported).length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Import from Stripe
        </CardTitle>
        <CardDescription>
          Fetch completed Stripe purchases by price ID and import them as class passes. 
          Matches customer emails to existing accounts automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price ID Selection */}
        <div className="space-y-3">
          <Label>Select Price ID</Label>
          <Select value={priceId} onValueChange={(v) => { setPriceId(v); setPreview(null); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a known price ID or enter custom..." />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_PRICE_IDS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom Price ID...</SelectItem>
            </SelectContent>
          </Select>

          {priceId === "custom" && (
            <Input
              placeholder="price_XXXXXX..."
              value={customPriceId}
              onChange={(e) => setCustomPriceId(e.target.value)}
            />
          )}

          <Button
            onClick={() => fetchPreviewMutation.mutate()}
            disabled={!effectivePriceId || fetchPreviewMutation.isPending}
          >
            {fetchPreviewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Fetch Purchases
          </Button>
        </div>

        {/* Preview Results */}
        {preview && (
          <div className="space-y-4 animate-fade-in-fast">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" /> {matchedCount} matched
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {unmatchedCount} unmatched
                </Badge>
              )}
              {alreadyImportedCount > 0 && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  {alreadyImportedCount} already imported
                </Badge>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((session) => (
                  <TableRow key={session.sessionId} className={session.alreadyImported ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(session.sessionId)}
                        onCheckedChange={() => toggleSession(session.sessionId)}
                        disabled={!session.matched || session.alreadyImported}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{session.customerName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{session.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      ${(session.amount / 100).toFixed(2)} {session.currency?.toUpperCase()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.created * 1000).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {session.alreadyImported ? (
                        <Badge variant="secondary" className="text-xs">Imported</Badge>
                      ) : session.matched ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Matched
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          <XCircle className="h-3 w-3 mr-1" /> No Account
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {selectedIds.size > 0 && (
              <Button
                onClick={() => confirmImportMutation.mutate()}
                disabled={confirmImportMutation.isPending}
              >
                {confirmImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import {selectedIds.size} Selected
              </Button>
            )}

            {unmatchedCount > 0 && (
              <div className="p-3 rounded-sm border border-amber-200 bg-amber-50 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                {unmatchedCount} purchase(s) have no matching account. Use the <strong>Activation</strong> tab to send them a sign-up link.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
