import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Plus, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useFinancialMutations } from "@/hooks/useEventFinancials";
import { SendFinancialDialog } from "./SendFinancialDialog";
import { formatDay } from "@/lib/eventFinancials";

const PROPOSAL_STARTER = `Thank you for considering Storm Wellness Club.

This proposal outlines the experience we have designed for you, the spaces reserved, and the investment. Once accepted, we will prepare your agreement and payment schedule.`;

// Placeholder only — to be replaced with attorney-approved Storm Wellness Club terms.
const CONTRACT_PLACEHOLDER = `[PLACEHOLDER — PENDING ATTORNEY-APPROVED LANGUAGE]

1. Parties and Event Details
2. Scope of Services and Inclusions
3. Fees, Deposits and Payment Schedule
4. Cancellation and Rescheduling
5. Damage, Conduct and Club Rules
6. Insurance and Indemnity
7. Force Majeure
8. Governing Law (State of Michigan)

Storm Wellness Club must replace this placeholder with its approved legal terms before this agreement is sent to a client.`;

export function FinancialDocumentsTab({ financial, documents }: { financial: any; documents: any[] }) {
  const { saveDocument } = useFinancialMutations(financial.id);
  const [sendFor, setSendFor] = useState<any | null>(null);

  const create = (kind: "proposal" | "contract") =>
    saveDocument.mutate({
      kind,
      title: kind === "proposal" ? `Proposal — ${financial.title ?? "Event"}` : `Agreement — ${financial.title ?? "Event"}`,
      body: kind === "proposal" ? PROPOSAL_STARTER : null,
      terms_body: kind === "contract" ? CONTRACT_PLACEHOLDER : null,
      status: "draft",
    });

  const proposals = documents.filter((d) => d.kind === "proposal");
  const contracts = documents.filter((d) => d.kind === "contract");
  const receipts = documents.filter((d) => d.kind === "receipt");

  return (
    <div className="space-y-4">
      {[
        { key: "proposal", title: "Proposal", docs: proposals, hint: "Describes the experience, scope and pricing." },
        { key: "contract", title: "Agreement", docs: contracts, hint: "Approved terms and the client's signature." },
      ].map((group) => (
        <Card key={group.key}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="font-serif">{group.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{group.hint}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => create(group.key as any)}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.docs.length === 0 && (
              <p className="py-3 text-center text-sm text-muted-foreground">Nothing prepared yet.</p>
            )}
            {group.docs.map((doc: any) => (
              <div key={doc.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <Input
                      className="w-72"
                      defaultValue={doc.title}
                      onBlur={(e) => saveDocument.mutate({ id: doc.id, title: e.target.value })}
                    />
                    <Badge variant="secondary" className="capitalize">
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/event-portal/${financial.portal_token}`);
                        toast.success("Client link copied");
                      }}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSendFor(doc)}>
                      <Send className="mr-1 h-4 w-4" /> Send
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{group.key === "contract" ? "Terms" : "Body"}</Label>
                  <Textarea
                    rows={group.key === "contract" ? 10 : 5}
                    defaultValue={group.key === "contract" ? doc.terms_body ?? "" : doc.body ?? ""}
                    onBlur={(e) =>
                      saveDocument.mutate(
                        group.key === "contract"
                          ? { id: doc.id, terms_body: e.target.value }
                          : { id: doc.id, body: e.target.value },
                      )
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {doc.sent_at && <span>Sent {formatDay(String(doc.sent_at).slice(0, 10))}</span>}
                  {doc.viewed_at && <span>Viewed {formatDay(String(doc.viewed_at).slice(0, 10))}</span>}
                  {doc.accepted_at && <span>Accepted by {doc.signer_name}</span>}
                  {doc.signed_at && (
                    <span>
                      Signed by {doc.signer_name} on {formatDay(String(doc.signed_at).slice(0, 10))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif">Receipts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {receipts.length === 0 ? (
            <p className="py-3 text-center text-muted-foreground">Receipts appear here once payments are made.</p>
          ) : (
            receipts.map((r: any) => (
              <div key={r.id} className="flex justify-between border-b py-2 last:border-0">
                <span>{r.title}</span>
                <span className="text-muted-foreground">{formatDay(String(r.created_at).slice(0, 10))}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SendFinancialDialog
        financial={financial}
        document={sendFor}
        open={!!sendFor}
        onOpenChange={(o) => !o && setSendFor(null)}
      />
    </div>
  );
}
