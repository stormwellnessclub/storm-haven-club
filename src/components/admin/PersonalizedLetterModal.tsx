import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, Send, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApplicantInfo {
  id: string;
  name: string;
  email: string;
  tier: string;
  wellness_goals?: string[];
  services_interested?: string[];
  holistic_wellness?: string;
  lifestyle_integration?: string;
}

interface PersonalizedLetterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: ApplicantInfo | null;
  onSendSuccess: () => void;
}

export function PersonalizedLetterModal({
  open,
  onOpenChange,
  applicant,
  onSendSuccess,
}: PersonalizedLetterModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState("Welcome to Storm Wellness Club - Application Approved!");
  const [body, setBody] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleGenerate = async () => {
    if (!applicant) return;

    setIsGenerating(true);
    setGenerationError(null);
    
    try {
      console.log("[PersonalizedLetter] Generating letter for:", applicant.name);
      
      const { data, error } = await supabase.functions.invoke("generate-approval-letter", {
        body: {
          applicant: {
            name: applicant.name,
            tier: applicant.tier,
            wellness_goals: applicant.wellness_goals,
            services_interested: applicant.services_interested,
            holistic_wellness: applicant.holistic_wellness,
            lifestyle_integration: applicant.lifestyle_integration,
          },
        },
      });

      if (error) {
        console.error("[PersonalizedLetter] Edge function error:", error);
        // Check for specific error types
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          throw new Error("AI service temporarily unavailable. Please try again in a moment.");
        }
        throw error;
      }
      
      if (data?.error) {
        console.error("[PersonalizedLetter] Response error:", data.error);
        throw new Error(data.error);
      }

      console.log("[PersonalizedLetter] Letter generated successfully");
      setSubject(data.subject || "Welcome to Storm Wellness Club - Application Approved!");
      setBody(data.body || "");
      setHasGenerated(true);
      setGenerationError(null);
      toast.success("Letter generated! Review and edit as needed.");
    } catch (err: any) {
      console.error("[PersonalizedLetter] Failed to generate letter:", err);
      const errorMessage = err.message || "Failed to generate letter. Please try again.";
      setGenerationError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setGenerationError(null);
    handleGenerate();
  };

  const handleSend = async () => {
    if (!applicant || !body.trim()) {
      toast.error("Letter body is required");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "approval_letter_personalized",
          to: applicant.email,
          data: {
            name: applicant.name,
            membershipTier: applicant.tier,
            customSubject: subject,
            customBody: body,
          },
        },
      });

      if (error) throw error;

      // Log to email audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("email_audit_log" as any).insert({
          email_type: "approval_letter_personalized",
          recipient_email: applicant.email,
          recipient_name: applicant.name,
          triggered_by: user.id,
          trigger_source: "admin_personalized_letter",
          subject: subject,
          custom_content: body,
          application_id: applicant.id,
          template_data: {
            membershipTier: applicant.tier,
            wellness_goals: applicant.wellness_goals,
          },
        });
      }

      toast.success("Personalized approval letter sent!");
      onSendSuccess();
      onOpenChange(false);
      
      // Reset state
      setBody("");
      setHasGenerated(false);
    } catch (err: any) {
      console.error("Failed to send email:", err);
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state on close
    setBody("");
    setHasGenerated(false);
    setGenerationError(null);
    setSubject("Welcome to Storm Wellness Club - Application Approved!");
  };

  if (!applicant) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Personalized Approval Letter
          </DialogTitle>
          <DialogDescription>
            Generate a personalized approval letter based on {applicant.name}'s application data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applicant Info Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{applicant.name}</span>
              <Badge variant="outline">{applicant.tier} Membership</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{applicant.email}</p>
            
            {/* Application data used */}
            <div className="pt-2 space-y-1 text-sm">
              {applicant.wellness_goals && applicant.wellness_goals.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Wellness Goals:</span>{" "}
                  {applicant.wellness_goals.join(", ")}
                </p>
              )}
              {applicant.holistic_wellness && (
                <p className="line-clamp-2">
                  <span className="text-muted-foreground">Holistic Wellness:</span>{" "}
                  "{applicant.holistic_wellness}"
                </p>
              )}
              {applicant.lifestyle_integration && (
                <p className="line-clamp-2">
                  <span className="text-muted-foreground">Lifestyle:</span>{" "}
                  "{applicant.lifestyle_integration}"
                </p>
              )}
            </div>
          </div>

          {/* Error State with Retry */}
          {generationError && !hasGenerated && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{generationError}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  disabled={isGenerating}
                  className="ml-4 gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Generate Button (before generation) */}
          {!hasGenerated && (
            <div className="flex justify-center py-8">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                size="lg"
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Letter...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Personalized Letter
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Letter Editor (after generation) */}
          {hasGenerated && (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Letter Body</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Letter content..."
                  className="min-h-[300px] font-serif"
                />
                <p className="text-xs text-muted-foreground">
                  Edit as needed. The letter will be wrapped in Storm branding and styling when sent.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasGenerated && (
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || isSending}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          {hasGenerated && (
            <Button
              onClick={handleSend}
              disabled={isSending || !body.trim()}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
