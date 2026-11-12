import { format, parse } from "date-fns";
import { useStaffSpaClientPackages } from "@/hooks/useSpaClientPackages";
import { formatDollars } from "@/lib/spaPackages";
import { detroitToday } from "@/lib/spaClientPackages";

const d = (iso: string | null) => (iso ? format(parse(iso.slice(0, 10), "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "—");

/** Every purchased single treatment and series, with sessions used and left. */
export function SpaClientSeriesList({ serviceKey }: { serviceKey: string }) {
  const { data = [], isLoading, error } = useStaffSpaClientPackages(serviceKey);
  const today = detroitToday();
  return (
    <div className="mt-8">
      <h4 className="font-semibold">Client purchases</h4>
      <p className="mb-2 text-xs text-muted-foreground">Sessions used counts every booked session that wasn't cancelled. A series can only book dates on or before its expiration.</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <p className="text-sm text-destructive">Could not load purchases.</p> : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No purchases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Client</th><th className="pb-2 font-medium">Purchase</th><th className="pb-2 font-medium">Paid</th>
                <th className="pb-2 font-medium">Bought</th><th className="pb-2 font-medium">Used / total</th><th className="pb-2 font-medium">Left</th>
                <th className="pb-2 font-medium">Expires</th><th className="pb-2 font-medium">Next visit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const expired = !!p.expires_on && p.expires_on < today;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-2">{p.client_name ?? "—"}<span className="block text-xs text-muted-foreground">{p.client_email}</span></td>
                    <td className="py-2 pr-2">{p.package_name}{p.status !== "active" && <span className="ml-2 text-xs text-muted-foreground">({p.status})</span>}</td>
                    <td className="py-2 pr-2">{formatDollars(p.price_paid_cents)}</td>
                    <td className="py-2 pr-2">{d(p.purchased_at)}</td>
                    <td className="py-2 pr-2">{p.sessions_used} / {p.sessions_total}</td>
                    <td className="py-2 pr-2 font-medium">{Math.max(0, p.sessions_total - p.sessions_used)}</td>
                    <td className={`py-2 pr-2 ${expired ? "text-destructive" : ""}`}>{d(p.expires_on)}{expired ? " (expired)" : ""}</td>
                    <td className="py-2 pr-2">{d(p.next_appointment)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
