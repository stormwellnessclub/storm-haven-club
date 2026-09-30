import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonSearch, type PersonResult } from "@/components/admin/roster/PersonSearch";
import { SOCIETY_RHYTHMS, SOCIETY_THEMES, useAdminAddSocietyPerson } from "@/hooks/useHigherSelfSociety";

export function SocietyAddPersonPanel({ onDone }: { onDone: () => void }) {
  const add = useAdminAddSocietyPerson();
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rhythm, setRhythm] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [book, setBook] = useState("");
  const [note, setNote] = useState("");

  const pick = (p: PersonResult) => {
    setUserId(p.userId);
    setFullName(p.name);
    setEmail(p.email);
    setPhone(p.phone);
    setSearch("");
  };

  const submit = async () => {
    try {
      const res = await add.mutateAsync({ userId, fullName, email, phone, rhythm, themes, book, note });
      toast.success(res?.is_member ? "Member added to the roster" : "Non-member added to the roster");
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Could not add");
    }
  };

  return (
    <div className="border rounded-md p-4 mb-4 space-y-4 bg-muted/30">
      <PersonSearch search={search} onSearchChange={setSearch} onSelect={pick} />
      <p className="text-xs text-muted-foreground">Or type their details below — no account needed.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => { setFullName(e.target.value); }} /></div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setUserId(null); }} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Preferred evening (optional)</Label>
          <select className="w-full h-10 border rounded-md bg-background px-2 text-sm" value={rhythm} onChange={(e) => setRhythm(e.target.value)}>
            <option value="">—</option>
            {SOCIETY_RHYTHMS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div><Label>Book suggestion (optional)</Label><Input value={book} onChange={(e) => setBook(e.target.value)} /></div>
      </div>
      <div>
        <Label>Themes (optional)</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SOCIETY_THEMES.map((t) => {
            const on = themes.includes(t);
            return (
              <Button key={t} type="button" size="sm" variant={on ? "default" : "outline"}
                onClick={() => setThemes(on ? themes.filter((x) => x !== t) : [...themes, t])}>{t}</Button>
            );
          })}
        </div>
      </div>
      <div><Label>Staff note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={add.isPending || !fullName.trim() || !email.trim()}>
          {add.isPending ? "Adding…" : "Add to roster"}
        </Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
