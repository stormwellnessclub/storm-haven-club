import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

export const TRAINING_SERVICES = [
  { value: "one_on_one", label: "1:1 Personal Training" },
  { value: "private_pilates", label: "Private Pilates (Reformer)" },
  { value: "private_cycling", label: "Private Cycling" },
  { value: "semi_private", label: "Semi-Private (up to 4)" },
] as const;

export type TrainingServiceValue = (typeof TRAINING_SERVICES)[number]["value"];

const schema = z.object({
  service: z.string().min(1),
  full_name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(7, "Phone is required").max(30),
  preferred_times: z.string().trim().max(500).optional(),
  experience_level: z.string().max(50).optional(),
  goals: z.string().trim().max(1000).optional(),
  is_member: z.boolean(),
});

interface Props {
  defaultService?: TrainingServiceValue;
  compact?: boolean;
}

export function TrainingRequestForm({ defaultService = "one_on_one", compact }: Props) {
  const [service, setService] = useState<string>(defaultService);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredTimes, setPreferredTimes] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [goals, setGoals] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      service,
      full_name: fullName,
      email,
      phone,
      preferred_times: preferredTimes,
      experience_level: experienceLevel,
      goals,
      is_member: isMember,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please complete required fields");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("training_requests").insert({
      ...parsed.data,
      submitted_by_user_id: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not send your request. Please call us instead.");
      return;
    }
    setSubmitted(true);
    toast.success("Request sent — we'll be in touch shortly.");
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 mx-auto text-accent mb-3" />
        <h3 className="font-serif text-2xl mb-2">Request received</h3>
        <p className="text-muted-foreground">
          Thanks, {fullName.split(" ")[0]}. A coach will reach out within 1 business day to confirm
          your session.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-lg border border-border bg-background p-6 sm:p-8 space-y-5 ${
        compact ? "" : "shadow-sm"
      }`}
    >
      <div>
        <h3 className="font-serif text-2xl">Request a session</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us a bit about yourself and a coach will follow up to schedule.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="service">Service</Label>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger id="service" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_SERVICES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="full_name">Full name *</Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="experience">Experience level</Label>
          <Select value={experienceLevel} onValueChange={setExperienceLevel}>
            <SelectTrigger id="experience" className="mt-1.5">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New to training</SelectItem>
              <SelectItem value="some">Some experience</SelectItem>
              <SelectItem value="experienced">Experienced</SelectItem>
              <SelectItem value="athlete">Athlete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="preferred_times">Preferred days/times</Label>
          <Input
            id="preferred_times"
            placeholder="e.g. weekday mornings, Tue/Thu evenings"
            value={preferredTimes}
            onChange={(e) => setPreferredTimes(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="goals">What are your goals?</Label>
          <Textarea
            id="goals"
            rows={4}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            className="mt-1.5"
            placeholder="Strength, weight loss, rehab, post-natal, sport-specific, etc."
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <Checkbox
            id="is_member"
            checked={isMember}
            onCheckedChange={(v) => setIsMember(v === true)}
          />
          <Label htmlFor="is_member" className="cursor-pointer font-normal">
            I'm a current Storm Wellness Club member
          </Label>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
