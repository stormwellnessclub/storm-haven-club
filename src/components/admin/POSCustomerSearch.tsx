import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CreditCard, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export interface POSCustomer {
  name: string;
  email: string;
  cardOnFile: boolean;
  stripeCustomerId: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  type: "member" | "non_member" | "guest";
  memberId?: string | null;
  userId?: string | null;
}

interface POSCustomerSearchProps {
  onSelect: (customer: POSCustomer | null) => void;
  selected: POSCustomer | null;
}

export function POSCustomerSearch({ onSelect, selected }: POSCustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POSCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchCustomers(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchCustomers = async (q: string) => {
    setIsSearching(true);
    try {
      const out: POSCustomer[] = [];
      const seen = new Set<string>();

      // 1. Members
      const { data: members } = await supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email, stripe_customer_id, card_brand, card_last4")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .eq("status", "active")
        .limit(8);

      for (const m of members || []) {
        const key = `member-${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: `${m.first_name} ${m.last_name}`.trim(),
          email: m.email || "",
          cardOnFile: !!(m.stripe_customer_id && m.card_last4),
          stripeCustomerId: m.stripe_customer_id,
          cardBrand: m.card_brand,
          cardLast4: m.card_last4,
          type: "member",
          memberId: m.id,
          userId: (m as any).user_id ?? null,
        });
      }

      // 2. Non-members with stripe_customer_id
      const { data: nonMembers } = await supabase
        .from("non_member_profiles")
        .select("user_id, first_name, last_name, email, stripe_customer_id, card_brand, card_last4")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .not("stripe_customer_id", "is", null)
        .limit(8);

      for (const nm of nonMembers || []) {
        const key = `nm-${nm.user_id || nm.email}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: [nm.first_name, nm.last_name].filter(Boolean).join(" ") || nm.email || "Unknown",
          email: nm.email || "",
          cardOnFile: !!(nm.stripe_customer_id && nm.card_last4),
          stripeCustomerId: nm.stripe_customer_id,
          cardBrand: nm.card_brand,
          cardLast4: nm.card_last4,
          type: "non_member",
          memberId: null,
        });
      }

      // 3. Guests with stripe_customer_id
      const { data: guests } = await supabase
        .from("guest_passes")
        .select("id, guest_name, guest_email, stripe_customer_id, card_brand, card_last4")
        .or(`guest_name.ilike.%${q}%,guest_email.ilike.%${q}%`)
        .not("stripe_customer_id", "is", null)
        .limit(8);

      for (const g of guests || []) {
        const key = `guest-${g.stripe_customer_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: g.guest_name || g.guest_email || "Guest",
          email: g.guest_email || "",
          cardOnFile: !!(g.stripe_customer_id && g.card_last4),
          stripeCustomerId: g.stripe_customer_id,
          cardBrand: g.card_brand,
          cardLast4: g.card_last4,
          type: "guest",
          memberId: null,
        });
      }

      setResults(out);
      setShowDropdown(out.length > 0);
    } catch (err) {
      console.error("POS customer search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (customer: POSCustomer) => {
    onSelect(customer);
    setQuery("");
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setResults([]);
  };

  const typeBadge = (type: POSCustomer["type"]) => {
    switch (type) {
      case "member": return <Badge variant="default" className="text-[10px] px-1.5 py-0">Member</Badge>;
      case "non_member": return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Non-Member</Badge>;
      case "guest": return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Guest</Badge>;
    }
  };

  if (selected) {
    return (
      <div className="p-3 bg-muted rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{selected.name}</p>
              {typeBadge(selected.type)}
            </div>
            {selected.email && <p className="text-xs text-muted-foreground">{selected.email}</p>}
            {selected.cardOnFile ? (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <CreditCard className="h-3 w-3" />
                {selected.cardBrand?.toUpperCase()} •••• {selected.cardLast4}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No card on file</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          placeholder="Search member, non-member, or guest..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
        />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.email}-${i}`}
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
              onClick={() => handleSelect(r)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{r.name}</span>
                    {typeBadge(r.type)}
                  </div>
                  {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                </div>
                {r.cardOnFile && (
                  <span className="text-xs text-green-600 flex items-center gap-1 shrink-0 ml-2">
                    <CreditCard className="h-3 w-3" />
                    {r.cardLast4}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
