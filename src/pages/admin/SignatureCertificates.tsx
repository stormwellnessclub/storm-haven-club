import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, FileSignature, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

type ProfileRow = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  waiver_signed_at: string | null;
  membership_agreement_signed_at: string | null;
  single_class_pass_agreement_signed_at: string | null;
  class_package_agreement_signed_at: string | null;
  guest_pass_agreement_signed_at: string | null;
  kids_care_agreement_signed_at: string | null;
  private_event_agreement_signed_at: string | null;
};

const AGREEMENTS: { type: string; label: string; column: keyof ProfileRow }[] = [
  { type: "liability_waiver", label: "Liability Waiver", column: "waiver_signed_at" },
  { type: "membership_agreement", label: "Membership Agreement", column: "membership_agreement_signed_at" },
  { type: "single_class_pass", label: "Single Class Pass Agreement", column: "single_class_pass_agreement_signed_at" },
  { type: "class_package", label: "Class Package Agreement", column: "class_package_agreement_signed_at" },
  { type: "guest_pass", label: "Guest Pass Agreement", column: "guest_pass_agreement_signed_at" },
  { type: "kids_care", label: "Kids Care Agreement", column: "kids_care_agreement_signed_at" },
  { type: "private_event", label: "Private Event Agreement", column: "private_event_agreement_signed_at" },
];

export default function SignatureCertificates() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [agreementType, setAgreementType] = useState<string>("single_class_pass");
  const [downloading, setDownloading] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["sig-cert-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, user_id, first_name, last_name, email, phone, waiver_signed_at, membership_agreement_signed_at, single_class_pass_agreement_signed_at, class_package_agreement_signed_at, guest_pass_agreement_signed_at, kids_care_agreement_signed_at, private_event_agreement_signed_at",
        )
        .or(
          `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`,
        )
        .limit(25);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const selected = useMemo(
    () => results.find((r) => r.user_id === selectedUserId) ?? null,
    [results, selectedUserId],
  );

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/generate-signature-certificate`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ user_id: selected.user_id, agreement_type: agreementType }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      const name = `${selected.last_name || "user"}`.replace(/[^a-z0-9]/gi, "");
      a.download = `Signature-Certificate-${name}-${agreementType}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Certificate downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate certificate");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSignature className="h-7 w-7" />
            Signature Certificates
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate a Stripe-ready Certificate of Electronic Signature for any signed agreement.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Find member</CardTitle>
            <CardDescription>Search by name, email, or phone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nejme, fardaus@..., (555)..."
                className="pl-9"
              />
            </div>
            {isFetching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            )}
            {search.trim().length >= 2 && !isFetching && results.length === 0 && (
              <p className="text-sm text-muted-foreground">No matches.</p>
            )}
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => setSelectedUserId(r.user_id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedUserId === r.user_id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="font-medium">
                    {r.first_name} {r.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{r.email}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>2. Choose agreement</CardTitle>
              <CardDescription>
                Showing signature status on file for {selected.first_name} {selected.last_name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-2">
                {AGREEMENTS.map((a) => {
                  const signedAt = selected[a.column] as string | null;
                  const signed = !!signedAt;
                  return (
                    <button
                      key={a.type}
                      onClick={() => setAgreementType(a.type)}
                      className={`text-left p-3 rounded-md border transition-colors ${
                        agreementType === a.type
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{a.label}</div>
                        {signed ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Signed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" /> Not signed
                          </Badge>
                        )}
                      </div>
                      {signedAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(signedAt), "PPpp")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button onClick={handleDownload} disabled={downloading}>
                  {downloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Generate Certificate PDF
                </Button>
                <p className="text-xs text-muted-foreground">
                  Includes cover page + embedded agreement PDF. Upload directly to Stripe.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
