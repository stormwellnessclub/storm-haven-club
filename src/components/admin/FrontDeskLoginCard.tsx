import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, LogIn, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FRONTDESK_EMAIL = "frontdesk@stormwellnessclub.com";

/**
 * Lets an admin set the password of the shared front desk login so staff can
 * sign in normally at /auth with email + password and land on /frontdesk.
 */
export function FrontDeskLoginCard() {
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
        body: { password },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Front desk password updated");
      setPassword("");
      setConfirm("");
    } catch (e: any) {
      console.error("[FrontDeskLoginCard]", e);
      toast.error(e?.message ?? "Could not update the front desk password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LogIn className="h-4 w-4" />
          Front desk login
        </CardTitle>
        <CardDescription>
          Staff sign in at the normal sign-in page with this shared account and land straight on
          the Front Desk screen. Set or reset its password here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input readOnly value={FRONTDESK_EMAIL} className="font-mono text-sm" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(FRONTDESK_EMAIL);
              toast.success("Email copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
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
          Save front desk password
        </Button>
      </CardContent>
    </Card>
  );
}
