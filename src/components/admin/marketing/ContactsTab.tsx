import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Users, UserCheck, UserX, Search, Loader2, Download, ListFilter } from "lucide-react";

type Segment = "member" | "non_member" | "prospect";

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  segment: Segment;
  source_label: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

interface ParsedRow {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

interface PreviewResult {
  total: number;
  invalid: number;
  within_file_duplicates: number;
  already_in_table: number;
  will_insert_member: number;
  will_insert_non_member: number;
  will_insert_prospect: number;
  will_insert_total: number;
}

interface ImportResult {
  inserted_member: number;
  inserted_non_member: number;
  inserted_prospect: number;
  inserted_total: number;
  skipped_existing: number;
  skipped_invalid: number;
  skipped_duplicate: number;
}

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  "email address": "email",
  email: "email",
  "first name": "first_name",
  firstname: "first_name",
  fname: "first_name",
  "last name": "last_name",
  lastname: "last_name",
  lname: "last_name",
  "phone number": "phone",
  phone: "phone",
};

function normalizeRow(row: Record<string, string>): ParsedRow {
  const out: ParsedRow = { email: "" };
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim().toLowerCase();
    const mapped = HEADER_MAP[key];
    if (mapped) {
      (out as unknown as Record<string, unknown>)[mapped] = (v ?? "").trim();
    } else if (v) {
      meta[k] = v;
    }
  }
  out.metadata = meta;
  return out;
}

const PAGE_SIZE = 100;

export function ContactsTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["marketing-contacts-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_contacts")
        .select("segment, unsubscribed_at");
      if (error) throw error;
      const total = data.length;
      const member = data.filter((d) => d.segment === "member").length;
      const non_member = data.filter((d) => d.segment === "non_member").length;
      const prospect = data.filter((d) => d.segment === "prospect").length;
      const unsubscribed = data.filter((d) => d.unsubscribed_at).length;
      return { total, member, non_member, prospect, unsubscribed };
    },
  });

  // Imported audiences/sources summary
  const { data: sources } = useQuery({
    queryKey: ["marketing-contacts-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_contacts")
        .select("source_label");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data) {
        const key = row.source_label || "(no source)";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Total filtered count for pagination
  const { data: filteredCount } = useQuery({
    queryKey: ["marketing-contacts-count", segmentFilter, sourceFilter, search],
    queryFn: async () => {
      let q = supabase
        .from("marketing_contacts")
        .select("id", { count: "exact", head: true });
      if (segmentFilter !== "all") q = q.eq("segment", segmentFilter);
      if (sourceFilter !== "all") {
        if (sourceFilter === "__none__") q = q.is("source_label", null);
        else q = q.eq("source_label", sourceFilter);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s}`);
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["marketing-contacts", segmentFilter, sourceFilter, search, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase
        .from("marketing_contacts")
        .select("id,email,first_name,last_name,phone,segment,source_label,unsubscribed_at,created_at")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (segmentFilter !== "all") q = q.eq("segment", segmentFilter);
      if (sourceFilter !== "all") {
        if (sourceFilter === "__none__") q = q.is("source_label", null);
        else q = q.eq("source_label", sourceFilter);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
  });

  // Reset page when filters change
  useMemo(() => {
    setPage(0);
  }, [segmentFilter, sourceFilter, search]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setImportResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
          .map(normalizeRow)
          .filter((r) => r.email);
        setParsedRows(rows);
        const { data, error } = await supabase.rpc("preview_marketing_contacts", {
          rows: rows as unknown as Parameters<typeof supabase.rpc>[1] extends infer P ? P : never,
        } as never);
        if (error) {
          toast.error(`Preview failed: ${error.message}`);
          return;
        }
        setPreview(data as unknown as PreviewResult);
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  };

  const runImport = async () => {
    if (!parsedRows) return;
    setImporting(true);
    try {
      const sourceLabel = `${fileName.replace(/\.csv$/i, "")}_${new Date().toISOString().slice(0, 10)}`;
      const batchSize = 500;
      const merged: ImportResult = {
        inserted_member: 0, inserted_non_member: 0, inserted_prospect: 0,
        inserted_total: 0, skipped_existing: 0, skipped_invalid: 0, skipped_duplicate: 0,
      };
      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const chunk = parsedRows.slice(i, i + batchSize);
        const { data, error } = await supabase.rpc("import_marketing_contacts", {
          rows: chunk,
          _source_label: sourceLabel,
        } as never);
        if (error) throw error;
        const r = data as unknown as ImportResult;
        for (const k of Object.keys(merged) as (keyof ImportResult)[]) {
          merged[k] += r[k] ?? 0;
        }
      }
      setImportResult(merged);
      toast.success(`Imported ${merged.inserted_total} contacts`);
      qc.invalidateQueries({ queryKey: ["marketing-contacts-stats"] });
      qc.invalidateQueries({ queryKey: ["marketing-contacts-sources"] });
      qc.invalidateQueries({ queryKey: ["marketing-contacts"] });
      qc.invalidateQueries({ queryKey: ["marketing-contacts-count"] });
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParsedRows(null);
    setPreview(null);
    setImportResult(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportCsv = async () => {
    toast.info("Preparing export...");
    try {
      const all: Contact[] = [];
      const batch = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from("marketing_contacts")
          .select("id,email,first_name,last_name,phone,segment,source_label,unsubscribed_at,created_at")
          .order("created_at", { ascending: false })
          .range(from, from + batch - 1);
        if (segmentFilter !== "all") q = q.eq("segment", segmentFilter);
        if (sourceFilter !== "all") {
          if (sourceFilter === "__none__") q = q.is("source_label", null);
          else q = q.eq("source_label", sourceFilter);
        }
        if (search.trim()) {
          const s = `%${search.trim()}%`;
          q = q.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s}`);
        }
        const { data, error } = await q;
        if (error) throw error;
        const chunk = (data ?? []) as Contact[];
        all.push(...chunk);
        if (chunk.length < batch) break;
        from += batch;
      }
      const csv = Papa.unparse(all);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marketing_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} contacts`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats?.total ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Members" value={stats?.member ?? 0} icon={<UserCheck className="h-4 w-4 text-green-600" />} />
        <StatCard label="Non-members" value={stats?.non_member ?? 0} />
        <StatCard label="Prospects" value={stats?.prospect ?? 0} />
        <StatCard label="Unsubscribed" value={stats?.unsubscribed ?? 0} icon={<UserX className="h-4 w-4 text-destructive" />} />
      </div>

      {/* Imported audiences summary */}
      {sources && sources.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            <h3 className="font-semibold">Imported audiences</h3>
            <Badge variant="secondary" className="ml-auto">{sources.length} source{sources.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => {
              const isActive = sourceFilter === (s.label === "(no source)" ? "__none__" : s.label);
              return (
                <button
                  key={s.label}
                  onClick={() => {
                    const v = s.label === "(no source)" ? "__none__" : s.label;
                    setSourceFilter(isActive ? "all" : v);
                  }}
                  className={`text-xs rounded-md border px-2 py-1 transition-colors ${
                    isActive ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-mono">{s.label}</span>
                  <span className="ml-2 opacity-70">{s.count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Import */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import contacts (CSV)
            </h3>
            <p className="text-xs text-muted-foreground">
              Auto-detects Mailchimp columns. All emails imported as opted-in. Duplicates are skipped by email.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Choose CSV
            </Button>
            {parsedRows && (
              <Button variant="ghost" onClick={reset}>Clear</Button>
            )}
          </div>
        </div>

        {fileName && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{fileName}</span> — {parsedRows?.length ?? 0} rows parsed
          </div>
        )}

        {preview && !importResult && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <PreviewStat label="Total rows" value={preview.total} />
              <PreviewStat label="Invalid emails" value={preview.invalid} tone="warn" />
              <PreviewStat label="Duplicates in file" value={preview.within_file_duplicates} tone="warn" />
              <PreviewStat label="Already in system" value={preview.already_in_table} tone="warn" />
              <PreviewStat label="→ Members" value={preview.will_insert_member} tone="good" />
              <PreviewStat label="→ Non-members" value={preview.will_insert_non_member} tone="good" />
              <PreviewStat label="→ Prospects" value={preview.will_insert_prospect} tone="good" />
              <PreviewStat label="Will insert" value={preview.will_insert_total} tone="good" />
            </div>
            <Button onClick={runImport} disabled={importing || preview.will_insert_total === 0}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Import {preview.will_insert_total} contacts
            </Button>
          </div>
        )}

        {importResult && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <div className="font-medium">Import complete</div>
            <div>✓ {importResult.inserted_total} inserted ({importResult.inserted_member} members, {importResult.inserted_non_member} non-members, {importResult.inserted_prospect} prospects)</div>
            <div className="text-muted-foreground">
              Skipped: {importResult.skipped_existing} already in system, {importResult.skipped_duplicate} in-file dupes, {importResult.skipped_invalid} invalid
            </div>
          </div>
        )}
      </Card>

      {/* List */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email, name, phone..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All segments</SelectItem>
              <SelectItem value="member">Members</SelectItem>
              <SelectItem value="non_member">Non-members</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All audiences" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All audiences</SelectItem>
              {sources?.map((s) => (
                <SelectItem
                  key={s.label}
                  value={s.label === "(no source)" ? "__none__" : s.label}
                >
                  {s.label} ({s.count.toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filteredCount}>
            <Download className="h-4 w-4 mr-1" /> Export {filteredCount ? `(${filteredCount.toLocaleString()})` : ""}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {filteredCount !== undefined ? (
            <>
              Showing {contacts?.length ?? 0} of {filteredCount.toLocaleString()} contact{filteredCount === 1 ? "" : "s"}
              {(segmentFilter !== "all" || sourceFilter !== "all" || search.trim()) && " (filtered)"}
            </>
          ) : (
            "Loading..."
          )}
        </div>

        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Email</th>
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Segment</th>
                <th className="p-2">Source</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!isLoading && contacts?.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">
                  {filteredCount === 0 && (segmentFilter !== "all" || sourceFilter !== "all" || search.trim())
                    ? "No contacts match the current filters."
                    : "No contacts yet — import a CSV above."}
                </td></tr>
              )}
              {contacts?.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{c.email}</td>
                  <td className="p-2">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="p-2">{c.phone || "—"}</td>
                  <td className="p-2"><SegmentBadge s={c.segment} /></td>
                  <td className="p-2 text-xs text-muted-foreground">{c.source_label || "—"}</td>
                  <td className="p-2">
                    {c.unsubscribed_at ? (
                      <Badge variant="destructive">Unsubscribed</Badge>
                    ) : (
                      <Badge variant="secondary">Opted in</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredCount !== undefined && filteredCount > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
    </Card>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  const cls = tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "";
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${cls}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function SegmentBadge({ s }: { s: Segment }) {
  if (s === "member") return <Badge className="bg-green-600 hover:bg-green-600">Member</Badge>;
  if (s === "non_member") return <Badge variant="secondary">Non-member</Badge>;
  return <Badge variant="outline">Prospect</Badge>;
}
