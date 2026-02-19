import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useEmailConversations,
  useEmailMessages,
  useCreateConversation,
  useSendMessage,
  useMarkMessagesAsRead,
} from "@/hooks/useEmailConversations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export default function PortalSupport() {
  const { user } = useAuth();
  const { data: allConversations = [] } = useEmailConversations();
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const markAsRead = useMarkMessagesAsRead();

  const [activeTab, setActiveTab] = useState("support");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data: messages = [] } = useEmailMessages(selectedConvId);

  // Filter conversations by category
  const supportConvos = allConversations.filter(
    (c: any) => !c.category || c.category === "support"
  );
  const classConvos = allConversations.filter(
    (c: any) => c.category === "class_support"
  );

  const currentConvos = activeTab === "support" ? supportConvos : classConvos;
  const category = activeTab === "support" ? "support" : "class_support";

  useEffect(() => {
    if (selectedConvId) {
      markAsRead.mutate(selectedConvId);
    }
  }, [selectedConvId]);

  const handleCreate = () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    createConversation.mutate(
      { subject: newSubject, message: newMessage, category },
      {
        onSuccess: (conv) => {
          setSelectedConvId(conv.id);
          setNewSubject("");
          setNewMessage("");
          setShowNew(false);
        },
      }
    );
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedConvId) return;
    sendMessage.mutate(
      { conversationId: selectedConvId, message: replyText },
      { onSuccess: () => setReplyText("") }
    );
  };

  // Conversation detail view
  if (selectedConvId) {
    const conv = allConversations.find((c: any) => c.id === selectedConvId);
    return (
      <PortalLayout title="Support">
        <div className="max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedConvId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h3 className="font-medium">{conv?.subject || "Conversation"}</h3>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`p-3 rounded-sm text-sm ${
                  msg.sender_type === "member"
                    ? "bg-primary/5 ml-8"
                    : "bg-card mr-8 border border-border"
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {msg.sender_type === "member" ? "You" : "Staff"} ·{" "}
                  {format(new Date(msg.created_at), "MMM d, h:mm a")}
                </p>
                <p className="whitespace-pre-wrap">{msg.message_body}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1"
              rows={2}
            />
            <Button onClick={handleReply} disabled={sendMessage.isPending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Support">
      <div className="max-w-3xl space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="support">General Support</TabsTrigger>
            <TabsTrigger value="class_support">Class Support</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {showNew ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New {activeTab === "class_support" ? "Class " : ""}Support Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Subject"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                  <Textarea
                    placeholder="Describe your issue..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={createConversation.isPending}>
                      Submit
                    </Button>
                    <Button variant="outline" onClick={() => setShowNew(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button onClick={() => setShowNew(true)}>
                <MessageCircle className="h-4 w-4 mr-2" />
                New Request
              </Button>
            )}

            {currentConvos.length === 0 && !showNew ? (
              <p className="text-muted-foreground text-sm">No conversations yet.</p>
            ) : (
              currentConvos.map((conv: any) => (
                <Card
                  key={conv.id}
                  className="cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{conv.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conv.last_message_at || conv.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge variant={conv.status === "open" ? "default" : "secondary"}>
                      {conv.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
