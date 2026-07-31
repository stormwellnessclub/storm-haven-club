import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { usePTGlobalSearch, PTSearchResult } from "@/hooks/pt/usePTShell";

const GROUP_ORDER: PTSearchResult["group"][] = ["Clients", "Trainers", "Appointments", "Programs", "Packages"];

export function PTGlobalSearchDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => { if (!open) setTerm(""); }, [open]);

  const { data: results = [], isFetching } = usePTGlobalSearch(debounced);

  const grouped = useMemo(() => {
    const map = new Map<PTSearchResult["group"], PTSearchResult[]>();
    results.forEach((r) => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return GROUP_ORDER.filter((g) => map.get(g)?.length).map((g) => [g, map.get(g)!] as const);
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search clients, trainers, appointments, programs, packages…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList className="max-h-[60vh]">
        {debounced.trim().length < 2 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            <Search className="h-4 w-4 mx-auto mb-2 opacity-50" />
            Type at least 2 characters to search
          </div>
        ) : isFetching && !results.length ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Searching…
          </div>
        ) : (
          <>
            <CommandEmpty>No matches found.</CommandEmpty>
            {grouped.map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`${r.group} ${r.title} ${r.subtitle ?? ""} ${r.id}`}
                    onSelect={() => { onOpenChange(false); navigate(r.to); }}
                    className="cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] truncate">{r.title}</div>
                      {r.subtitle && <div className="text-[11px] text-muted-foreground truncate">{r.subtitle}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
