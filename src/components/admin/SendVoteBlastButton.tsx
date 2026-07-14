import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

export function SendVoteBlastButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ queued: number; skipped: number } | null>(null);

  const send = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sound-bath-vote-blast", {
        body: {},
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Queued ${data.queued} emails (${data.skipped} skipped).`);
    } catch (e: any) {
      toast.error(e?.message || "Blast failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="default">
          <Mail className="h-4 w-4 mr-2" /> Send email blast
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Sound Bath vote email?</AlertDialogTitle>
          <AlertDialogDescription>
            This queues one email per active member (status = active, has email on file). It is
            idempotent — running it again will not duplicate sends.
            {result && (
              <div className="mt-3 rounded bg-muted p-2 text-xs">
                Last run: queued {result.queued}, skipped {result.skipped}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={send} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Send emails
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
