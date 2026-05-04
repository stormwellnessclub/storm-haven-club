import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Send,
  Loader2,
  Search,
  Users,
  AlertTriangle,
  TestTube2,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Paperclip,
  Copy,
} from "lucide-react";
import { SmsMediaPicker } from "../SmsMediaPicker";
import { estimateCost, segments } from "@/lib/smsCosts";

interface Recipient {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  sms_opt_in: boolean;
  status?: string;
  membership_type?: string | null;
  source: "member" | "non_member";
}

interface SendResult {
  recipient: Recipient;
  success: boolean;
  error?: string;
  twilioSid?: string;
}

export function SmsBlastTab() {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // === Test SMS card ===
  const [testPhone, setTestPhone] = useState("");
  const [testBody, setTestBody] = useState(
    "Storm Wellness Club: test message from admin. Reply STOP to opt out.",
  );
  const [testMedia, setTestMedia] = useState<string[]>([]);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (profile?.phone && !testPhone) setTestPhone(profile.phone);
  }, [profile?.phone]);

  const testCost = useMemo(
    () => estimateCost({ recipients: 1, body: testBody, hasMedia: testMedia.length > 0 }),
    [testBody, testMedia.length],
  );

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      toast.error("Enter a phone number.");
      return;
    }
    if (!testBody.trim() && testMedia.length === 0) {
      toast.error("Add a message or image.");
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: { phone: testPhone, userId: user?.id },
          templateKey: "admin-custom",
          variables: { customBody: testBody || " " },
          idempotencyKey: `test-${Date.now()}`,
          metadata: { source: "admin_sms_test" },
          bypassConsent: true,
          mediaUrls: testMedia,
        },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.success === false) throw new Error(d?.error || "Send failed");
      setTestResult({
        ok: true,
        msg: `Sent! Twilio SID: ${d?.twilio_sid ?? "(none)"}`,
      });
      toast.success(`${testCost.type} sent`);
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || "Failed" });
      toast.error(e.message || "Failed to send");
    } finally {
      setTestSending(false);
    }
  };

  // === Bulk blast ===
  const [audienceStatus, setAudienceStatus] = useState<string>("active");
  const [audienceTier, setAudienceTier] = useState<string>("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [blastBody, setBlastBody] = useState("");
  const [blastMedia, setBlastMedia] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingAudience(true);
      let q = supabase
        .from("members")
        .select("id, user_id, first_name, last_name, phone, email, status, membership_type")
        .not("phone", "is", null);
      if (audienceStatus !== "all") q = q.eq("status", audienceStatus);
      const { data: members } = await q.limit(1000);

      // Get sms_opt_in flags from profiles
      const userIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
      let optInMap = new Map<string, boolean>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, sms_opt_in")
          .in("user_id", userIds);
        for (const p of profs ?? []) {
          optInMap.set((p as any).user_id, (p as any).sms_opt_in === true);
        }
      }

      const list: Recipient[] = (members ?? [])
        .map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          first_name: m.first_name ?? "",
          last_name: m.last_name ?? "",
          phone: m.phone,
          email: m.email ?? "",
          sms_opt_in: m.user_id ? optInMap.get(m.user_id) === true : false,
          status: m.status,
          membership_type: m.membership_type,
          source: "member" as const,
        }))
        .filter((r) => {
          if (audienceTier === "all") return true;
          return (r.membership_type ?? "").toLowerCase().includes(audienceTier.toLowerCase());
        });

      if (!cancelled) {
        setRecipients(list);
        setLoadingAudience(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [audienceStatus, audienceTier]);

  const eligible = recipients.filter((r) => r.sms_opt_in && r.phone);
  const skippedNoConsent = recipients.length - eligible.length;

  const blastCost = useMemo(
    () =>
      estimateCost({
        recipients: eligible.length,
        body: blastBody,
        hasMedia: blastMedia.length > 0,
      }),
    [eligible.length, blastBody, blastMedia.length],
  );

  const handleBlastSend = async () => {
    setSending(true);
    setResults([]);
    const out: SendResult[] = [];
    // Send in batches of 10
    for (let i = 0; i < eligible.length; i += 10) {
      const batch = eligible.slice(i, i + 10);
      const settled = await Promise.allSettled(
        batch.map(async (r) => {
          const personalizedBody = blastBody.replace(/\{\{\s*firstName\s*\}\}/g, r.first_name);
          const { data, error } = await supabase.functions.invoke("send-sms", {
            body: {
              to: { userId: r.user_id || undefined, phone: r.phone },
              templateKey: "admin-custom",
              variables: { customBody: personalizedBody || " " },
              idempotencyKey: `blast-${r.id}-${Date.now()}`,
              metadata: { source: "admin_sms_blast" },
              mediaUrls: blastMedia,
            },
          });
          if (error) throw error;
          const d = data as any;
          if (d?.success === false) throw new Error(d?.error || "Failed");
          return { recipient: r, success: true, twilioSid: d?.twilio_sid };
        }),
      );
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        if (s.status === "fulfilled") out.push(s.value);
        else out.push({ recipient: batch[j], success: false, error: String(s.reason?.message ?? s.reason) });
      }
      setResults([...out]);
    }
    setSending(false);
    setConfirmOpen(false);
    toast.success(`Sent: ${out.filter((r) => r.success).length} · Failed: ${out.filter((r) => !r.success).length}`);
  };

  // === Send log ===
  const [logRows, setLogRows] = useState<any[]>([]);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  const loadLog = async () => {
    setLogLoading(true);
    const { data } = await supabase
      .from("sms_messages")
      .select("id, phone, message_body, status, twilio_sid, error_message, created_at, media_count, media_urls")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogRows((data ?? []) as any[]);
    setLogLoading(false);
  };

  useEffect(() => {
    loadLog();
  }, []);

  return (
    <div className="space-y-6">
      {/* TEST SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube2 className="h-4 w-4" /> Send Test SMS / MMS
          </CardTitle>
          <CardDescription>
            Quickly verify Twilio is delivering. Pre-filled with your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <Input
              placeholder="+1 555 555 5555"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <Button onClick={handleTestSend} disabled={testSending}>
              {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send Test
            </Button>
          </div>
          <Textarea
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            rows={3}
            placeholder="Test message body…"
          />
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>{testBody.length} chars · {segments(testBody)} segment{segments(testBody) !== 1 ? "s" : ""} · {testCost.type}</span>
            <span>≈ {testCost.perRecipientFormatted}</span>
          </div>
          <SmsMediaPicker value={testMedia} onChange={setTestMedia} />
          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription className="text-xs">{testResult.msg}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* BULK BLAST */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Bulk SMS Blast
          </CardTitle>
          <CardDescription>
            Sends only to opted-in members. Use {"{{firstName}}"} for personalization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={audienceStatus} onValueChange={setAudienceStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="frozen">Frozen</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
              </SelectContent>
            </Select>
            <Select value={audienceTier} onValueChange={setAudienceTier}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="founder">Founder</SelectItem>
                <SelectItem value="diamond">Diamond</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border p-3 bg-muted/30 text-sm">
            {loadingAudience ? (
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading audience…
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="default">{eligible.length} will receive</Badge>
                {skippedNoConsent > 0 && (
                  <Badge variant="outline">{skippedNoConsent} skipped (no consent / no phone)</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {recipients.length} matched filter
                </span>
              </div>
            )}
          </div>

          <Textarea
            value={blastBody}
            onChange={(e) => setBlastBody(e.target.value)}
            rows={4}
            placeholder="Hi {{firstName}}, …"
          />
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>
              {blastBody.length} chars · {blastCost.segments} seg · {blastCost.type}
            </span>
            <span>
              Est. {eligible.length} × {blastCost.perRecipientFormatted} = <strong>{blastCost.formatted}</strong>
            </span>
          </div>

          <SmsMediaPicker value={blastMedia} onChange={setBlastMedia} />

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Bulk sends are <strong>marketing</strong> messages. Only opted-in members are included.
              MMS delivers reliably to US/Canada only. Always include "Reply STOP to opt out" for marketing.
            </AlertDescription>
          </Alert>

          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={eligible.length === 0 || (!blastBody.trim() && blastMedia.length === 0) || sending}
            className="w-full"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to {eligible.length} recipient{eligible.length !== 1 ? "s" : ""}
          </Button>

          {results.length > 0 && (
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">
                        {r.recipient.first_name} {r.recipient.last_name}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.recipient.phone}</TableCell>
                      <TableCell>
                        {r.success ? (
                          <Badge variant="default" className="text-[10px]">Sent</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]" title={r.error}>
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEND LOG */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent SMS Activity</CardTitle>
            <CardDescription>Last 100 messages sent or attempted</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLog} disabled={logLoading}>
            {logLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Body</TableHead>
                  <TableHead className="text-xs">Media</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logRows.length === 0 && !logLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                      No SMS activity yet.
                    </TableCell>
                  </TableRow>
                )}
                {logRows.map((row) => {
                  const urls: string[] = Array.isArray(row.media_urls) ? row.media_urls : [];
                  const hasMedia = (row.media_count ?? 0) > 0;
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRow(row)}
                    >
                      <TableCell className="text-xs whitespace-nowrap">
                        {row.created_at ? format(new Date(row.created_at), "MM/dd HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                      <TableCell className="text-xs max-w-md">
                        <div className="flex items-center gap-1.5 truncate" title={row.message_body}>
                          {hasMedia && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          <span className="truncate">{row.message_body}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasMedia ? (
                          <div className="flex items-center gap-1.5">
                            {urls.slice(0, 3).map((u, i) => (
                              <img
                                key={i}
                                src={u}
                                alt=""
                                loading="lazy"
                                className="h-6 w-6 object-cover rounded border border-border"
                              />
                            ))}
                            {urls.length === 0 && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <ImageIcon className="h-3 w-3" /> {row.media_count}
                              </Badge>
                            )}
                            {urls.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{urls.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "sent" || row.status === "delivered"
                              ? "default"
                              : row.status === "failed" || row.status === "blocked_no_consent"
                              ? "destructive"
                              : "outline"
                          }
                          className="text-[10px]"
                          title={row.error_message || row.twilio_sid || ""}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CONFIRM DIALOG */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send blast to {eligible.length} recipient{eligible.length !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Type:</strong> {blastCost.type}
            </p>
            <p>
              <strong>Estimated cost:</strong> {blastCost.formatted} ({eligible.length} ×{" "}
              {blastCost.perRecipientFormatted})
            </p>
            <p className="text-xs text-muted-foreground">
              All recipients have opted in. Sending in batches of 10.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleBlastSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOG ROW DETAIL DRAWER */}
      <Sheet open={!!selectedRow} onOpenChange={(o) => !o && setSelectedRow(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRow && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Message detail
                  <Badge
                    variant={
                      selectedRow.status === "sent" || selectedRow.status === "delivered"
                        ? "default"
                        : selectedRow.status === "failed" ||
                          selectedRow.status === "blocked_no_consent"
                        ? "destructive"
                        : "outline"
                    }
                    className="text-[10px]"
                  >
                    {selectedRow.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selectedRow.phone} ·{" "}
                  {selectedRow.created_at
                    ? format(new Date(selectedRow.created_at), "MM/dd/yyyy HH:mm:ss")
                    : "—"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                {selectedRow.twilio_sid && (
                  <div className="flex items-center justify-between gap-2 rounded border border-border p-2">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Twilio SID</div>
                      <div className="font-mono text-xs break-all">{selectedRow.twilio_sid}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRow.twilio_sid);
                        toast.success("SID copied");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {selectedRow.error_message && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs break-words">
                      {selectedRow.error_message}
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">
                    Message body
                  </div>
                  <div className="rounded border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                    {selectedRow.message_body || "(empty)"}
                  </div>
                </div>

                {Array.isArray(selectedRow.media_urls) && selectedRow.media_urls.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Media ({selectedRow.media_urls.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedRow.media_urls.map((u: string, i: number) => (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          <img
                            src={u}
                            alt={`Attachment ${i + 1}`}
                            loading="lazy"
                            className="w-full h-32 object-cover rounded border border-border group-hover:opacity-90 transition"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedRow.media_count ?? 0) > 0 &&
                  (!Array.isArray(selectedRow.media_urls) ||
                    selectedRow.media_urls.length === 0) && (
                    <div className="text-xs text-muted-foreground">
                      {selectedRow.media_count} attachment{selectedRow.media_count !== 1 ? "s" : ""}{" "}
                      sent (URLs not retained for this row).
                    </div>
                  )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
