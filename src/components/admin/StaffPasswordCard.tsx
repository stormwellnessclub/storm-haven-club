import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface StaffPasswordCardProps {
  userId: string;
  email: string;
}

/** Lets an admin set/reset the sign-in password for an individual staff account. */
export function StaffPasswordCard({ userId, email }: StaffPasswordCardProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-frontdesk-password", {
        body: { password, userId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Password updated for ${email}`);
      setPassword("");
      setConfirm("");
    } catch (e: any) {
      console.error("[StaffPasswordCard]", e);
      toast.error(e?.message ?? "Could not update the password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Sign-in password
        </CardTitle>
        <CardDescription>
          Set or reset the password for <span className="font-mono">{email}</span>. They sign in at
          the normal sign-in page with this email and password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save password
        </Button>
      </CardContent>
    </Card>
  );
}
