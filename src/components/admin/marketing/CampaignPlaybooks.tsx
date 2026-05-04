import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, RefreshCw, MessageSquare, ShieldAlert, TrendingUp, Users, PenLine, Mail, ChevronDown, Coffee, Sparkles, Repeat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PlaybookConfig {
  id: string;
  name: string;
  description: string;
  goalType: string;
  icon: React.ReactNode;
  color: string;
  audienceType: "guest" | "member" | "cafe";
}

const GUEST_PLAYBOOKS: PlaybookConfig[] = [
  {
    id: "guest_to_applicant",
    name: "Convert to Applicant",
    description: "Past guests who haven't applied yet — nudge them to join",
    goalType: "guest_to_applicant",
    icon: <UserPlus className="h-5 w-5" />,
    color: "text-emerald-600",
    audienceType: "guest",
  },
  {
    id: "re_engage_guest",
    name: "Re-engage Lapsed Guests",
    description: "Guests who visited 30+ days ago with no return",
    goalType: "re_engage_guest",
    icon: <RefreshCw className="h-5 w-5" />,
    color: "text-amber-600",
    audienceType: "guest",
  },
  {
    id: "collect_feedback",
    name: "Collect Feedback",
    description: "Recent guests who haven't left feedback yet",
    goalType: "collect_feedback",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-blue-600",
    audienceType: "guest",
  },
];

const MEMBER_PLAYBOOKS: PlaybookConfig[] = [
  {
    id: "prevent_churn",
    name: "Prevent Churn",
    description: "Members with past_due or frozen status — bring them back",
    goalType: "prevent_churn",
    icon: <ShieldAlert className="h-5 w-5" />,
    color: "text-red-600",
    audienceType: "member",
  },
  {
    id: "upsell_tier",
    name: "Upsell Tier",
    description: "Active members on lower tiers — promote premium benefits",
    goalType: "upsell_tier",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-purple-600",
    audienceType: "member",
  },
  {
    id: "referral_push",
    name: "Referral Push",
    description: "Active members with 0 referrals — incentivize word-of-mouth",
    goalType: "referral_push",
    icon: <Users className="h-5 w-5" />,
    color: "text-emerald-600",
    audienceType: "member",
  },
];

const CAFE_PLAYBOOKS: PlaybookConfig[] = [
  {
    id: "cafe_first_order",
    name: "First Sip",
    description: "Active members who have never placed a cafe order",
    goalType: "cafe_first_order",
    icon: <Sparkles className="h-5 w-5" />,
    color: "text-emerald-600",
    audienceType: "cafe",
  },
  {
    id: "cafe_winback",
    name: "Win Them Back",
    description: "Members who ordered 30+ days ago and not since",
    goalType: "cafe_winback",
    icon: <RefreshCw className="h-5 w-5" />,
    color: "text-amber-600",
    audienceType: "cafe",
  },
  {
    id: "cafe_habit",
    name: "Habit Builder",
    description: "Members with exactly 1 lifetime order — turn into regulars",
    goalType: "cafe_habit",
    icon: <Repeat className="h-5 w-5" />,
    color: "text-blue-600",
    audienceType: "cafe",
  },
  {
    id: "cafe_drink_of_week",
    name: "Drink of the Week",
    description: "All active members — promote a featured menu item",
    goalType: "cafe_drink_of_week",
    icon: <Coffee className="h-5 w-5" />,
    color: "text-purple-600",
    audienceType: "cafe",
  },
];

interface AudienceCounts {
  [key: string]: number | null;
}

interface CampaignPlaybooksProps {
  type: "guest" | "member" | "cafe";
  onLaunchPlaybook: (playbook: PlaybookConfig) => void;
  onLaunchSmsPlaybook?: (playbook: PlaybookConfig) => void;
  onCustomCampaign: () => void;
}

export function CampaignPlaybooks({ type, onLaunchPlaybook, onLaunchSmsPlaybook, onCustomCampaign }: CampaignPlaybooksProps) {
  const [counts, setCounts] = useState<AudienceCounts>({});
  const [loading, setLoading] = useState(true);

  const playbooks =
    type === "guest" ? GUEST_PLAYBOOKS : type === "member" ? MEMBER_PLAYBOOKS : CAFE_PLAYBOOKS;

  useEffect(() => {
    fetchAudienceCounts();
  }, [type]);

  const fetchAudienceCounts = async () => {
    setLoading(true);
    const newCounts: AudienceCounts = {};

    try {
      if (type === "guest") {
        // Convert to Applicant: guests with email not in membership_applications
        const { data: guests } = await supabase
          .from("guest_passes" as any)
          .select("guest_email")
          .not("guest_email", "is", null);
        const { data: apps } = await supabase
          .from("membership_applications")
          .select("email");
        const appEmails = new Set((apps || []).map((a: any) => a.email?.toLowerCase()));
        const uniqueGuestEmails = new Set<string>();
        (guests || []).forEach((g: any) => {
          if (g.guest_email && !appEmails.has(g.guest_email.toLowerCase())) {
            uniqueGuestEmails.add(g.guest_email.toLowerCase());
          }
        });
        newCounts["guest_to_applicant"] = uniqueGuestEmails.size;

        // Re-engage: guests whose last visit was 30+ days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: lapsed } = await supabase
          .from("guest_passes" as any)
          .select("guest_email, valid_date")
          .not("guest_email", "is", null)
          .lt("valid_date", thirtyDaysAgo.toISOString().split("T")[0]);
        const lapsedEmails = new Set<string>();
        (lapsed || []).forEach((g: any) => {
          if (g.guest_email) lapsedEmails.add(g.guest_email.toLowerCase());
        });
        newCounts["re_engage_guest"] = lapsedEmails.size;

        // Feedback: guests without feedback
        const { data: feedbackGuests } = await supabase
          .from("guest_feedback" as any)
          .select("guest_email");
        const feedbackEmails = new Set((feedbackGuests || []).map((f: any) => f.guest_email?.toLowerCase()));
        const noFeedbackEmails = new Set<string>();
        (guests || []).forEach((g: any) => {
          if (g.guest_email && !feedbackEmails.has(g.guest_email.toLowerCase())) {
            noFeedbackEmails.add(g.guest_email.toLowerCase());
          }
        });
        newCounts["collect_feedback"] = noFeedbackEmails.size;
      } else {
        // Prevent churn
        const { count: churnCount } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .in("status", ["past_due", "frozen"])
          .not("email", "is", null);
        newCounts["prevent_churn"] = churnCount || 0;

        // Upsell: active members on lower tiers (silver/standard or no tier)
        const { count: upsellCount } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .not("email", "is", null);
        // Rough estimate — we count all active; real filter would check tier
        newCounts["upsell_tier"] = upsellCount || 0;

        // Referral push: active members (we'd need to cross-check member_referrals)
        const { data: activeMembers } = await supabase
          .from("members")
          .select("id")
          .eq("status", "active")
          .not("email", "is", null)
          .limit(1000);
        const { data: referrals } = await supabase
          .from("member_referrals" as any)
          .select("referring_member_id");
        const referrerIds = new Set((referrals || []).map((r: any) => r.referring_member_id));
        const noReferrals = (activeMembers || []).filter((m: any) => !referrerIds.has(m.id));
        newCounts["referral_push"] = noReferrals.length;
      }
    } catch (err) {
      console.error("Error fetching audience counts:", err);
    }

    setCounts(newCounts);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {playbooks.map((playbook) => (
          <Card key={playbook.id} variant="interactive" className="group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={`${playbook.color}`}>{playbook.icon}</div>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {counts[playbook.goalType] ?? "—"} recipients
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm font-semibold">{playbook.name}</CardTitle>
              <CardDescription className="text-xs">{playbook.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex">
                <Button
                  size="sm"
                  className="flex-1 rounded-r-none"
                  onClick={() => onLaunchPlaybook(playbook)}
                  disabled={loading || (counts[playbook.goalType] ?? 0) === 0}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Launch Email
                </Button>
                {onLaunchSmsPlaybook && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="rounded-l-none border-l border-primary-foreground/20 px-2"
                        disabled={loading || (counts[playbook.goalType] ?? 0) === 0}
                        aria-label="More launch options"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onLaunchSmsPlaybook(playbook)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Launch SMS / MMS
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Custom campaign card */}
        <Card variant="flat" className="border-dashed">
          <CardHeader className="pb-3">
            <div className="text-muted-foreground">
              <PenLine className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold">Custom Campaign</CardTitle>
            <CardDescription className="text-xs">Build a campaign from scratch with full control</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button size="sm" variant="outline" className="w-full" onClick={onCustomCampaign}>
              Compose
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
