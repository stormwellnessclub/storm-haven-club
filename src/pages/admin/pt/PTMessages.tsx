import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { MessageSquare, Mail, Phone, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PTShell, PTPageHeader, PTCard, PTTable, PTColumn, PTEmptyState, PTBadge, PTTabs,
} from "@/components/admin/pt/PTUI";
import { usePTPeople } from "@/hooks/pt/usePTPortal";

type Tab = "all" | "email" | "sms" | "internal";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  sms: Phone,
  internal: StickyNote,
};

export default function PTMessages() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-communications"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_communications")
        .select("id, client_user_id, channel, direction, subject, body, delivery_status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: people = {} } = usePTPeople(rows.map((r: any) => r.client_user_id));

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r: any) => r.channel === tab)),
    [rows, tab],
  );

  const columns: PTColumn<any>[] = [
    {
      key: "channel",
      header: "",
      className: "w-10",
      render: (r) => {
        const Icon = CHANNEL_ICON[r.channel] ?? MessageSquare;
        return <Icon className="h-4 w-4 text-pt-muted" />;
      },
    },
    { key: "when", header: "Sent", render: (r) => fmtDate(new Date(r.created_at), "MMM d, h:mm a") },
    { key: "client", header: "Client", render: (r) => (r.client_user_id ? people[r.client_user_id]?.name ?? "—" : "—") },
    {
      key: "message",
      header: "Message",
      render: (r) => (
        <div className="min-w-0">
          {r.subject && <div className="text-pt-ink truncate">{r.subject}</div>}
          <div className="text-xs text-pt-muted line-clamp-1">{r.body || "—"}</div>
        </div>
      ),
    },
    { key: "dir", header: "Direction", render: (r) => <span className="capitalize">{r.direction ?? "outbound"}</span> },
    {
      key: "status",
      header: "",
      align: "right",
      render: (r) => {
        const s = r.delivery_status ?? "sent";
        const tone = s === "failed" ? "red" : s === "delivered" || s === "sent" ? "green" : "neutral";
        return <PTBadge tone={tone as any}><span className="capitalize">{s}</span></PTBadge>;
      },
    },
  ];

  return (
    <PTShell>
      <PTPageHeader
        eyebrow="Communication"
        title="Messages"
        subtitle="Email, SMS and internal notes logged against training clients."
      />
      <PTCard padded={false}>
        <div className="px-3 pt-1">
          <PTTabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "all", label: "All", count: rows.length },
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
              { value: "internal", label: "Internal" },
            ]}
          />
        </div>
        <PTTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          getRowKey={(r) => r.id}
          onRowClick={(r) => r.client_user_id && navigate(`/admin/pt/clients/${r.client_user_id}`)}
          empty={
            <PTEmptyState
              icon={MessageSquare}
              title="No messages logged"
              description="Emails, texts and internal notes sent to training clients appear here."
            />
          }
        />
      </PTCard>
    </PTShell>
  );
}
