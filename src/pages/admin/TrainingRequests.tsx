import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TRAINING_SERVICES } from "@/components/personal-training/TrainingRequestForm";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  Mail,
  Phone,
  Loader2,
  FileDown,
  Download,
  List,
  Rows3,
  Printer,
  Copy,
  ArrowUpDown,
} from "lucide-react";
import { downloadCsv } from "@/lib/ptExport";
import {
  parsePreferredTimes,
  formatDays,
  DAY_FULL,
  BUCKET_LABEL,
  type TimeBucket,
} from "@/lib/parsePreferredTimes";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Row {
  id: string;
  service: string;
  full_name: string;
  email: string;
  phone: string;
  preferred_times: string | null;
  experience_level: string | null;
  goals: string | null;
  is_member: boolean;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const SERVICE_LABEL: Record<string, string> = Object.fromEntries(
  TRAINING_SERVICES.map((s) => [s.value, s.label])
);

const STATUSES = ["new", "contacted", "scheduled", "closed"] as const;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-accent/15 text-accent",
  contacted: "bg-blue-500/15 text-blue-600",
  scheduled: "bg-emerald-500/15 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

const RANGE_OPTIONS = [
  { value: "all", label: "All time", days: 0 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
];

export default function TrainingRequestsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rangeFilter, setRangeFilter] = useState<string>("all");
  const [view, setView] = useState<"cards" | "log">("log");
  const [sortKey, setSortKey] = useState<"submitted" | "client">("submitted");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: "submitted" | "client") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "client" ? "asc" : "desc");
    }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Failed to load training requests");
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setNotesDraft(selected?.admin_notes ?? "");
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const cutoff =
      rangeFilter === "all"
        ? null
        : subDays(new Date(), Number(rangeFilter)).getTime();
    return rows.filter((r) => {
      if (serviceFilter !== "all" && r.service !== serviceFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [rows, serviceFilter, statusFilter, rangeFilter]);

  const parsedRows = useMemo(() => {
    const mapped = filtered.map((r) => ({
      row: r,
      parsed: parsePreferredTimes(r.preferred_times),
    }));
    const dir = sortDir === "asc" ? 1 : -1;
    return mapped.sort((a, b) => {
      if (sortKey === "client") {
        return a.row.full_name.localeCompare(b.row.full_name) * dir;
      }
      return (
        (new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime()) * dir
      );
    });
  }, [filtered, sortKey, sortDir]);

  /** day index -> list of { name, bucketLabel } */
  const grouped = useMemo(() => {
    const map: Record<number, { name: string; times: string }[]> = {};
    for (let d = 0; d < 7; d++) map[d] = [];
    for (const { row, parsed } of parsedRows) {
      const times = parsed.timeChips.length
        ? parsed.timeChips.join(", ")
        : parsed.buckets.map((b: TimeBucket) => BUCKET_LABEL[b]).join(", ") || "Any time";
      for (const d of parsed.days) {
        map[d].push({ name: row.full_name, times });
      }
    }
    return map;
  }, [parsedRows]);

  const unscheduledCount = parsedRows.filter((p) => !p.parsed.days.length).length;

  const titleForExport =
    serviceFilter === "all"
      ? "Training Requests"
      : `${SERVICE_LABEL[serviceFilter] ?? serviceFilter} Training Requests`;

  const rangeLabel =
    RANGE_OPTIONS.find((o) => o.value === rangeFilter)?.label ?? "All time";

  const EXPORT_HEADERS = [
    "Client",
    "Member",
    "Phone",
    "Email",
    "Service",
    "Requested days",
    "Time frame",
    "Original wording",
    "Submitted",
    "Status",
  ];

  const exportRows = useMemo(
    () =>
      parsedRows.map(({ row, parsed }) => ({
        Client: row.full_name,
        Member: row.is_member ? "Yes" : "No",
        Phone: row.phone ?? "",
        Email: row.email ?? "",
        Service: SERVICE_LABEL[row.service] ?? row.service,
        "Requested days": formatDays(parsed.days),
        "Time frame": parsed.timeChips.join(" / "),
        "Original wording": (row.preferred_times ?? "").replace(/\s+/g, " ").trim(),
        Submitted: format(new Date(row.created_at), "yyyy-MM-dd"),
        Status: row.status,
      })),
    [parsedRows]
  );

  function exportCsv() {
    if (!exportRows.length) return toast.error("Nothing to export");
    downloadCsv(
      `training-requests-${format(new Date(), "yyyy-MM-dd")}.csv`,
      exportRows,
      EXPORT_HEADERS
    );
    toast.success("CSV downloaded");
  }

  async function copyRows() {
    if (!exportRows.length) return toast.error("Nothing to copy");
    const tsv = [
      EXPORT_HEADERS.join("\t"),
      ...exportRows.map((r) =>
        EXPORT_HEADERS.map((h) =>
          String((r as Record<string, string>)[h] ?? "").replace(/[\t\n\r]+/g, " ")
        ).join("\t")
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success(`${exportRows.length} rows copied — paste into a spreadsheet`);
    } catch {
      toast.error("Clipboard blocked by the browser — use Export CSV instead");
    }
  }

  function printList() {
    if (!exportRows.length) return toast.error("Nothing to print");
    document.body.classList.add("printing-area");
    const cleanup = () => {
      document.body.classList.remove("printing-area");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 1000);
    }, 50);
  }

  function exportPdf() {
    if (!parsedRows.length) return toast.error("Nothing to export");
    const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(titleForExport, 40, 42);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(
      `${rangeLabel} · ${parsedRows.length} request${parsedRows.length === 1 ? "" : "s"} · Generated ${format(
        new Date(),
        "MMM d, yyyy h:mm a"
      )}`,
      40,
      60
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 76,
      head: [
        [
          "Client",
          "Member",
          "Contact",
          "Requested days",
          "Time frame",
          "Original request",
          "Status",
          "Submitted",
        ],
      ],
      body: parsedRows.map(({ row, parsed }) => [
        row.full_name,
        row.is_member ? "Yes" : "No",
        `${row.email}\n${row.phone}`,
        formatDays(parsed.days),
        parsed.timeChips.join(", ") || "—",
        row.preferred_times ?? "",
        row.status,
        format(new Date(row.created_at), "MMM d, yyyy"),
      ]),
      styles: { fontSize: 8, cellPadding: 4, valign: "top" },
      headStyles: { fillColor: [32, 26, 22], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 42 },
        2: { cellWidth: 120 },
        3: { cellWidth: 95 },
        4: { cellWidth: 110 },
        5: { cellWidth: 175 },
        6: { cellWidth: 55 },
        7: { cellWidth: 65 },
      },
    });

    // Grouped by day summary
    const groupBody: string[][] = [];
    for (let d = 0; d < 7; d++) {
      const list = grouped[d];
      if (!list.length) continue;
      groupBody.push([
        DAY_FULL[d],
        String(list.length),
        list.map((c) => `${c.name} (${c.times})`).join("; "),
      ]);
    }
    if (groupBody.length) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 76;
      doc.addPage("letter", "landscape");
      doc.setFontSize(13);
      doc.text("Requests grouped by day", 40, 42);
      autoTable(doc, {
        startY: 58,
        head: [["Day", "#", "Clients & requested times"]],
        body: groupBody,
        styles: { fontSize: 9, cellPadding: 5, valign: "top" },
        headStyles: { fillColor: [32, 26, 22], textColor: 255 },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 34 }, 2: { cellWidth: 610 } },
      });
      void lastY;
    }

    doc.save(`training-requests-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF downloaded");
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("training_requests")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error("Failed to update status");
    toast.success("Status updated");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    if (selected?.id === id) setSelected({ ...selected, status });
  }

  async function saveNotes() {
    if (!selected) return;
    const { error } = await supabase
      .from("training_requests")
      .update({ admin_notes: notesDraft })
      .eq("id", selected.id);
    if (error) return toast.error("Failed to save notes");
    toast.success("Notes saved");
    setRows((r) =>
      r.map((x) => (x.id === selected.id ? { ...x, admin_notes: notesDraft } : x))
    );
    setSelected({ ...selected, admin_notes: notesDraft });
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Training Requests</h1>
            <p className="text-sm text-muted-foreground">
              Inquiries submitted from the Personal Training pages.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={printList}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={copyRows}>
              <Copy className="h-4 w-4 mr-2" /> Copy rows
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <FileDown className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[190px] h-9">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {TRAINING_SERVICES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={rangeFilter} onValueChange={setRangeFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
            <Button
              size="sm"
              variant={view === "log" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("log")}
            >
              <Rows3 className="h-4 w-4 mr-1" /> Log
            </Button>
            <Button
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("cards")}
            >
              <List className="h-4 w-4 mr-1" /> Cards
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            No training requests match these filters.
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              {view === "log" ? (
                <div className="border border-border rounded-lg bg-card overflow-x-auto">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() => toggleSort("client")}
                          >
                            Client <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="w-[70px]">Member</TableHead>
                        <TableHead className="w-[120px]">Phone</TableHead>
                        <TableHead className="w-[180px]">Email</TableHead>
                        <TableHead className="w-[130px]">Service</TableHead>
                        <TableHead className="w-[140px]">Requested days</TableHead>
                        <TableHead className="w-[160px]">Time frame</TableHead>
                        <TableHead className="w-[220px]">Original wording</TableHead>
                        <TableHead className="w-[110px]">
                          <button
                            className="inline-flex items-center gap-1 hover:text-foreground"
                            onClick={() => toggleSort("submitted")}
                          >
                            Submitted <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map(({ row, parsed }) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(row)}
                        >
                          <TableCell className="align-top font-medium">
                            {row.full_name}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {row.is_member ? "Yes" : "No"}
                          </TableCell>
                          <TableCell className="align-top text-xs">{row.phone}</TableCell>
                          <TableCell className="align-top text-xs break-all">
                            {row.email}
                          </TableCell>
                          <TableCell className="align-top text-xs">
                            {SERVICE_LABEL[row.service] ?? row.service}
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {formatDays(parsed.days)}
                          </TableCell>
                          <TableCell className="align-top">
                            {parsed.timeChips.length ? (
                              <div className="flex flex-wrap gap-1">
                                {parsed.timeChips.map((c) => (
                                  <Badge
                                    key={c}
                                    variant="secondary"
                                    className="text-[10px] font-normal"
                                  >
                                    {c}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Unparsed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground italic">
                            {row.preferred_times ? `“${row.preferred_times}”` : "—"}
                          </TableCell>
                          <TableCell className="align-top text-xs text-muted-foreground">
                            {format(new Date(row.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="align-top">
                            <span
                              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                                STATUS_STYLE[row.status] ?? ""
                              }`}
                            >
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border bg-card">
                  {filtered.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`w-full text-left p-4 hover:bg-muted/40 transition-colors ${
                        selected?.id === r.id ? "bg-muted/60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{r.full_name}</span>
                            {r.is_member && (
                              <Badge variant="outline" className="text-[10px]">
                                Member
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {SERVICE_LABEL[r.service] ?? r.service} ·{" "}
                            {format(new Date(r.created_at), "MMM d, yyyy h:mm a")}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                            STATUS_STYLE[r.status] ?? ""
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Group by day */}
              {view === "log" && (
                <div className="border border-border rounded-lg bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-medium">Grouped by day</h2>
                    {unscheduledCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {unscheduledCount} request{unscheduledCount === 1 ? "" : "s"} with no
                        specific day
                      </span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {DAY_FULL.map((label, d) => (
                      <div key={label} className="rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {grouped[d].length}
                          </span>
                        </div>
                        {grouped[d].length === 0 ? (
                          <p className="text-xs text-muted-foreground">No requests</p>
                        ) : (
                          <ul className="space-y-1">
                            {grouped[d].map((c, i) => (
                              <li key={`${c.name}-${i}`} className="text-xs">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-muted-foreground"> · {c.times}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Detail */}
            <div className="border border-border rounded-lg p-4 bg-card h-fit sticky top-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a request to view details.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold text-lg">{selected.full_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(selected.created_at), "PPpp")}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <a
                      href={`mailto:${selected.email}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" /> {selected.email}
                    </a>
                    <a
                      href={`tel:${selected.phone}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" /> {selected.phone}
                    </a>
                  </div>

                  <div className="text-sm space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Service</div>
                      <div>{SERVICE_LABEL[selected.service] ?? selected.service}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Member?</div>
                      <div>{selected.is_member ? "Yes" : "No"}</div>
                    </div>
                    {selected.experience_level && (
                      <div>
                        <div className="text-xs text-muted-foreground">Experience</div>
                        <div className="capitalize">{selected.experience_level}</div>
                      </div>
                    )}
                    {selected.preferred_times && (
                      <div>
                        <div className="text-xs text-muted-foreground">Preferred times</div>
                        <div>{selected.preferred_times}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Read as: {formatDays(parsePreferredTimes(selected.preferred_times).days)}
                          {parsePreferredTimes(selected.preferred_times).timeChips.length
                            ? ` · ${parsePreferredTimes(selected.preferred_times).timeChips.join(", ")}`
                            : ""}
                        </div>
                      </div>
                    )}
                    {selected.goals && (
                      <div>
                        <div className="text-xs text-muted-foreground">Goals</div>
                        <div className="whitespace-pre-wrap">{selected.goals}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => updateStatus(selected.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Admin notes</div>
                    <Textarea
                      rows={4}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={saveNotes}
                      disabled={notesDraft === (selected.admin_notes ?? "")}
                    >
                      Save notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Print-only clean list */}
        <div id="print-area" className="hidden print:block">
          <h1 style={{ fontSize: "14pt", fontWeight: 600, marginBottom: 2 }}>
            {titleForExport}
          </h1>
          <p style={{ fontSize: "9pt", marginBottom: 10 }}>
            {rangeLabel} · {exportRows.length} request{exportRows.length === 1 ? "" : "s"} ·
            Printed {format(new Date(), "MMM d, yyyy h:mm a")}
          </p>
          <table>
            <thead>
              <tr>
                {EXPORT_HEADERS.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exportRows.map((r, i) => (
                <tr key={i}>
                  {EXPORT_HEADERS.map((h) => (
                    <td key={h}>{(r as Record<string, string>)[h] || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
