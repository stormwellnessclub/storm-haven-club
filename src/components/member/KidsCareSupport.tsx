import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Baby, Send, Plus, Loader2, MessageCircle, AlertTriangle, Clock, CheckCircle2, AlertCircle, BellRing
} from "lucide-react";
import { format } from "date-fns";
import {
  useEmailConversations, useEmailMessages, useCreateConversation,
  useSendMessage, useMarkMessagesAsRead, EmailConversation
} from "@/hooks/useEmailConversations";
import { useToast } from "@/hooks/use-toast";

const KIDS_CARE_TOPICS = [
  { id: "pickup", label: "Pickup / Drop-off Question", subject: "Kids Care: Pickup/Drop-off" },
  { id: "medical", label: "Medical / Allergy Concern", subject: "Kids Care: Medical Concern" },
  { id: "schedule", label: "Schedule / Hours Question", subject: "Kids Care: Schedule Question" },
  { id: "billing", label: "Pass / Billing Issue", subject: "Kids Care: Billing" },
  { id: "other", label: "Other Question", subject: "Kids Care: General" },
];

const statusConfig: Record<EmailConversation['status'], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }> = {
  open: { label: 'Open', variant: 'default', icon: <AlertCircle className="h-3 w-3" /> },
  in_progress: { label: 'In Progress', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  resolved: { label: 'Resolved', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
  closed: { label: 'Closed', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
};

export function KidsCareSupport() {
  const { toast } = useToast();
  const { data: allConversations, isLoading } = useEmailConversations();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const { data: messages, isLoading: loadingMessages } = useEmailMessages(selectedConversation);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const markAsRead = useMarkMessagesAsRead();

  // Filter to kids_care conversations only
  const conversations = allConversations?.filter(c =>
    (c as any).category === "kids_care" ||
    c.subject.toLowerCase().includes("kids care")
  ) || [];

  // Check for emergency messages (staff-initiated with urgent flag in subject)
  const emergencyConvos = conversations.filter(c =>
    c.subject.toLowerCase().includes("urgent") ||
    c.subject.toLowerCase().includes("emergency")
  );

  const handleCreate = async () => {
    const topic = KIDS_CARE_TOPICS.find(t => t.id === selectedTopic);
    if (!topic || !messageBody.trim()) {
      toast({ title: "Error", description: "Please select a topic and enter your message.", variant: "destructive" });
      return;
    }
    try {
      const conversation = await createConversation.mutateAsync({
        subject: topic.subject,
        message: messageBody.trim(),
        category: "kids_care",
      } as any);
      setSelectedConversation(conversation.id);
      setIsNewOpen(false);
      setSelectedTopic("");
      setMessageBody("");
      toast({ title: "Message sent", description: "Our Kids Care team will respond shortly." });
    } catch {
      toast({ title: "Error", description: "Failed to send. Please try again.", variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    try {
      await sendMessage.mutateAsync({ conversationId: selectedConversation, message: newMessage.trim() });
      setNewMessage("");
    } catch {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Baby className="h-5 w-5 text-accent" />
          Kids Care Support
        </h2>
        <p className="text-sm text-muted-foreground">
          Questions about childcare, scheduling, or your child's visit
        </p>
      </div>

      {/* Emergency Alerts */}
      {emergencyConvos.length > 0 && (
        <Alert className="border-destructive/50 bg-destructive/5">
          <BellRing className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">Urgent Message from Kids Care Staff</AlertTitle>
          <AlertDescription className="space-y-2">
            {emergencyConvos.map(c => (
              <button
                key={c.id}
                className="block w-full text-left text-sm underline text-destructive hover:text-destructive/80"
                onClick={() => { setSelectedConversation(c.id); markAsRead.mutate(c.id); }}
              >
                {c.subject} — {format(new Date(c.last_message_at), "MMM d, h:mm a")}
              </button>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setIsNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ask Kids Care Team
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Kids Care Messages</CardTitle>
            <CardDescription>Your childcare conversations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Baby className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No Kids Care messages yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conversation) => {
                    const status = statusConfig[conversation.status];
                    const isUrgent = conversation.subject.toLowerCase().includes("urgent") || conversation.subject.toLowerCase().includes("emergency");
                    return (
                      <button
                        key={conversation.id}
                        onClick={() => { setSelectedConversation(conversation.id); markAsRead.mutate(conversation.id); }}
                        className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selectedConversation === conversation.id ? "bg-muted" : ""} ${isUrgent ? "border-l-2 border-l-destructive" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm line-clamp-1">
                            {isUrgent && <AlertTriangle className="h-3 w-3 text-destructive inline mr-1" />}
                            {conversation.subject}
                          </p>
                          <Badge variant={status.variant} className="shrink-0 text-xs">
                            {status.icon}<span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(conversation.last_message_at), "MMM d, h:mm a")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{selectedConv?.subject || "Select a conversation"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedConversation ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center px-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a conversation to view messages</p>
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-[350px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px] px-4">
                  <div className="space-y-4 py-4">
                    {messages?.map((message) => (
                      <div key={message.id} className={`flex ${message.sender_type === "member" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${message.sender_type === "member" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {message.sender_type === "staff" && (
                            <p className="text-xs font-semibold mb-1 opacity-70">Kids Care Staff</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.message_body}</p>
                          <p className={`text-xs mt-1 ${message.sender_type === "member" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {format(new Date(message.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={2}
                      className="resize-none"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    />
                    <Button onClick={handleSend} disabled={!newMessage.trim() || sendMessage.isPending} className="shrink-0">
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Kids Care Team</DialogTitle>
            <DialogDescription>Select a topic and send your message to our childcare team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Topic</Label>
              <div className="grid grid-cols-2 gap-2">
                {KIDS_CARE_TOPICS.map((topic) => (
                  <Button
                    key={topic.id}
                    variant={selectedTopic === topic.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTopic(topic.id)}
                    className="justify-start text-xs"
                  >
                    {topic.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Describe your question or concern..."
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createConversation.isPending}>
              {createConversation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Message</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
