import { useMemo, useState } from "react";
import { format as fmt } from "date-fns";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PTShell, PTPageHeader, PTCard, PTBadge, PTEmptyState, ptButtonClass } from "@/components/admin/pt/PTUI";
import { usePTRequests, usePTRequestActions } from "@/hooks/pt/usePTRequests";
import { PTClientPicker, type PTClientOption } from "@/components/admin/pt/PTClientPicker";

const SERVICE_LABEL: Record<string, string> = {
  one_on_one: "1:1 Personal Training",
  private_pilates: "Private Pilates (Reformer)",
  semi_private: "Semi-Private",
};

export default function PTLeads() {
  const { data: leads = [], isLoading } = usePTRequests("inquiry");
  const { convert } = usePTRequestActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [client, setClient] = useState<PTClientOption | null>(null);
  const rows = useMemo(() => [...leads].reverse(), [leads]);
  const selected = leads.find((r) => r.id === selectedId) ?? null;

  async function doConvert() {
    if (!selected || !client) return;
    try {
      await convert.mutateAsync({ id: selected.id, clientUserId: client.id });
      toast.success("Converted to an appointment request — finish it under Requests");
      setSelectedId(null); setClient(null);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <PTShell>
      <PTPageHeader title="Leads" subtitle="Personal training inquiries from the website form. These are sales leads, not bookings." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <PTCard padded={false} className="overflow-x-auto">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : rows.length === 0 ? (
            <PTEmptyState icon={UserPlus} title="No leads" description="Website inquiries will appear here." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Name", "Submitted", "Interest", "Preferred times", "Said member?"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => { setSelectedId(r.id); setClient(null); }}
                    className={`cursor-pointer border-t border-border hover:bg-muted/40 ${selectedId === r.id ? "bg-muted/60" : ""}`}>
                    <td className="px-3 py-2"><div className="font-medium">{r.full_name || r.email}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(new Date(r.created_at), "MMM d, yyyy")}</td>
                    <td className="px-3 py-2">{SERVICE_LABEL[r.service] ?? r.service}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate">{r.preferred_times || "—"}</td>
                    <td className="px-3 py-2">{r.is_member ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PTCard>
        <PTCard>
          {!selected ? <p className="text-sm text-muted-foreground">Select a lead to see details.</p> : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-xl">{selected.full_name}</h3>
                {selected.converted_at ? <PTBadge tone="green">Converted</PTBadge> : <PTBadge>Website inquiry</PTBadge>}
              </div>
              <div><span className="text-muted-foreground">Email:</span> {selected.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {selected.phone || "—"}</div>
              <div><span className="text-muted-foreground">Interest:</span> {SERVICE_LABEL[selected.service] ?? selected.service}</div>
              <div><span className="text-muted-foreground">Preferred days/times:</span> {selected.preferred_times || "—"}</div>
              <div><span className="text-muted-foreground">Experience:</span> {selected.experience_level || "—"}</div>
              <div><span className="text-muted-foreground">Goals:</span> {selected.goals || "—"}</div>
              <div><span className="text-muted-foreground">Self-reported member:</span> {selected.is_member ? "Yes" : "No"} <span className="text-xs text-muted-foreground">(as entered on the form)</span></div>
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">To schedule, link this person's client account and convert the lead into an appointment request. Nothing is booked until it's confirmed under Requests.</p>
                <PTClientPicker value={client?.id} label={client?.name} onChange={setClient} />
                <button className={ptButtonClass("primary")} disabled={!client || convert.isPending} onClick={doConvert}>
                  Convert to appointment request
                </button>
              </div>
            </div>
          )}
        </PTCard>
      </div>
    </PTShell>
  );
}
