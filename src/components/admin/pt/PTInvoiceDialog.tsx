import { useMemo, useState } from "react";
import { format as fmtDate } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { PTModal, PTAlert, PTBadge, ptButtonClass } from "@/components/admin/pt/PTUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCents } from "@/lib/ptFormat";
import { usePTUnpaidSessions } from "@/hooks/pt/usePTFinancials";
import { usePTInvoiceMutations } from "@/hooks/pt/usePTBillingCenter";

interface CustomLine { description: string; quantity: number; unit_amount_cents: number }

/**
 * Creates a PT invoice from unpaid sessions, an outstanding package balance,
 * or custom authorized charges. Multiple sessions land on one invoice with
 * a line item per appointment so allocation stays traceable.
 */
export function PTInvoiceDialog({
  open, onClose, userId, clientName, passes = [], preselectedAppointmentIds = [],
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  clientName: string;
  passes?: Array<{ id: string; pack_name: string; amount_outstanding_cents: number }>;
  preselectedAppointmentIds?: string[];
}) {
  const { data: unpaid = [] } = usePTUnpaidSessions();
  const { createInvoice } = usePTInvoiceMutations();

  const clientUnpaid = useMemo(
    () => unpaid.filter((u) => u.user_id === userId),
    [unpaid, userId],
  );

  const [selected, setSelected] = useState<string[]>(preselectedAppointmentIds);
  const [passId, setPassId] = useState<string | null>(null);
  const [lines, setLines] = useState<CustomLine[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const outstandingPasses = passes.filter((p) => (p.amount_outstanding_cents || 0) > 0);

  const sessionTotal = clientUnpaid
    .filter((u) => selected.includes(u.id))
    .reduce((s, u) => s + (u.amount_due_cents || 0), 0);
  const passTotal = passId
    ? outstandingPasses.find((p) => p.id === passId)?.amount_outstanding_cents ?? 0
    : 0;
  const customTotal = lines.reduce((s, l) => s + Math.max(l.quantity, 1) * l.unit_amount_cents, 0);
  const discountCents = Math.round(parseFloat(discount || "0") * 100);
  const taxCents = Math.round(parseFloat(tax || "0") * 100);
  const total = Math.max(sessionTotal + passTotal + customTotal - discountCents + taxCents, 0);
  const hasLines = selected.length > 0 || !!passId || lines.length > 0;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    await createInvoice.mutateAsync({
      userId,
      appointmentIds: selected,
      // A package balance line is only supported on its own invoice.
      passId: selected.length === 0 ? passId : null,
      customLines: lines.filter((l) => l.description.trim() && l.unit_amount_cents > 0),
      dueDate: dueDate || null,
      discountCents,
      taxCents,
      notes: notes || null,
      internalNotes: internalNotes || null,
    });
    onClose();
    setSelected([]); setPassId(null); setLines([]); setNotes(""); setInternalNotes("");
    setDiscount("0"); setTax("0"); setDueDate("");
  }

  return (
    <PTModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Create PT invoice"
      description={clientName}
      size="lg"
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button
            className={ptButtonClass("primary")}
            disabled={!hasLines || createInvoice.isPending}
            onClick={() => void submit()}
          >
            {createInvoice.isPending ? "Creating…" : `Create draft · ${formatCents(total)}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <PTAlert tone="info">
          An invoice records what is owed. It is never marked paid just because a package exists —
          payment and session entitlement stay separate.
        </PTAlert>

        {/* unpaid sessions */}
        <div>
          <div className="text-[13px] font-medium mb-2">Unpaid sessions</div>
          {clientUnpaid.length === 0 ? (
            <p className="text-[13px] text-pt-muted">No unpaid completed sessions for this client.</p>
          ) : (
            <div className="rounded-lg border border-pt-line divide-y divide-pt-line">
              {clientUnpaid.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                  <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                  <span className="text-[13px] flex-1">
                    {fmtDate(new Date(u.starts_at), "MMM d, yyyy · h:mm a")}
                  </span>
                  <span className="text-[13px] font-medium">{formatCents(u.amount_due_cents || 0)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* package balance */}
        {outstandingPasses.length > 0 && selected.length === 0 && (
          <div>
            <div className="text-[13px] font-medium mb-2">Outstanding package balance</div>
            <div className="rounded-lg border border-pt-line divide-y divide-pt-line">
              {outstandingPasses.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                  <Checkbox
                    checked={passId === p.id}
                    onCheckedChange={() => setPassId(passId === p.id ? null : p.id)}
                  />
                  <span className="text-[13px] flex-1">{p.pack_name}</span>
                  <span className="text-[13px] font-medium">{formatCents(p.amount_outstanding_cents)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* custom lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-medium">Custom charges</div>
            <button
              className={ptButtonClass("ghost")}
              onClick={() => setLines((l) => [...l, { description: "", quantity: 1, unit_amount_cents: 0 }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add line
            </button>
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="flex items-end gap-2 mb-2">
              <div className="flex-1">
                <Label className="text-[11px] text-pt-muted">Description</Label>
                <Input
                  value={l.description}
                  onChange={(e) => setLines((s) => s.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                  className="h-9 border-pt-line bg-white"
                />
              </div>
              <div className="w-16">
                <Label className="text-[11px] text-pt-muted">Qty</Label>
                <Input
                  type="number" min={1} value={l.quantity}
                  onChange={(e) => setLines((s) => s.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value || "1", 10) } : x))}
                  className="h-9 border-pt-line bg-white"
                />
              </div>
              <div className="w-28">
                <Label className="text-[11px] text-pt-muted">Unit $</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={(l.unit_amount_cents / 100) || ""}
                  onChange={(e) => setLines((s) => s.map((x, i) => i === idx ? { ...x, unit_amount_cents: Math.round(parseFloat(e.target.value || "0") * 100) } : x))}
                  className="h-9 border-pt-line bg-white"
                />
              </div>
              <button className={ptButtonClass("ghost")} onClick={() => setLines((s) => s.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-[11px] text-pt-muted">Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 border-pt-line bg-white" />
          </div>
          <div>
            <Label className="text-[11px] text-pt-muted">Discount $</Label>
            <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9 border-pt-line bg-white" />
          </div>
          <div>
            <Label className="text-[11px] text-pt-muted">Tax $</Label>
            <Input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="h-9 border-pt-line bg-white" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] text-pt-muted">Client-visible notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border-pt-line bg-white" rows={2} />
          </div>
          <div>
            <Label className="text-[11px] text-pt-muted">Internal notes (staff only)</Label>
            <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="border-pt-line bg-white" rows={2} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-pt-line bg-white px-4 py-3">
          <span className="text-[13px] text-pt-muted">Invoice total</span>
          <span className="text-lg font-medium">{formatCents(total)}</span>
        </div>
        {selected.length > 1 && (
          <PTBadge tone="gold">{selected.length} sessions on one invoice</PTBadge>
        )}
      </div>
    </PTModal>
  );
}
