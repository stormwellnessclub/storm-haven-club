import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Send, Star, Mail, Search, MessageSquare, Users } from "lucide-react";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { CampaignPlaybooks, type PlaybookConfig } from "./CampaignPlaybooks";

interface GuestFeedback {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  rating: number;
  comment: string | null;
  submitted_at: string;
}

interface GuestRecord {
  id: string;
  guest_name: string;
  guest_email: string | null;
  status: string;
  valid_date: string | null;
}

export function GuestMarketingTab() {
  const [feedback, setFeedback] = useState<GuestFeedback[]>([]);
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<{ email: string; name: string } | null>(null);
  const [activeGoalType, setActiveGoalType] = useState<string | undefined>();
  const [activePlaybookName, setActivePlaybookName] = useState<string | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [feedbackRes, guestsRes] = await Promise.all([
        supabase
          .from("guest_feedback" as any)
          .select("id, guest_name, guest_email, rating, comment, submitted_at")
          .order("submitted_at", { ascending: false })
          .limit(50),
        supabase
          .from("guest_passes" as any)
          .select("id, guest_name, guest_email, status, valid_date")
          .not("guest_email", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (feedbackRes.data) setFeedback(feedbackRes.data as any[]);
      if (guestsRes.data) setGuests(guestsRes.data as any[]);
    } catch (error) {
      console.error("Error loading guest marketing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueGuests = guests.reduce((acc, g) => {
    if (g.guest_email && !acc.find((a) => a.guest_email === g.guest_email)) {
      acc.push(g);
    }
    return acc;
  }, [] as GuestRecord[]);

  const filteredGuests = uniqueGuests.filter(
    (g) =>
      g.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.guest_email && g.guest_email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const avgRating = feedback.length > 0
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : "—";

  const handleSendToGuest = (guest: GuestRecord) => {
    if (!guest.guest_email) return;
    setSelectedGuest({ email: guest.guest_email, name: guest.guest_name });
    setComposeOpen(true);
  };

  const handleLaunchPlaybook = (playbook: PlaybookConfig) => {
    setSelectedGuest(null);
    setActiveGoalType(playbook.goalType);
    setActivePlaybookName(playbook.name);
    setComposeOpen(true);
  };

  const handleBulkSend = () => {
    setSelectedGuest(null);
    setActiveGoalType(undefined);
    setActivePlaybookName(undefined);
    setComposeOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{uniqueGuests.length}</p>
            <p className="text-xs text-muted-foreground">Unique Guests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Star className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{avgRating}</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <MessageSquare className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{feedback.length}</p>
            <p className="text-xs text-muted-foreground">Feedback Responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guest Outreach</CardTitle>
          <CardDescription>Send emails to past guests for re-engagement or feedback</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleBulkSend}>
              <Send className="h-4 w-4 mr-2" />
              Compose Campaign
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guests by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : filteredGuests.length > 0 ? (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {filteredGuests.slice(0, 20).map((guest) => (
                <div key={guest.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">{guest.guest_name}</p>
                    <p className="text-xs text-muted-foreground">{guest.guest_email}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleSendToGuest(guest)}>
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No guests found</p>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-5 w-5" />
            Guest Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No feedback received yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{f.guest_name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground">{f.guest_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < f.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {f.comment || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(f.submitted_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        recipientType="guest"
        prefilledRecipient={selectedGuest}
      />
    </div>
  );
}
