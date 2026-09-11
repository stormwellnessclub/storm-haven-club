import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_SPACES, EVENT_TYPES } from "@/lib/privateEvents";

const BUDGETS = ["Under $1,000", "$1,000 – $2,500", "$2,500 – $5,000", "$5,000+", "Not sure yet"];

export default function PrivateEventsPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    event_type: "",
    preferred_date: "",
    preferred_time: "",
    guest_count: "",
    budget_range: "",
    notes: "",
  });
  const [spaces, setSpaces] = useState<string[]>([]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const toggleSpace = (s: string) =>
    setSpaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Please add your name and email");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("private-event-request", {
      body: { ...form, spaces, guest_count: form.guest_count ? Number(form.guest_count) : null },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  };

  return (
    <Layout>
      <SEOHead
        title="Private Events & Parties"
        description="Host your birthday, bridal shower, corporate gathering or spa party at Storm Wellness Club in Livonia, Michigan. Request a date and our events team will be in touch."
        path="/private-events"
      />

      <section className="bg-background px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Storm Wellness Club</p>
          <h1 className="mt-4 font-serif text-4xl md:text-5xl">Private Events</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Celebrate in a space designed for calm and intention. Birthdays, bridal showers, corporate
            gatherings, spa parties and full club buyouts — our team plans every detail, from the studio to
            the café menu.
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="mx-auto max-w-2xl">
          {done ? (
            <Card>
              <CardContent className="space-y-4 py-14 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-primary" />
                <h2 className="font-serif text-2xl">Request received</h2>
                <p className="text-muted-foreground">
                  Thank you — we've sent a confirmation to your email. Our events team will review your
                  request and reach out personally with availability and a quote.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <form onSubmit={submit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="first_name">First name *</Label>
                      <Input id="first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last name *</Label>
                      <Input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Type of event</Label>
                      <Select value={form.event_type} onValueChange={(v) => set("event_type", v)}>
                        <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                        <SelectContent>
                          {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="guest_count">Approximate guests</Label>
                      <Input id="guest_count" type="number" min={1} value={form.guest_count} onChange={(e) => set("guest_count", e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="preferred_date">Preferred date</Label>
                      <Input id="preferred_date" type="date" value={form.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="preferred_time">Preferred time</Label>
                      <Input id="preferred_time" placeholder="e.g. afternoon, 6pm" value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Spaces you're interested in</Label>
                    <div className="flex flex-wrap gap-3">
                      {EVENT_SPACES.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={spaces.includes(s)} onCheckedChange={() => toggleSpace(s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Budget range</Label>
                    <Select value={form.budget_range} onValueChange={(v) => set("budget_range", v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {BUDGETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Tell us about your event</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      placeholder="What are you celebrating? Any food, spa services or activities you have in mind?"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    We'll confirm by email and follow up personally with availability and pricing.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </Layout>
  );
}
